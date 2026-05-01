"""
冷链数据监测平台 - 后端 API v3.0
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from backend.auth import create_token, hash_password, verify_password, verify_token
from backend.models import (
    AlertRuleCreate, DeviceCreate, DeviceSnapshot, LoginRequest,
    LoginResponse, SensorDataIn, UserCreate, UserOut,
)
from backend.services import (
    add_audit_log, build_daily_report,
    build_weekly_report, classify_status, create_alert_rule,
    create_device, create_notification_channel, delete_alert_rule,
    delete_device, delete_notification_channel, export_sensor_data_csv,
    get_latest_records, list_alert_rules, list_devices,
    list_notification_channels, numeric_value, query_audit_logs,
    query_sensor_data, seed_demo_data, store_sensor_record,
    update_alert_rule, update_device, update_notification_channel,
    utc_now, isoformat_utc, _get_effective_threshold,
)
from backend.stores import (
    alert_rules_store, alerts_store, audit_logs_store, clear_all,
    devices_store, notification_channels_store, sensor_data_store,
    system_settings, users_store,
)


def parse_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def parse_origins(value: Optional[str]) -> List[str]:
    defaults = ["http://localhost:5173", "http://127.0.0.1:5173"]
    if not value:
        return defaults
    origins = [s.strip() for s in value.split(",") if s.strip()]
    return origins or defaults


class Settings:
    def __init__(self):
        self.backend_host = os.getenv("BACKEND_HOST", "0.0.0.0")
        self.backend_port = int(os.getenv("BACKEND_PORT", "8000"))
        self.frontend_origins = parse_origins(os.getenv("FRONTEND_ORIGINS"))
        self.online_window_minutes = int(os.getenv("ONLINE_WINDOW_MINUTES", "10"))
        self.enable_demo_seed = parse_bool(os.getenv("ENABLE_DEMO_SEED"), True)
        self.enable_dev_tools = parse_bool(os.getenv("ENABLE_DEV_TOOLS"), True)
        self.dashboard_trend_limit = int(os.getenv("DASHBOARD_TREND_LIMIT", "12"))


settings = Settings()

app = FastAPI(title="冷链数据监测平台 API", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth helpers ────────────────────────────────────────────────

def get_current_user(authorization: str = Header("")) -> Optional[Dict[str, Any]]:
    if not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    return verify_token(token)


def require_admin(authorization: str = Header("")) -> Dict[str, Any]:
    user = get_current_user(authorization)
    if user is None:
        raise HTTPException(401, "未登录或登录已过期")
    if user.get("role") != "admin":
        raise HTTPException(403, "需要管理员权限")
    return user


def optional_user(authorization: str = Header("")) -> Optional[Dict[str, Any]]:
    return get_current_user(authorization)


# ─── Startup ─────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    if settings.enable_demo_seed:
        seed_demo_data()
        # 创建默认管理员
        if "admin" not in users_store:
            from backend.models import User as UserModel
            users_store["admin"] = UserModel(
                id=str(uuid.uuid4())[:8], username="admin",
                password_hash=hash_password("admin123"),
                role="admin", created_at=isoformat_utc(),
            )


# ─── 认证 ────────────────────────────────────────────────────────

@app.post("/api/auth/register")
def register(data: UserCreate):
    if not data.username or not data.password:
        raise HTTPException(400, "用户名和密码不能为空")
    if data.username in users_store:
        raise HTTPException(409, "用户名已存在")
    from backend.models import User as UserModel
    user = UserModel(
        id=str(uuid.uuid4())[:8], username=data.username,
        password_hash=hash_password(data.password),
        role=data.role, created_at=isoformat_utc(),
    )
    users_store[data.username] = user
    return UserOut(id=user.id, username=user.username, role=user.role, created_at=user.created_at)


@app.post("/api/auth/login", response_model=LoginResponse)
def login(data: LoginRequest):
    user = users_store.get(data.username)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "用户名或密码错误")
    token = create_token({"sub": user.username, "role": user.role, "id": user.id})
    return LoginResponse(
        token=token,
        user=UserOut(id=user.id, username=user.username, role=user.role, created_at=user.created_at),
    )


@app.get("/api/auth/me")
def get_me(authorization: str = Header("")):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(401, "未登录")
    return user


@app.get("/api/users")
def list_users():
    return [UserOut(id=u.id, username=u.username, role=u.role, created_at=u.created_at)
            for u in users_store.values()]


# ─── 传感器数据 ───────────────────────────────────────────────────

@app.post("/api/sensor/data")
async def receive_sensor_data(data: SensorDataIn):
    """采集传感器数据"""
    record = store_sensor_record(
        data.device_id,
        isoformat_utc(data.timestamp),
        data.sensors.dict(),
    )
    return {
        "status": "success", "message": "数据接收成功",
        "device_id": record["device_id"], "timestamp": record["timestamp"],
    }


@app.get("/api/sensor/data")
async def query_data(
    device_id: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    limit: int = Query(100),
):
    return query_sensor_data(device_id, start_time, end_time, limit)


@app.get("/api/sensor/data/{device_id}")
async def get_device_data(device_id: str, limit: int = 100):
    data = [d for d in sensor_data_store if d["device_id"] == device_id]
    return data[-limit:]


@app.get("/api/sensor/data/export/csv")
async def export_csv(
    device_id: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
):
    csv_content = export_sensor_data_csv(device_id, start_time, end_time)
    return PlainTextResponse(csv_content, media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=sensor-data.csv"})


@app.get("/api/sensor/latest")
async def get_latest():
    latest = {}
    for did, record in get_latest_records().items():
        latest[did] = {**record, "status": classify_status(record["sensors"])}
    return latest


# ─── 告警 ─────────────────────────────────────────────────────────

@app.get("/api/alerts")
async def get_alerts(limit: int = 50):
    alerts = sorted(alerts_store, key=lambda a: a.created_at, reverse=True)
    return [a.dict() for a in alerts[:limit]]


# ─── 统计 ─────────────────────────────────────────────────────────

@app.get("/api/stats")
async def get_stats():
    temps = [numeric_value(d["sensors"].get("temperature")) for d in sensor_data_store]
    hums = [numeric_value(d["sensors"].get("humidity")) for d in sensor_data_store]
    temps = [t for t in temps if t is not None]
    hums = [h for h in hums if h is not None]
    return {
        "total_records": len(sensor_data_store),
        "avg_temperature": round(sum(temps) / len(temps), 2) if temps else 0.0,
        "avg_humidity": round(sum(hums) / len(hums), 2) if hums else 0.0,
        "alert_count": len(alerts_store),
    }


# ─── 仪表盘 ───────────────────────────────────────────────────────

def compute_summary():
    online_cutoff = utc_now() - timedelta(minutes=settings.online_window_minutes)
    online = sum(
        1 for r in get_latest_records().values()
        if datetime.fromisoformat(r["timestamp"]) >= online_cutoff
    )
    temps = [numeric_value(d["sensors"].get("temperature")) for d in sensor_data_store]
    hums = [numeric_value(d["sensors"].get("humidity")) for d in sensor_data_store]
    temps = [t for t in temps if t is not None]
    hums = [h for h in hums if h is not None]
    return {
        "online_devices": online,
        "total_records": len(sensor_data_store),
        "avg_temperature": round(sum(temps) / len(temps), 2) if temps else 0.0,
        "avg_humidity": round(sum(hums) / len(hums), 2) if hums else 0.0,
        "alert_count": len(alerts_store),
    }


def build_trends(limit: int):
    latest = get_latest_records()
    device_ids = sorted(latest.keys())
    series = []
    for did in device_ids:
        records = [r for r in sensor_data_store if r["device_id"] == did]
        points = [
            {"timestamp": r["timestamp"],
             "temperature": numeric_value(r["sensors"].get("temperature")),
             "humidity": numeric_value(r["sensors"].get("humidity"))}
            for r in records[-limit:]
        ]
        series.append({"device_id": did, "points": points})
    return {"selected_device_id": device_ids[0] if device_ids else None, "series": series}


@app.get("/api/dashboard")
def get_dashboard(limit: int = 12, alert_limit: int = 8):
    snapshots = []
    for record in get_latest_records().values():
        sensors = record["sensors"]
        snapshots.append(DeviceSnapshot(
            device_id=record["device_id"], timestamp=record["timestamp"],
            temperature=numeric_value(sensors.get("temperature")),
            humidity=numeric_value(sensors.get("humidity")),
            status=classify_status(sensors), sensors=sensors,
        ))
    snapshots.sort(key=lambda x: x.device_id)
    alerts = sorted(alerts_store, key=lambda a: a.created_at, reverse=True)
    return {
        "summary": compute_summary(),
        "devices": [s.dict() for s in snapshots],
        "alerts": [a.dict() for a in alerts[:alert_limit]],
        "trends": build_trends(max(1, limit)),
    }


# ─── 设备管理 ─────────────────────────────────────────────────────

@app.get("/api/devices")
async def get_devices():
    return [d.dict() for d in list_devices()]


@app.post("/api/devices")
async def add_device(data: DeviceCreate):
    if data.device_id in devices_store:
        raise HTTPException(409, "设备ID已存在")
    dev = create_device(data)
    return dev.dict()


@app.put("/api/devices/{device_id}")
async def edit_device(device_id: str, data: DeviceCreate):
    dev = update_device(device_id, data)
    if not dev:
        raise HTTPException(404, "设备不存在")
    return dev.dict()


@app.delete("/api/devices/{device_id}")
async def remove_device(device_id: str):
    if not delete_device(device_id):
        raise HTTPException(404, "设备不存在")
    return {"message": "设备已删除"}


# ─── 告警规则 ─────────────────────────────────────────────────────

@app.get("/api/alert-rules")
async def get_alert_rules():
    return [r.dict() for r in list_alert_rules()]


@app.post("/api/alert-rules")
async def add_alert_rule(data: AlertRuleCreate):
    rule = create_alert_rule(data)
    return rule.dict()


@app.put("/api/alert-rules/{rule_id}")
async def edit_alert_rule(rule_id: str, data: AlertRuleCreate):
    rule = update_alert_rule(rule_id, data)
    if not rule:
        raise HTTPException(404, "规则不存在")
    return rule.dict()


@app.delete("/api/alert-rules/{rule_id}")
async def remove_alert_rule(rule_id: str):
    if not delete_alert_rule(rule_id):
        raise HTTPException(404, "规则不存在")
    return {"message": "规则已删除"}


# ─── 数据报表 ─────────────────────────────────────────────────────

@app.get("/api/reports/daily")
async def daily_report(date: str, device_id: str):
    report = build_daily_report(date, device_id)
    if not report:
        raise HTTPException(404, "指定日期无数据")
    return report.dict()


@app.get("/api/reports/weekly")
async def weekly_report(start_date: str, end_date: str, device_id: str):
    reports = build_weekly_report(start_date, end_date, device_id)
    return [r.dict() for r in reports]


# ─── 审计日志 ─────────────────────────────────────────────────────

@app.get("/api/audit-logs")
async def get_audit_logs(
    user: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource: Optional[str] = Query(None),
    limit: int = Query(100),
):
    return [l.dict() for l in query_audit_logs(user, action, resource, limit)]


# ─── 系统设置 ─────────────────────────────────────────────────────

@app.get("/api/settings")
async def get_settings():
    return system_settings.dict()


@app.put("/api/settings")
async def update_settings(data: dict):
    for k, v in data.items():
        if hasattr(system_settings, k):
            setattr(system_settings, k, v)
    return system_settings.dict()


# ─── 通知渠道 ─────────────────────────────────────────────────────

@app.get("/api/notification-channels")
async def get_channels():
    return [c.dict() for c in list_notification_channels()]


@app.post("/api/notification-channels")
async def add_channel(data: dict):
    ch = create_notification_channel(
        name=data["name"], channel_type=data["channel_type"],
        config=data.get("config", {}),
        alert_level=data.get("alert_level", "warning"),
    )
    return ch.dict()


@app.put("/api/notification-channels/{channel_id}")
async def edit_channel(channel_id: str, data: dict):
    ch = update_notification_channel(channel_id, **data)
    if not ch:
        raise HTTPException(404, "渠道不存在")
    return ch.dict()


@app.delete("/api/notification-channels/{channel_id}")
async def remove_channel(channel_id: str):
    if not delete_notification_channel(channel_id):
        raise HTTPException(404, "渠道不存在")
    return {"message": "渠道已删除"}


# ─── 开发工具 ─────────────────────────────────────────────────────

if settings.enable_dev_tools:
    @app.delete("/api/clear")
    async def clear_data():
        clear_all()
        return {"message": "所有数据已清除"}


# ─── 根路径 ───────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "冷链数据监测平台 API",
        "version": "3.0.0",
        "mode": "demo" if settings.enable_demo_seed else "live",
        "modules": [
            "sensor-data", "device-management", "alert-rules",
            "history-query", "data-reports", "user-auth",
            "audit-logs", "system-settings", "notification-channels",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.backend_host, port=settings.backend_port)
