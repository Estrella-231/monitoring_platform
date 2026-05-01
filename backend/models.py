"""
数据模型定义
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Extra, Field


class SensorPayload(BaseModel):
    temperature: Optional[float] = Field(default=None, description="温度（摄氏度）")
    humidity: Optional[float] = Field(default=None, description="湿度（百分比）")

    class Config:
        extra = Extra.allow


class SensorDataIn(BaseModel):
    device_id: str
    timestamp: datetime
    sensors: SensorPayload


class AlertRecord(BaseModel):
    device_id: str
    alert_type: str
    metric: str
    message: str
    level: str
    threshold: float
    current_value: float
    created_at: str
    event_at: str


class StatsResponse(BaseModel):
    total_records: int
    avg_temperature: float
    avg_humidity: float
    alert_count: int


class DeviceSnapshot(BaseModel):
    device_id: str
    timestamp: str
    temperature: Optional[float]
    humidity: Optional[float]
    status: str
    sensors: Dict[str, Any]


class DashboardSummary(StatsResponse):
    online_devices: int


class TrendPoint(BaseModel):
    timestamp: str
    temperature: Optional[float]
    humidity: Optional[float]


class DeviceTrend(BaseModel):
    device_id: str
    points: List[TrendPoint]


class DashboardTrends(BaseModel):
    selected_device_id: Optional[str]
    series: List[DeviceTrend]


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    devices: List[DeviceSnapshot]
    alerts: List[AlertRecord]
    trends: DashboardTrends


# --- 新增模型 ---

class DeviceInfo(BaseModel):
    """设备注册信息"""
    device_id: str
    name: str = ""
    model: str = ""
    location: str = ""
    install_date: str = ""
    status: str = "active"  # active, inactive, maintenance


class DeviceCreate(BaseModel):
    device_id: str
    name: str = ""
    model: str = ""
    location: str = ""
    install_date: str = ""


class AlertRule(BaseModel):
    id: str
    device_id: str  # "*" 表示全局规则
    metric: str  # temperature, humidity
    warning_threshold: float
    critical_threshold: float
    enabled: bool = True


class AlertRuleCreate(BaseModel):
    device_id: str = "*"
    metric: str
    warning_threshold: float
    critical_threshold: float
    enabled: bool = True


class User(BaseModel):
    id: str
    username: str
    password_hash: str
    role: str = "viewer"  # admin, viewer
    created_at: str


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer"


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    created_at: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class ReportDaily(BaseModel):
    date: str
    device_id: str
    max_temperature: Optional[float]
    min_temperature: Optional[float]
    avg_temperature: Optional[float]
    max_humidity: Optional[float]
    min_humidity: Optional[float]
    avg_humidity: Optional[float]
    alert_count: int
    sample_count: int


class AuditLog(BaseModel):
    id: str
    user: str
    action: str  # create, update, delete
    resource: str
    resource_id: str
    detail: str = ""
    timestamp: str
    ip: str = ""


class SystemSettings(BaseModel):
    upload_interval_seconds: int = 30
    data_retention_days: int = 90
    online_window_minutes: int = 10
    default_temp_threshold: float = 10.0
    default_humidity_threshold: float = 90.0


class NotificationChannel(BaseModel):
    id: str
    name: str
    channel_type: str  # email, webhook
    config: Dict[str, str] = {}  # e.g. {"email": "a@b.com"} or {"url": "https://..."}
    enabled: bool = True
    alert_level: str = "warning"  # warning, critical
