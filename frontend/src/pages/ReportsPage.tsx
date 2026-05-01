import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDailyReport, fetchWeeklyReport, fetchDevices } from "../api";
import type { ReportDaily } from "../types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function fmt(v: number | null, unit: string): string {
  return v != null ? `${v.toFixed(1)}${unit}` : "--";
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"daily" | "weekly">("daily");
  const [reportDate, setReportDate] = useState(today);
  const [weekStart, setWeekStart] = useState(today);
  const [weekEnd, setWeekEnd] = useState(today);
  const [deviceId, setDeviceId] = useState("");

  const { data: devices = [] } = useQuery({ queryKey: ["devices"], queryFn: fetchDevices });
  const selectedDevice = deviceId || devices[0]?.device_id || "";

  const dailyQuery = useQuery({
    queryKey: ["report-daily", reportDate, selectedDevice],
    queryFn: () => fetchDailyReport(reportDate, selectedDevice),
    enabled: mode === "daily" && Boolean(selectedDevice),
  });

  const weeklyQuery = useQuery({
    queryKey: ["report-weekly", weekStart, weekEnd, selectedDevice],
    queryFn: () => fetchWeeklyReport(weekStart, weekEnd, selectedDevice),
    enabled: mode === "weekly" && Boolean(selectedDevice),
  });

  const daily = dailyQuery.data;
  const weeklyData = weeklyQuery.data ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <h1>数据报表</h1>
      </div>

      <div className="filter-bar">
        <label>报表类型
          <select value={mode} onChange={(e) => setMode(e.target.value as "daily" | "weekly")}>
            <option value="daily">日报</option>
            <option value="weekly">周报</option>
          </select>
        </label>
        {mode === "daily" ? (
          <label>日期
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </label>
        ) : (
          <>
            <label>开始日期
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </label>
            <label>结束日期
              <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
            </label>
          </>
        )}
        <label>设备
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">请选择</option>
            {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id} - {d.name}</option>)}
          </select>
        </label>
      </div>

      {mode === "daily" && daily && (
        <div className="report-cards">
          <div className="report-card"><span className="report-label">设备</span><strong>{daily.device_id}</strong></div>
          <div className="report-card"><span className="report-label">日期</span><strong>{daily.date}</strong></div>
          <div className="report-card"><span className="report-label">最高温度</span><strong className="tone-red">{fmt(daily.max_temperature, "°C")}</strong></div>
          <div className="report-card"><span className="report-label">最低温度</span><strong className="tone-cyan">{fmt(daily.min_temperature, "°C")}</strong></div>
          <div className="report-card"><span className="report-label">平均温度</span><strong>{fmt(daily.avg_temperature, "°C")}</strong></div>
          <div className="report-card"><span className="report-label">最高湿度</span><strong>{fmt(daily.max_humidity, "%")}</strong></div>
          <div className="report-card"><span className="report-label">最低湿度</span><strong>{fmt(daily.min_humidity, "%")}</strong></div>
          <div className="report-card"><span className="report-label">平均湿度</span><strong>{fmt(daily.avg_humidity, "%")}</strong></div>
          <div className="report-card"><span className="report-label">告警次数</span><strong className="tone-red">{daily.alert_count}</strong></div>
          <div className="report-card"><span className="report-label">采样点数</span><strong>{daily.sample_count}</strong></div>
        </div>
      )}

      {mode === "weekly" && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>日期</th><th>设备</th><th>最高温度</th><th>最低温度</th><th>平均温度</th><th>最高湿度</th><th>最低湿度</th><th>平均湿度</th><th>告警</th><th>采样</th></tr>
            </thead>
            <tbody>
              {weeklyData.map((r, i) => (
                <tr key={i}>
                  <td>{formatDate(r.date)}</td>
                  <td><code>{r.device_id}</code></td>
                  <td>{fmt(r.max_temperature, "°C")}</td>
                  <td>{fmt(r.min_temperature, "°C")}</td>
                  <td>{fmt(r.avg_temperature, "°C")}</td>
                  <td>{fmt(r.max_humidity, "%")}</td>
                  <td>{fmt(r.min_humidity, "%")}</td>
                  <td>{fmt(r.avg_humidity, "%")}</td>
                  <td><span className="tone-red">{r.alert_count}</span></td>
                  <td>{r.sample_count}</td>
                </tr>
              ))}
              {weeklyData.length === 0 && (
                <tr><td colSpan={10} className="empty-cell">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {mode === "daily" && !daily && !dailyQuery.isLoading && (
        <div className="panel-empty">选择设备和日期后查看日报</div>
      )}
    </div>
  );
}
