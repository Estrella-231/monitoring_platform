import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDevices, createDevice, updateDevice, deleteDevice } from "../api";
import type { DeviceInfo } from "../types";

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DeviceInfo | null>(null);
  const [form, setForm] = useState({ device_id: "", name: "", model: "", location: "", install_date: "" });
  const [showForm, setShowForm] = useState(false);

  const { data: devices = [], isLoading } = useQuery({ queryKey: ["devices"], queryFn: fetchDevices });

  const createMutation = useMutation({
    mutationFn: () => createDevice(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["devices"] }); setShowForm(false); resetForm(); },
  });
  const updateMutation = useMutation({
    mutationFn: () => updateDevice(editing!.device_id, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["devices"] }); setEditing(null); resetForm(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  function resetForm() { setForm({ device_id: "", name: "", model: "", location: "", install_date: "" }); }

  function startEdit(d: DeviceInfo) {
    setEditing(d);
    setForm({ device_id: d.device_id, name: d.name, model: d.model, location: d.location, install_date: d.install_date });
    setShowForm(true);
  }

  function startAdd() {
    setEditing(null);
    resetForm();
    setShowForm(true);
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>设备管理</h1>
        <button className="btn-primary" onClick={startAdd}>新增设备</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "编辑设备" : "新增设备"}</h2>
            <div className="form-grid">
              <label>设备ID <input value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} disabled={!!editing} /></label>
              <label>名称 <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>型号 <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
              <label>位置 <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
              <label>安装日期 <input type="date" value={form.install_date} onChange={(e) => setForm({ ...form, install_date: e.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowForm(false); setEditing(null); }}>取消</button>
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
              <tr><th>设备ID</th><th>名称</th><th>型号</th><th>位置</th><th>安装日期</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.device_id}>
                  <td><code>{d.device_id}</code></td>
                  <td>{d.name}</td>
                  <td>{d.model}</td>
                  <td>{d.location}</td>
                  <td>{d.install_date}</td>
                  <td><span className={`status-pill status-${d.status === "active" ? "normal" : "warning"}`}>{d.status}</span></td>
                  <td className="table-actions">
                    <button className="btn-sm" onClick={() => startEdit(d)}>编辑</button>
                    <button className="btn-sm btn-danger" onClick={() => { if (confirm("确定删除?")) deleteMutation.mutate(d.device_id); }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
