"""
内存数据存储
"""
from typing import Any, Dict, List

from backend.models import AlertRecord, AlertRule, AuditLog, DeviceInfo, NotificationChannel, SystemSettings, User

# 传感器数据
sensor_data_store: List[Dict[str, Any]] = []
alerts_store: List[AlertRecord] = []

# 设备管理
devices_store: Dict[str, DeviceInfo] = {}

# 告警规则
alert_rules_store: List[AlertRule] = []

# 用户
users_store: Dict[str, User] = {}

# 审计日志
audit_logs_store: List[AuditLog] = []

# 系统配置
system_settings = SystemSettings()

# 通知渠道
notification_channels_store: List[NotificationChannel] = []


def clear_all():
    """清空所有数据（仅开发模式）"""
    sensor_data_store.clear()
    alerts_store.clear()
    devices_store.clear()
    alert_rules_store.clear()
    users_store.clear()
    audit_logs_store.clear()
    notification_channels_store.clear()
