import { startTransition, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard, fetchDeviceHistory, REFRESH_INTERVAL_MS } from "../api";
import type {
  AlertRecord, DashboardResponse, DeviceSnapshot, DeviceTrend, SensorRecord, TrendPoint
} from "../types";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function formatMetric(value: number | null, unit: string): string {
  if (value === null || Number.isNaN(value)) return "--";
  return `${value.toFixed(1)}${unit}`;
}

function statusLabel(status: DeviceSnapshot["status"]): string {
  if (status === "critical") return "高风险";
  if (status === "warning") return "关注";
  return "稳定";
}

function levelLabel(level: AlertRecord["level"]): string {
  return level === "critical" ? "Critical" : "Warning";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function buildChartGeometry(values: Array<number | null>, width: number, height: number, padding: number) {
  const valid = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value !== null);
  if (!valid.length) return null;
  const min = Math.min(...valid.map((p) => p.value));
  const max = Math.max(...valid.map((p) => p.value));
  const range = max - min || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const stepX = values.length > 1 ? usableWidth / (values.length - 1) : 0;
  const points = valid.map((point) => ({
    x: padding + point.index * stepX,
    y: height - padding - ((point.value - min) / range) * usableHeight,
    value: point.value,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  return { min, max, points, linePath, areaPath, lastValue: points[points.length - 1].value };
}

function buildHistoryPoints(records: SensorRecord[] | undefined): TrendPoint[] {
  if (!records) return [];
  return records.map((r) => ({
    timestamp: r.timestamp,
    temperature: toNumber(r.sensors.temperature),
    humidity: toNumber(r.sensors.humidity),
  }));
}

function MiniSparkline({ points, tone }: { points: TrendPoint[]; tone: "cyan" | "amber" | "red" }) {
  const values = points.map((p) => p.temperature);
  const geometry = buildChartGeometry(values, 180, 72, 8);
  if (!geometry) return <div className="mini-sparkline empty">No trend</div>;
  return (
    <svg className={`mini-sparkline tone-${tone}`} viewBox="0 0 180 72" preserveAspectRatio="none">
      <path d={geometry.areaPath} className="mini-area" />
      <path d={geometry.linePath} className="mini-line" />
      <circle cx={geometry.points[geometry.points.length - 1].x} cy={geometry.points[geometry.points.length - 1].y} r="3.5" className="mini-dot" />
    </svg>
  );
}

function MetricChart({ title, unit, points, metric, tone }: {
  title: string; unit: string; points: TrendPoint[];
  metric: "temperature" | "humidity"; tone: "cyan" | "amber";
}) {
  const values = points.map((p) => p[metric]);
  const geometry = buildChartGeometry(values, 640, 260, 28);
  const latestPoint = points[points.length - 1];
  const latestValue = latestPoint ? latestPoint[metric] : null;
  return (
    <section className="metric-card">
      <div className="metric-header">
        <div>
          <span className="panel-kicker">{title}</span>
          <h3>{formatMetric(latestValue, unit)}</h3>
        </div>
        <span className={`metric-badge tone-${tone}`}>{points.length} 个采样点</span>
      </div>
      {geometry ? (
        <svg className={`metric-chart tone-${tone}`} viewBox="0 0 640 260" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`gradient-${metric}`} x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <path d={geometry.areaPath} fill={`url(#gradient-${metric})`} />
          <path d={geometry.linePath} className="metric-line" />
          {geometry.points.map((point) => (
            <circle key={`${metric}-${point.x}`} cx={point.x} cy={point.y} r="4" className="metric-dot" />
          ))}
        </svg>
      ) : (
        <div className="panel-empty compact">当前设备暂无可视化数据</div>
      )}
      <div className="metric-footer">
        <span>{geometry ? `区间 ${geometry.min.toFixed(1)}-${geometry.max.toFixed(1)}${unit}` : "等待数据"}</span>
        <span>{latestPoint ? `最后更新 ${formatDate(latestPoint.timestamp)}` : "暂无更新时间"}</span>
      </div>
    </section>
  );
}

function SummaryCards({ dashboard }: { dashboard: DashboardResponse | undefined }) {
  const summary = dashboard?.summary ?? { total_records: 0, avg_temperature: 0, avg_humidity: 0, alert_count: 0, online_devices: 0 };
  const cards = [
    { label: "在线设备", value: summary.online_devices.toString(), accent: "cyan" },
    { label: "累计记录", value: summary.total_records.toString(), accent: "blue" },
    { label: "平均温度", value: `${summary.avg_temperature.toFixed(1)}°C`, accent: "amber" },
    { label: "平均湿度", value: `${summary.avg_humidity.toFixed(1)}%`, accent: "silver" },
    { label: "当前告警", value: summary.alert_count.toString(), accent: "red" },
  ];
  return (
    <section className="summary-grid">
      {cards.map((card) => (
        <article key={card.label} className={`summary-card accent-${card.accent}`}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}

function DevicePanel({ devices, trends, selectedDeviceId, onSelect }: {
  devices: DeviceSnapshot[]; trends: DeviceTrend[];
  selectedDeviceId: string; onSelect: (id: string) => void;
}) {
  if (!devices.length) return <div className="panel-empty">当前没有设备数据。</div>;
  return (
    <div className="device-grid">
      {devices.map((device) => {
        const trend = trends.find((t) => t.device_id === device.device_id)?.points ?? [];
        const tone = device.status === "critical" ? "red" : device.status === "warning" ? "amber" : "cyan";
        return (
          <button key={device.device_id} type="button"
            className={`device-card ${selectedDeviceId === device.device_id ? "selected" : ""}`}
            onClick={() => onSelect(device.device_id)}
          >
            <div className="device-card-head">
              <div>
                <span className="device-id">{device.device_id}</span>
                <p>{formatDate(device.timestamp)}</p>
              </div>
              <span className={`status-pill status-${device.status}`}>{statusLabel(device.status)}</span>
            </div>
            <div className="device-metrics">
              <div><span>温度</span><strong>{formatMetric(device.temperature, "°C")}</strong></div>
              <div><span>湿度</span><strong>{formatMetric(device.humidity, "%")}</strong></div>
            </div>
            <MiniSparkline points={trend} tone={tone} />
          </button>
        );
      })}
    </div>
  );
}

function AlertPanel({ alerts }: { alerts: AlertRecord[] }) {
  if (!alerts.length) return <div className="panel-empty">当前没有触发告警，系统处于稳定窗口。</div>;
  return (
    <div className="alert-list">
      {alerts.map((alert) => (
        <article key={`${alert.device_id}-${alert.metric}-${alert.created_at}`} className={`alert-card ${alert.level}`}>
          <div className="alert-card-head">
            <span className="alert-level">{levelLabel(alert.level)}</span>
            <span>{formatDate(alert.event_at)}</span>
          </div>
          <h3>{alert.message}</h3>
          <div className="alert-meta">
            <span>{alert.device_id}</span>
            <span>{alert.current_value.toFixed(1)} / {alert.threshold.toFixed(1)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"], queryFn: fetchDashboard,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const devices = dashboardQuery.data?.devices ?? [];
  const trends = dashboardQuery.data?.trends.series ?? [];
  const selectedFallbackId = selectedDeviceId || dashboardQuery.data?.trends.selected_device_id || devices[0]?.device_id || "";

  useEffect(() => {
    if (!selectedDeviceId && selectedFallbackId) {
      startTransition(() => setSelectedDeviceId(selectedFallbackId));
    }
  }, [selectedDeviceId, selectedFallbackId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  const activeDeviceId = selectedFallbackId;
  const activeTrend = trends.find((t) => t.device_id === activeDeviceId)?.points ?? [];

  const historyQuery = useQuery({
    queryKey: ["device-history", activeDeviceId],
    queryFn: () => fetchDeviceHistory(activeDeviceId),
    enabled: Boolean(activeDeviceId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const historyPoints = buildHistoryPoints(historyQuery.data);
  const chartPoints = historyPoints.length ? historyPoints : activeTrend;
  const dashboardState = !isOnline ? "offline" : dashboardQuery.isError ? "error" : dashboardQuery.isLoading ? "loading" : "live";
  const lastSynced = dashboardQuery.dataUpdatedAt ? new Date(dashboardQuery.dataUpdatedAt).toLocaleTimeString("zh-CN") : "--";

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-left" />
      <div className="backdrop backdrop-right" />
      <div className="dashboard">
        <section className="masthead">
          <div className="masthead-copy">
            <span className="eyebrow">Cold Chain Control Tower</span>
            <h1>冷链运输态势总览</h1>
            <p>围绕设备健康、异常告警和温湿度趋势构建的一体化本地演示原型。</p>
          </div>
          <div className="masthead-meta">
            <span className={`status-chip state-${dashboardState}`}>{dashboardState}</span>
            <span className="sync-text">最后同步 {lastSynced}</span>
          </div>
        </section>
        <SummaryCards dashboard={dashboardQuery.data} />
        <section className="dashboard-grid">
          <article className="panel panel-devices">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Fleet Grid</span>
                <h2>设备态势</h2>
              </div>
              <span className="panel-footnote">点击卡片切换趋势分析设备</span>
            </div>
            <DevicePanel devices={devices} trends={trends} selectedDeviceId={activeDeviceId} onSelect={(id) => startTransition(() => setSelectedDeviceId(id))} />
          </article>
          <article className="panel panel-alerts">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Incident Desk</span>
                <h2>告警指挥</h2>
              </div>
              <span className="panel-footnote">{(dashboardQuery.data?.alerts ?? []).length} 条近端异常</span>
            </div>
            <AlertPanel alerts={dashboardQuery.data?.alerts ?? []} />
          </article>
        </section>
        <section className="trend-layout">
          <article className="panel trend-hero">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Selected Device</span>
                <h2>{devices.find((d) => d.device_id === activeDeviceId)?.device_id || "等待设备数据"}</h2>
              </div>
              <div className="device-detail-strip">
                {(() => {
                  const d = devices.find((dev) => dev.device_id === activeDeviceId);
                  return <>{d ? <><span>{formatMetric(d.temperature, "°C")}</span><span>{formatMetric(d.humidity, "%")}</span><span>{statusLabel(d.status)}</span></> : <span>未连接</span>}</>;
                })()}
              </div>
            </div>
            {dashboardQuery.isError ? (
              <div className="panel-empty">接口请求失败，请确认后端服务已经启动。</div>
            ) : chartPoints.length ? (
              <div className="metric-grid">
                <MetricChart title="温度走势" unit="°C" points={chartPoints} metric="temperature" tone="cyan" />
                <MetricChart title="湿度走势" unit="%" points={chartPoints} metric="humidity" tone="amber" />
              </div>
            ) : (
              <div className="panel-empty">当前没有历史曲线数据。</div>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}
