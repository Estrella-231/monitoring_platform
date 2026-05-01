# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

冷链数据监测平台 (Cold Chain Data Monitoring Platform) — a prototype control tower for cold chain logistics. Three-tier architecture: sensor data ingestion → alerting → visualization.

## Architecture

```
sensor/collector.py  ──POST──▶  backend/main.py (FastAPI)  ◀──GET──  frontend/ (React + Vite)
   (DHT11 or mock)                in-memory lists                       TanStack Query polling
                                  + threshold alerts                    hand-drawn SVG charts
```

- **Backend** (`backend/main.py`): Single-file FastAPI app (~416 lines). Routes, Pydantic models, business logic (threshold alerting, stats), and storage (in-memory Python lists) all in one file. No database — data lost on restart.
- **Frontend** (`frontend/src/`): React 18 + TypeScript + Vite. `App.tsx` is the main dashboard (~418 lines). Uses `@tanstack/react-query` for polling-based data fetching. Charts are hand-crafted SVGs (no charting library). Five sections: masthead, summary cards, device fleet grid, alert panel, trend charts.
- **Sensor** (`sensor/collector.py`): Supports DHT11 via Raspberry Pi or mock mode (sine-wave data). Uploads to backend via HTTP POST with retry logic (3 attempts).

## Commands

### Backend

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
source .venv/bin/activate && python3 backend/main.py   # http://localhost:8000, Swagger at /docs
source .venv/bin/activate && pytest                     # 5 integration tests in tests/test_api.py
```

### Frontend

```bash
cd frontend && npm install
npm run dev      # http://localhost:5173
npm run build    # tsc && vite build (type-check + production build)
```

### Sensor (optional)

```bash
source .venv/bin/activate && python3 sensor/collector.py   # mock mode by default
```

## Configuration

Copy `.env.example` to `.env`. Key vars:

| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_DEMO_SEED` | `true` | Seeds 4 devices with 12 synthetic data points on startup |
| `ENABLE_DEV_TOOLS` | `true` | Enables `DELETE /api/clear` (dangerous in production) |
| `TEMP_THRESHOLD` / `HUMIDITY_THRESHOLD` | `10` / `90` | Alert thresholds |
| `VITE_REFRESH_INTERVAL_MS` | `5000` | Frontend polling interval |
| `SENSOR_MOCK_MODE` | `true` | Collector uses mock data instead of DHT11 hardware |

## Key Engineering Notes

- **Storage is in-memory**: `sensor_data_store` and `alerts_store` are Python lists. Data is lost on restart. The PROJECT_REVIEW.md recommends PostgreSQL + TimescaleDB.
- **Backend is monolithic**: All routes, models, logic, and storage are in `backend/main.py`. The review recommends splitting into `routers/`, `schemas/`, `services/`, `repositories/`, `core/settings.py`.
- **No auth/security**: CORS allows configured origins, but no authentication, rate limiting, or device signing exists.
- **Tests use dynamic import**: `tests/test_api.py` uses `importlib.import_module` with `monkeypatch` to control demo seed and dev tools. Tests start with clean stores. Keep this pattern when adding tests.
- **Pydantic v1-style Config**: Uses `class Config: extra = Extra.allow`, not `model_config`. The backend depends on `pydantic` v1.x.
- **LEFTOVER**: `PROJECT_REVIEW.md` references an older version that was single-file `frontend/index.html`. The frontend has since been upgraded to React + TypeScript. Ignore references to `frontend/index.html` in the review doc — the actual source is `frontend/src/`.

## API Routes

- `POST /api/sensor/data` — ingest sensor reading
- `GET /api/sensor/data/{device_id}` — device history
- `GET /api/sensor/latest` — latest snapshot per device
- `GET /api/alerts` — recent alerts
- `GET /api/stats` — aggregate statistics
- `GET /api/dashboard` — full dashboard payload (summary + devices + alerts + trends)
- `DELETE /api/clear` — wipe all data (only when `ENABLE_DEV_TOOLS=true`)

## gstack

**Web browsing**: Use gstack's `/browse` skill for ALL web browsing, testing, and site interaction. Never use `mcp__claude-in-chrome__*` tools for web browsing — always use `/browse` from gstack instead.

**Available gstack skills** (invoke via the Skill tool):

| Skill | Use when |
|---|---|
| `/browse` | Open/test websites, take screenshots, verify state, QA dogfooding |
| `/qa` | Test the site, find bugs, verify functionality |
| `/qa-only` | QA check without source code access |
| `/investigate` | Bugs, errors, "why is this broken", 500 errors |
| `/ship` | Ship, deploy, push, create PR |
| `/review` | Code review, check the diff, pre-landing review |
| `/health` | Code quality, health check |
| `/checkpoint` | Save progress, resume later |
| `/plan-ceo-review` | Strategy, scope, ambition, "think bigger" |
| `/plan-eng-review` | Architecture review, design review |
| `/plan-design-review` | UI/UX gap review |
| `/plan-devex-review` | Developer experience review |
| `/autoplan` | Run all review pipeline automatically |
| `/design-consultation` | Design system, brand, visual identity |
| `/design-review` | Visual polish, design audit of live site |
| `/design-shotgun` | Generate multiple design variants |
| `/document-release` | Update docs after shipping |
| `/retro` | Weekly retro, what did we ship |
| `/codex` | Independent second opinion from Codex |
| `/office-hours` | Product ideas, brainstorming, "is this worth building" |
| `/careful` / `/guard` | Safety mode, restricted operation |
| `/freeze` / `/unfreeze` | Restrict/unrestrict edits to a directory |
| `/learn` | Capture learnings during development |
| `/land-and-deploy` | Full land + deploy workflow |
| `/pair-agent` | Pair programming with a second agent |
| `/setup-deploy` | Configure deployment settings |
| `/gstack-upgrade` | Upgrade gstack to latest version |

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review, design review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
