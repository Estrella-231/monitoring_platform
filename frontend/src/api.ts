import type {
  AlertRule, AuditLog, DashboardResponse, DeviceInfo,
  LoginResponse, NotificationChannel, ReportDaily, SensorRecord,
  SystemSettings, UserInfo,
} from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export const REFRESH_INTERVAL_MS = Number(import.meta.env.VITE_REFRESH_INTERVAL_MS ?? 5000);

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────

export function login(username: string, password: string): Promise<LoginResponse> {
  return fetchJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function register(username: string, password: string, role = "viewer"): Promise<UserInfo> {
  return fetchJson<UserInfo>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, role }),
  });
}

export function getUsers(): Promise<UserInfo[]> {
  return fetchJson<UserInfo[]>("/api/users");
}

// ─── Dashboard ───────────────────────────────────────────

export function fetchDashboard(): Promise<DashboardResponse> {
  return fetchJson<DashboardResponse>("/api/dashboard");
}

export function fetchDeviceHistory(deviceId: string, limit = 24): Promise<SensorRecord[]> {
  return fetchJson<SensorRecord[]>(
    `/api/sensor/data/${encodeURIComponent(deviceId)}?limit=${limit}`
  );
}

// ─── Devices ─────────────────────────────────────────────

export function fetchDevices(): Promise<DeviceInfo[]> {
  return fetchJson<DeviceInfo[]>("/api/devices");
}

export function createDevice(data: Partial<DeviceInfo>): Promise<DeviceInfo> {
  return fetchJson<DeviceInfo>("/api/devices", {
    method: "POST", body: JSON.stringify(data),
  });
}

export function updateDevice(deviceId: string, data: Partial<DeviceInfo>): Promise<DeviceInfo> {
  return fetchJson<DeviceInfo>(`/api/devices/${encodeURIComponent(deviceId)}`, {
    method: "PUT", body: JSON.stringify(data),
  });
}

export function deleteDevice(deviceId: string): Promise<void> {
  return fetchJson<void>(`/api/devices/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
}

// ─── Alert Rules ─────────────────────────────────────────

export function fetchAlertRules(): Promise<AlertRule[]> {
  return fetchJson<AlertRule[]>("/api/alert-rules");
}

export function createAlertRule(data: Partial<AlertRule>): Promise<AlertRule> {
  return fetchJson<AlertRule>("/api/alert-rules", {
    method: "POST", body: JSON.stringify(data),
  });
}

export function updateAlertRule(ruleId: string, data: Partial<AlertRule>): Promise<AlertRule> {
  return fetchJson<AlertRule>(`/api/alert-rules/${ruleId}`, {
    method: "PUT", body: JSON.stringify(data),
  });
}

export function deleteAlertRule(ruleId: string): Promise<void> {
  return fetchJson<void>(`/api/alert-rules/${ruleId}`, { method: "DELETE" });
}

// ─── History ─────────────────────────────────────────────

export function queryHistory(params: {
  device_id?: string; start_time?: string; end_time?: string; limit?: number;
}): Promise<SensorRecord[]> {
  const qs = new URLSearchParams();
  if (params.device_id) qs.set("device_id", params.device_id);
  if (params.start_time) qs.set("start_time", params.start_time);
  if (params.end_time) qs.set("end_time", params.end_time);
  if (params.limit) qs.set("limit", String(params.limit));
  return fetchJson<SensorRecord[]>(`/api/sensor/data?${qs}`);
}

export function exportCsvUrl(params: {
  device_id?: string; start_time?: string; end_time?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.device_id) qs.set("device_id", params.device_id);
  if (params.start_time) qs.set("start_time", params.start_time);
  if (params.end_time) qs.set("end_time", params.end_time);
  const token = localStorage.getItem("auth_token");
  return `${API_BASE_URL}/api/sensor/data/export/csv?${qs}&token=${token || ""}`;
}

// ─── Reports ─────────────────────────────────────────────

export function fetchDailyReport(date: string, deviceId: string): Promise<ReportDaily> {
  return fetchJson<ReportDaily>(
    `/api/reports/daily?date=${encodeURIComponent(date)}&device_id=${encodeURIComponent(deviceId)}`
  );
}

export function fetchWeeklyReport(startDate: string, endDate: string, deviceId: string): Promise<ReportDaily[]> {
  return fetchJson<ReportDaily[]>(
    `/api/reports/weekly?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&device_id=${encodeURIComponent(deviceId)}`
  );
}

// ─── Audit Logs ──────────────────────────────────────────

export function fetchAuditLogs(params: {
  user?: string; action?: string; resource?: string; limit?: number;
}): Promise<AuditLog[]> {
  const qs = new URLSearchParams();
  if (params.user) qs.set("user", params.user);
  if (params.action) qs.set("action", params.action);
  if (params.resource) qs.set("resource", params.resource);
  if (params.limit) qs.set("limit", String(params.limit));
  return fetchJson<AuditLog[]>(`/api/audit-logs?${qs}`);
}

// ─── Settings ────────────────────────────────────────────

export function fetchSettings(): Promise<SystemSettings> {
  return fetchJson<SystemSettings>("/api/settings");
}

export function updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
  return fetchJson<SystemSettings>("/api/settings", {
    method: "PUT", body: JSON.stringify(data),
  });
}

// ─── Notification Channels ───────────────────────────────

export function fetchChannels(): Promise<NotificationChannel[]> {
  return fetchJson<NotificationChannel[]>("/api/notification-channels");
}

export function createChannel(data: Partial<NotificationChannel>): Promise<NotificationChannel> {
  return fetchJson<NotificationChannel>("/api/notification-channels", {
    method: "POST", body: JSON.stringify(data),
  });
}

export function updateChannel(id: string, data: Partial<NotificationChannel>): Promise<NotificationChannel> {
  return fetchJson<NotificationChannel>(`/api/notification-channels/${id}`, {
    method: "PUT", body: JSON.stringify(data),
  });
}

export function deleteChannel(id: string): Promise<void> {
  return fetchJson<void>(`/api/notification-channels/${id}`, { method: "DELETE" });
}

// ─── Alerts ──────────────────────────────────────────────

export function fetchAlerts(limit = 50): Promise<AlertRule[]> {
  return fetchJson<AlertRule[]>(`/api/alerts?limit=${limit}`);
}
