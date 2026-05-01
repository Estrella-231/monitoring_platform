import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "../api";
import type { SystemSettings } from "../types";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SystemSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const mutation = useMutation({
    mutationFn: () => updateSettings(form!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading) return <div className="page"><div className="panel-empty">加载中...</div></div>;

  const current = form ?? settings;

  function setField<K extends keyof SystemSettings>(key: K, value: number) {
    setForm({ ...(current ?? settings)!, [key]: value });
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>系统设置</h1>
        {saved && <span className="save-hint">已保存</span>}
      </div>

      <div className="settings-form">
        <div className="settings-group">
          <h3>数据采集</h3>
          <label>
            <span>上报间隔（秒）</span>
            <input type="number" min={1} max={3600} value={current?.upload_interval_seconds ?? 30}
              onChange={(e) => setField("upload_interval_seconds", Number(e.target.value))} />
          </label>
          <label>
            <span>数据保留天数</span>
            <input type="number" min={1} max={365} value={current?.data_retention_days ?? 90}
              onChange={(e) => setField("data_retention_days", Number(e.target.value))} />
          </label>
          <label>
            <span>在线判定窗口（分钟）</span>
            <input type="number" min={1} max={1440} value={current?.online_window_minutes ?? 5}
              onChange={(e) => setField("online_window_minutes", Number(e.target.value))} />
          </label>
        </div>

        <div className="settings-group">
          <h3>告警阈值</h3>
          <label>
            <span>默认温度阈值 (°C)</span>
            <input type="number" step="0.1" value={current?.default_temp_threshold ?? 10}
              onChange={(e) => setField("default_temp_threshold", Number(e.target.value))} />
          </label>
          <label>
            <span>默认湿度阈值 (%)</span>
            <input type="number" step="0.1" min={0} max={100} value={current?.default_humidity_threshold ?? 90}
              onChange={(e) => setField("default_humidity_threshold", Number(e.target.value))} />
          </label>
        </div>

        <div className="settings-actions">
          <button className="btn-primary" onClick={() => mutation.mutate()}>保存设置</button>
        </div>
      </div>
    </div>
  );
}
