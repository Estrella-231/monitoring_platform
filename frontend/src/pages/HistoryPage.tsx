import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryHistory, exportCsvUrl, fetchDevices } from "../api";
import type { SensorRecord } from "../types";

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function sensorValue(r: SensorRecord, key: string): string {
  const v = (r.sensors as any)[key];
  return v != null ? Number(v).toFixed(1) : "--";
}

export default function HistoryPage() {
  const [deviceId, setDeviceId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [limit, setLimit] = useState(100);

  const { data: devices = [] } = useQuery({ queryKey: ["devices"], queryFn: fetchDevices });

  const qParams = {
    ...(deviceId ? { device_id: deviceId } : {}),
    ...(startTime ? { start_time: startTime } : {}),
    ...(endTime ? { end_time: endTime } : {}),
    limit,
  };

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["history", qParams],
    queryFn: () => queryHistory(qParams),
  });

  function handleExport() {
    const url = exportCsvUrl({
      ...(deviceId ? { device_id: deviceId } : {}),
      ...(startTime ? { start_time: startTime } : {}),
      ...(endTime ? { end_time: endTime } : {}),
    });
    window.open(url, "_blank");
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>历史数据查询</h1>
        <button className="btn-primary" onClick={handleExport} disabled={records.length === 0}>导出 CSV</button>
      </div>

      <div className="filter-bar">
        <label>设备
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">全部设备</option>
            {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id} - {d.name}</option>)}
          </select>
        </label>
        <label>开始时间
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>结束时间
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        <label>条数
          <input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        </label>
      </div>

      {isLoading ? <div className="panel-empty">加载中...</div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>时间</th><th>设备</th><th>温度 (°C)</th><th>湿度 (%))</th></tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={`${r.device_id}-${r.timestamp}-${i}`}>
                  <td>{formatTime(r.timestamp)}</td>
                  <td><code>{r.device_id}</code></td>
                  <td>{sensorValue(r, "temperature")}</td>
                  <td>{sensorValue(r, "humidity")}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={4} className="empty-cell">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
