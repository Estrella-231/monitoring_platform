# 冷链数据监测平台

面向本地演示和后续扩展的冷链控制塔原型，包含：

- FastAPI 后端接口
- React + TypeScript 前端控制台
- 可运行在硬件或 mock 模式下的采集端脚本

## 环境要求

- Python 3.8+
- Node.js 18+
- npm 9+

## 快速开始

### 1. 安装后端依赖

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

### 3. 配置环境变量

复制模板后按需调整：

```bash
cp .env.example .env
```

默认配置已经适合本地演示：

- 后端启用 demo 数据
- 前端每 5 秒刷新一次
- 采集端默认使用 mock 模式

## 运行方式

### 启动后端

```bash
source .venv/bin/activate
python3 backend/main.py
```

后端默认运行在 `http://localhost:8000`。  
接口文档地址：`http://localhost:8000/docs`

### 启动前端

```bash
cd frontend
npm run dev
```

前端默认运行在 `http://localhost:5173`

### 启动采集端（可选）

```bash
source .venv/bin/activate
python3 sensor/collector.py
```

默认会向 `http://localhost:8000/api/sensor/data` 上报数据。  
如果没有硬件依赖，脚本会使用 mock 模式生成温湿度数据。

## 当前接口

- `POST /api/sensor/data`：接收采集端上报
- `GET /api/sensor/data/{device_id}`：获取单设备历史记录
- `GET /api/sensor/latest`：获取每台设备最新快照
- `GET /api/alerts`：获取最近告警
- `GET /api/stats`：获取统计摘要
- `GET /api/dashboard`：获取首页控制塔聚合数据

## 测试

后端测试：

```bash
source .venv/bin/activate
pytest
```

前端构建检查：

```bash
cd frontend
npm run build
```

## 项目结构

```text
monitoring-platform/
├── backend/              # FastAPI API 与聚合逻辑
├── frontend/             # React + TypeScript 控制塔前端
├── sensor/               # 采集端脚本
├── tests/                # 后端接口测试
├── .env.example          # 环境变量模板
└── requirements.txt      # Python 依赖
```
