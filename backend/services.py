"""
业务逻辑
"""
import csv
import io
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from backend.models import (
    AlertRecord, AlertRule, AlertRuleCreate, AuditLog, DeviceCreate,
    DeviceInfo, NotificationChannel, ReportDaily, SystemSettings, TrendPoint,
)
from backend.stores import (
    alert_rules_store, alerts_store, audit_logs_store,
    devices_store, notification_channels_store, sensor_data_store,
    system_settings,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def isoformat_utc(dt: Optional[datetime] = None) -> str:
    return (dt or utc_now()).isoformat()


def numeric_value(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _get_effective_threshold(device_id: str, metric: str) -> tuple:
    """获取设备生效的阈值：设备级规则 > 全局规则 > 默认值"""
    for rule in alert_rules_store:
        if rule.device_id == device_id and rule.metric == metric and rule.enabled:
            return rule.warning_threshold, rule.critical_threshold
    for rule in alert_rules_store:
        if rule.device_id == "*" and rule.metric == metric and rule.enabled:
            return rule.warning_threshold, rule.critical_threshold
    if metric == "temperature":
        return system_settings.default_temp_threshold, system_settings.default_temp_threshold + 5
    return system_settings.default_humidity_threshold, system_settings.default_humidity_threshold + 10


def classify_metric(value: Optional[float], warning_threshold: float, critical_threshold: float) -> str:
    if value is None:
        return "normal"
    if value > critical_threshold:
        return "critical"
    if value > warning_threshold:
        return "warning"
    return "normal"


def classify_status(sensors: Dict[str, Any]) -> str:
    temp = numeric_value(sensors.get("temperature"))
    hum = numeric_value(sensors.get("humidity"))
    t_warn, t_crit = _get_effective_threshold("", "temperature")
    h_warn, h_crit = _get_effective_threshold("", "humidity")

    temp_state = classify_metric(temp, t_warn, t_crit)
    hum_state = classify_metric(hum, h_warn, h_crit)
    if "critical" in {temp_state, hum_state}:
        return "critical"
    if "warning" in {temp_state, hum_state}:
        return "warning"
    return "normal"


def build_alerts(record: Dict[str, Any], device_id: str) -> List[AlertRecord]:
    alerts = []
    event_at = record["timestamp"]
    created_at = isoformat_utc()

    for metric, label, unit in [("temperature", "温度", "°C"), ("humidity", "湿度", "%")]:
        current_value = numeric_value(record["sensors"].get(metric))
        warn_threshold, crit_threshold = _get_effective_threshold(device_id, metric)
        if current_value is None or current_value <= warn_threshold:
            continue
        level = classify_metric(current_value, warn_threshold, crit_threshold)
        alerts.append(AlertRecord(
            device_id=device_id,
            alert_type=metric,
            metric=metric,
            message=f"{label}过高: {current_value:.1f}{unit}（阈值 {warn_threshold:.1f}{unit}）",
            level=level,
            threshold=warn_threshold,
            current_value=current_value,
            created_at=created_at,
            event_at=event_at,
        ))
    return alerts


def store_sensor_record(device_id: str, timestamp: str, sensors: Dict[str, Any]) -> Dict[str, Any]:
    record = {"device_id": device_id, "timestamp": timestamp, "sensors": sensors}
    sensor_data_store.append(record)
    for alert in build_alerts(record, device_id):
        alerts_store.append(alert)
    return record


def get_latest_records() -> Dict[str, Dict[str, Any]]:
    latest = {}
    for record in sensor_data_store:
        did = record["device_id"]
        if did not in latest or record["timestamp"] > latest[did]["timestamp"]:
            latest[did] = record
    return latest


def seed_demo_data():
    if sensor_data_store:
        return
    randomizer = random.Random(42)
    base_time = utc_now() - timedelta(minutes=55)
    device_offsets = {
        "sensor_001": (4.0, 72.0),
        "sensor_002": (6.5, 76.0),
        "sensor_003": (9.0, 87.0),
        "sensor_004": (11.5, 94.0),
    }
    for step in range(12):
        event_time = base_time + timedelta(minutes=5 * step)
        for did, (tb, hb) in device_offsets.items():
            sensors = {
                "temperature": round(tb + randomizer.uniform(-1.2, 1.4), 1),
                "humidity": round(hb + randomizer.uniform(-4.0, 5.0), 1),
                "gpio_1": 0,
                "gpio_2": 1,
            }
            store_sensor_record(did, isoformat_utc(event_time), sensors)

    # 预置设备信息
    for did, (name, loc, model) in {
        "sensor_001": ("冷库A-1号", "上海市浦东新区", "DHT11"),
        "sensor_002": ("冷库A-2号", "上海市浦东新区", "DHT11"),
        "sensor_003": ("冷库B-1号", "上海市松江区", "DHT22"),
        "sensor_004": ("冷库B-2号", "上海市松江区", "DHT22"),
    }.items():
        if did not in devices_store:
            devices_store[did] = DeviceInfo(
                device_id=did, name=name, model=model, location=loc,
                install_date="2026-01-15", status="active",
            )


# --- 设备管理 ---

def list_devices() -> List[DeviceInfo]:
    return list(devices_store.values())


def create_device(data: DeviceCreate) -> DeviceInfo:
    dev = DeviceInfo(device_id=data.device_id, name=data.name, model=data.model,
                     location=data.location, install_date=data.install_date)
    devices_store[data.device_id] = dev
    return dev


def update_device(device_id: str, data: DeviceCreate) -> Optional[DeviceInfo]:
    if device_id not in devices_store:
        return None
    dev = devices_store[device_id]
    devices_store[device_id] = DeviceInfo(
        device_id=device_id, name=data.name or dev.name,
        model=data.model or dev.model, location=data.location or dev.location,
        install_date=data.install_date or dev.install_date, status=dev.status,
    )
    return devices_store[device_id]


def delete_device(device_id: str) -> bool:
    if device_id in devices_store:
        del devices_store[device_id]
        return True
    return False


# --- 告警规则 ---

def list_alert_rules() -> List[AlertRule]:
    return alert_rules_store


def create_alert_rule(data: AlertRuleCreate) -> AlertRule:
    rule = AlertRule(id=str(uuid.uuid4())[:8], **data.dict())
    alert_rules_store.append(rule)
    return rule


def update_alert_rule(rule_id: str, data: AlertRuleCreate) -> Optional[AlertRule]:
    for i, rule in enumerate(alert_rules_store):
        if rule.id == rule_id:
            alert_rules_store[i] = AlertRule(
                id=rule_id, device_id=data.device_id, metric=data.metric,
                warning_threshold=data.warning_threshold,
                critical_threshold=data.critical_threshold, enabled=data.enabled,
            )
            return alert_rules_store[i]
    return None


def delete_alert_rule(rule_id: str) -> bool:
    for i, rule in enumerate(alert_rules_store):
        if rule.id == rule_id:
            alert_rules_store.pop(i)
            return True
    return False


# --- 历史数据查询 ---

def query_sensor_data(device_id: Optional[str] = None,
                       start_time: Optional[str] = None,
                       end_time: Optional[str] = None,
                       limit: int = 100) -> List[Dict[str, Any]]:
    data = sensor_data_store
    if device_id:
        data = [d for d in data if d["device_id"] == device_id]
    if start_time:
        data = [d for d in data if d["timestamp"] >= start_time]
    if end_time:
        data = [d for d in data if d["timestamp"] <= end_time]
    return data[-limit:]


def export_sensor_data_csv(device_id: Optional[str] = None,
                            start_time: Optional[str] = None,
                            end_time: Optional[str] = None) -> str:
    data = query_sensor_data(device_id, start_time, end_time, limit=10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["device_id", "timestamp", "temperature", "humidity"])
    for d in data:
        writer.writerow([
            d["device_id"], d["timestamp"],
            d["sensors"].get("temperature", ""),
            d["sensors"].get("humidity", ""),
        ])
    return output.getvalue()


# --- 数据报表 ---

def build_daily_report(date_str: str, device_id: str) -> Optional[ReportDaily]:
    start = f"{date_str}T00:00:00"
    end = f"{date_str}T23:59:59"
    data = query_sensor_data(device_id, start, end, limit=10000)
    if not data:
        return None

    temps = [numeric_value(d["sensors"].get("temperature")) for d in data]
    hums = [numeric_value(d["sensors"].get("humidity")) for d in data]
    temps = [t for t in temps if t is not None]
    hums = [h for h in hums if h is not None]

    alert_count = sum(1 for a in alerts_store
                      if a.device_id == device_id and a.event_at[:10] == date_str)

    return ReportDaily(
        date=date_str, device_id=device_id,
        max_temperature=max(temps) if temps else None,
        min_temperature=min(temps) if temps else None,
        avg_temperature=round(sum(temps) / len(temps), 2) if temps else None,
        max_humidity=max(hums) if hums else None,
        min_humidity=min(hums) if hums else None,
        avg_humidity=round(sum(hums) / len(hums), 2) if hums else None,
        alert_count=alert_count,
        sample_count=len(data),
    )


def build_weekly_report(start_date: str, end_date: str, device_id: str) -> List[ReportDaily]:
    from datetime import date, timedelta
    reports = []
    try:
        d = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        while d <= end:
            report = build_daily_report(d.isoformat(), device_id)
            if report:
                reports.append(report)
            d += timedelta(days=1)
    except ValueError:
        pass
    return reports


# --- 审计日志 ---

def add_audit_log(user: str, action: str, resource: str,
                   resource_id: str, detail: str = "", ip: str = "") -> AuditLog:
    log = AuditLog(
        id=str(uuid.uuid4())[:8], user=user, action=action,
        resource=resource, resource_id=resource_id, detail=detail,
        timestamp=isoformat_utc(), ip=ip,
    )
    audit_logs_store.append(log)
    return log


def query_audit_logs(user: Optional[str] = None,
                      action: Optional[str] = None,
                      resource: Optional[str] = None,
                      limit: int = 100) -> List[AuditLog]:
    data = audit_logs_store
    if user:
        data = [d for d in data if d.user == user]
    if action:
        data = [d for d in data if d.action == action]
    if resource:
        data = [d for d in data if d.resource == resource]
    data.sort(key=lambda x: x.timestamp, reverse=True)
    return data[:limit]


# --- 通知渠道 ---

def list_notification_channels() -> List[NotificationChannel]:
    return notification_channels_store


def create_notification_channel(name: str, channel_type: str,
                                 config: Dict[str, str],
                                 alert_level: str = "warning") -> NotificationChannel:
    ch = NotificationChannel(
        id=str(uuid.uuid4())[:8], name=name, channel_type=channel_type,
        config=config, alert_level=alert_level,
    )
    notification_channels_store.append(ch)
    return ch


def update_notification_channel(channel_id: str, **kwargs) -> Optional[NotificationChannel]:
    for i, ch in enumerate(notification_channels_store):
        if ch.id == channel_id:
            for k, v in kwargs.items():
                setattr(notification_channels_store[i], k, v)
            return notification_channels_store[i]
    return None


def delete_notification_channel(channel_id: str) -> bool:
    for i, ch in enumerate(notification_channels_store):
        if ch.id == channel_id:
            notification_channels_store.pop(i)
            return True
    return False
