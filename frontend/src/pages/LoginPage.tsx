import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api";
import { useAuth } from "../AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await register(username, password);
        // auto login after register
        const res = await login(username, password);
        setAuth(res.token, res.user);
      } else {
        const res = await login(username, password);
        setAuth(res.token, res.user);
      }
      navigate("/");
    } catch (err: any) {
      setError(err.message || "操作失败");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>冷链数据监测平台</h1>
        <p className="login-subtitle">Cold Chain Control Tower</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text" placeholder="用户名" value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password" placeholder="密码" value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit">{isRegister ? "注册" : "登录"}</button>
        </form>
        <p className="login-toggle" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
        </p>
        <p className="login-hint">默认管理员: admin / admin123</p>
      </div>
    </div>
  );
}
