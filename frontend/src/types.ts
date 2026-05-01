// ─── Dashboard Types ─────────────────────────────────────

export interface DashboardSummary {
  total_records: number;
  avg_temperature: number;
  avg_humidity: number;
  alert_count: number;
  online_devices: number;
}

export interface DeviceSnapshot {
  device_id: string;
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
  status: "normal" | "warning" | "critical";
  sensors: Record<string, unknown>;
}

export interface AlertRecord {
  device_id: string;
  alert_type: string;
  metric: string;
  message: string;
  level: "warning" | "critical";
  threshold: number;
  current_value: number;
  created_at: string;
  event_at: string;
}

export interface TrendPoint {
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
}

export interface DeviceTrend {
  device_id: string;
  points: TrendPoint[];
}

export interface DashboardResponse {
  summary: DashboardSummary;
  devices: DeviceSnapshot[];
  alerts: AlertRecord[];
  trends: {
    selected_device_id: string | null;
    series: DeviceTrend[];
  };
}

export interface SensorRecord {
  device_id: string;
  timestamp: string;
  sensors: Record<string, unknown> & {
    temperature?: number | null;
    humidity?: number | null;
  };
}

// ─── New Types ───────────────────────────────────────────

export interface DeviceInfo {
  device_id: string;
  name: string;
  model: string;
  location: string;
  install_date: string;
  status: string;
}

export interface AlertRule {
  id: string;
  device_id: string;
  metric: string;
  warning_threshold: number;
  critical_threshold: number;
  enabled: boolean;
}

export interface ReportDaily {
  date: string;
  device_id: string;
  max_temperature: number | null;
  min_temperature: number | null;
  avg_temperature: number | null;
  max_humidity: number | null;
  min_humidity: number | null;
  avg_humidity: number | null;
  alert_count: number;
  sample_count: number;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  resource: string;
  resource_id: string;
  detail: string;
  timestamp: string;
  ip: string;
}

export interface SystemSettings {
  upload_interval_seconds: number;
  data_retention_days: number;
  online_window_minutes: number;
  default_temp_threshold: number;
  default_humidity_threshold: number;
}

export interface NotificationChannel {
  id: string;
  name: string;
  channel_type: string;
  config: Record<string, string>;
  enabled: boolean;
  alert_level: string;
}

export interface UserInfo {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}
