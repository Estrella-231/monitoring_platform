import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs } from "../api";
import type { AuditLog } from "../types";

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const actionLabels: Record<string, string> = {
  create: "创建", update: "更新", delete: "删除", login: "登录", register: "注册", export: "导出",
};

const resourceLabels: Record<string, string> = {
  device: "设备", alert_rule: "告警规则", sensor_data: "传感器数据", user: "用户",
  settings: "系统设置", notification_channel: "通知渠道",
};

export default function AuditLogsPage() {
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [limit, setLimit] = useState(100);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", { user, action, resource, limit }],
    queryFn: () => fetchAuditLogs({ user: user || undefined, action: action || undefined, resource: resource || undefined, limit }),
  });

  return (
    <div className="page">
      <div className="page-head">
        <h1>审计日志</h1>
      </div>

      <div className="filter-bar">
        <label>用户名
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="筛选用户" />
        </label>
        <label>操作
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">全部</option>
            <option value="create">创建</option>
            <option value="update">更新</option>
            <option value="delete">删除</option>
            <option value="login">登录</option>
            <option value="export">导出</option>
          </select>
        </label>
        <label>资源类型
          <select value={resource} onChange={(e) => setResource(e.target.value)}>
            <option value="">全部</option>
            <option value="device">设备</option>
            <option value="alert_rule">告警规则</option>
            <option value="sensor_data">传感器数据</option>
            <option value="user">用户</option>
            <option value="settings">系统设置</option>
            <option value="notification_channel">通知渠道</option>
          </select>
        </label>
        <label>条数
          <input type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        </label>
      </div>

      {isLoading ? <div className="panel-empty">加载中...</div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>时间</th><th>用户</th><th>操作</th><th>资源</th><th>资源 ID</th><th>详情</th><th>IP</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatTime(log.timestamp)}</td>
                  <td><code>{log.user}</code></td>
                  <td><span className="action-tag">{actionLabels[log.action] || log.action}</span></td>
                  <td>{resourceLabels[log.resource] || log.resource}</td>
                  <td><code>{log.resource_id}</code></td>
                  <td className="cell-max">{log.detail}</td>
                  <td><code className="ip">{log.ip}</code></td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">暂无审计日志</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
