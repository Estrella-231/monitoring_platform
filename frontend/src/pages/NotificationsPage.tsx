import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchChannels, createChannel, updateChannel, deleteChannel } from "../api";
import type { NotificationChannel } from "../types";

const channelTypeLabels: Record<string, string> = {
  email: "邮件", webhook: "Webhook", sms: "短信",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<NotificationChannel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", channel_type: "email", config: "", enabled: true, alert_level: "warning",
  });

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["notification-channels"],
    queryFn: fetchChannels,
  });

  const createMutation = useMutation({
    mutationFn: () => createChannel({
      ...form,
      config: parseConfig(form.config),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-channels"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateChannel(editing!.id, {
      ...form,
      config: parseConfig(form.config),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-channels"] });
      setEditing(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChannel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-channels"] }),
  });

  function parseConfig(raw: string): Record<string, string> {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      return { url: raw };
    } catch {
      return { url: raw };
    }
  }

  function formatConfig(config: Record<string, string>): string {
    try { return JSON.stringify(config, null, 2); } catch { return config?.url || ""; }
  }

  function startEdit(ch: NotificationChannel) {
    setEditing(ch);
    setForm({
      name: ch.name,
      channel_type: ch.channel_type,
      config: formatConfig(ch.config),
      enabled: ch.enabled,
      alert_level: ch.alert_level,
    });
    setShowForm(true);
  }

  function resetForm() {
    setForm({ name: "", channel_type: "email", config: "", enabled: true, alert_level: "warning" });
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>通知渠道</h1>
        <button className="btn-primary" onClick={() => { setEditing(null); resetForm(); setShowForm(true); }}>新增渠道</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "编辑渠道" : "新增渠道"}</h2>
            <div className="form-grid">
              <label>名称
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>类型
                <select value={form.channel_type} onChange={(e) => setForm({ ...form, channel_type: e.target.value })}>
                  <option value="email">邮件</option>
                  <option value="webhook">Webhook</option>
                  <option value="sms">短信</option>
                </select>
              </label>
              <label>配置 (JSON)
                <textarea value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} rows={4} />
              </label>
              <label>告警级别
                <select value={form.alert_level} onChange={(e) => setForm({ ...form, alert_level: e.target.value })}>
                  <option value="warning">Warning 及以上</option>
                  <option value="critical">仅 Critical</option>
                </select>
              </label>
              <label>启用
                <select value={form.enabled ? "true" : "false"} onChange={(e) => setForm({ ...form, enabled: e.target.value === "true" })}>
                  <option value="true">启用</option>
                  <option value="false">禁用</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn-primary" onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}>
                {editing ? "保存" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? <div className="panel-empty">加载中...</div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>名称</th><th>类型</th><th>配置</th><th>告警级别</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id}>
                  <td>{ch.name}</td>
                  <td>{channelTypeLabels[ch.channel_type] || ch.channel_type}</td>
                  <td className="cell-max"><code className="config-preview">{formatConfig(ch.config)}</code></td>
                  <td>{ch.alert_level === "critical" ? "仅 Critical" : "Warning+"}</td>
                  <td><span className={`status-pill status-${ch.enabled ? "normal" : "warning"}`}>{ch.enabled ? "已启用" : "已禁用"}</span></td>
                  <td className="table-actions">
                    <button className="btn-sm" onClick={() => startEdit(ch)}>编辑</button>
                    <button className="btn-sm btn-danger" onClick={() => { if (confirm("确定删除?")) deleteMutation.mutate(ch.id); }}>删除</button>
                  </td>
                </tr>
              ))}
              {channels.length === 0 && (
                <tr><td colSpan={6} className="empty-cell">暂无通知渠道</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
