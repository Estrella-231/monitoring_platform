import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, fetchDevices } from "../api";
import type { AlertRule } from "../types";

export default function AlertRulesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ device_id: "*", metric: "temperature", warning_threshold: 10, critical_threshold: 15, enabled: true });

  const { data: rules = [] } = useQuery({ queryKey: ["alert-rules"], queryFn: fetchAlertRules });
  const { data: devices = [] } = useQuery({ queryKey: ["devices"], queryFn: fetchDevices });

  const createMutation = useMutation({
    mutationFn: () => createAlertRule(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["alert-rules"] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: () => updateAlertRule(editing!.id, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["alert-rules"] }); setEditing(null); setShowForm(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlertRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  function startEdit(rule: AlertRule) {
    setEditing(rule);
    setForm({ device_id: rule.device_id, metric: rule.metric, warning_threshold: rule.warning_threshold, critical_threshold: rule.critical_threshold, enabled: rule.enabled });
    setShowForm(true);
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>告警规则配置</h1>
        <button className="btn-primary" onClick={() => { setEditing(null); setForm({ device_id: "*", metric: "temperature", warning_threshold: 10, critical_threshold: 15, enabled: true }); setShowForm(true); }}>新增规则</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "编辑规则" : "新增规则"}</h2>
            <div className="form-grid">
              <label>设备
                <select value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })}>
                  <option value="*">全局（所有设备）</option>
                  {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id} - {d.name}</option>)}
                </select>
              </label>
              <label>指标
                <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
                  <option value="temperature">温度</option>
                  <option value="humidity">湿度</option>
                </select>
              </label>
              <label>告警阈值 <input type="number" step="0.1" value={form.warning_threshold} onChange={(e) => setForm({ ...form, warning_threshold: Number(e.target.value) })} /></label>
              <label>严重阈值 <input type="number" step="0.1" value={form.critical_threshold} onChange={(e) => setForm({ ...form, critical_threshold: Number(e.target.value) })} /></label>
              <label>启用
                <select value={form.enabled ? "true" : "false"} onChange={(e) => setForm({ ...form, enabled: e.target.value === "true" })}>
                  <option value="true">启用</option>
                  <option value="false">禁用</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn-primary" onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}>{editing ? "保存" : "创建"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>设备</th><th>指标</th><th>告警阈值</th><th>严重阈值</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.device_id === "*" ? "全局" : rule.device_id}</td>
                <td>{rule.metric === "temperature" ? "温度" : "湿度"}</td>
                <td>{rule.warning_threshold}</td>
                <td>{rule.critical_threshold}</td>
                <td><span className={`status-pill status-${rule.enabled ? "normal" : "warning"}`}>{rule.enabled ? "启用" : "禁用"}</span></td>
                <td className="table-actions">
                  <button className="btn-sm" onClick={() => startEdit(rule)}>编辑</button>
                  <button className="btn-sm btn-danger" onClick={() => { if (confirm("确定删除?")) deleteMutation.mutate(rule.id); }}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
