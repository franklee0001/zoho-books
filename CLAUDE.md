# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Python ETL pipeline that exports invoice data from Zoho Books API (OAuth 2.0), stores as JSONL, and loads/transforms into Postgres/Supabase.

## Common Commands

```bash
# Setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Export from Zoho API to JSONL
python export.py --resources contacts,items,invoices --out data/raw

# Load raw JSONL into Postgres
python scripts/load_raw_invoices.py --src data/raw/<timestamp>/invoices.jsonl

# Transform raw data into normalized tables
python scripts/transform_invoices.py

# Local Postgres via Docker
docker compose up -d
docker compose exec -T postgres psql -U zoho -d zoho -f migrations/001_init.sql

# Utility scripts
python scripts/04_sample_fetch.py --invoice-id <id>
python scripts/05_resource_probe.py
python scripts/06_sample_view.py [--json|--table|--csv]
python scripts/07_monthly_invoices.py --month 2026-01
python scripts/08_invoice_line_items.py
```

No test suite or linter is configured.

## Architecture

**Three-stage pipeline:**

1. **API Export** (`export.py` → `zoho_client.py` → `zoho_auth.py`): Paginated Zoho API calls with OAuth refresh, exponential backoff, and rate limiting. Outputs JSONL to `data/raw/<timestamp>/`.

2. **Raw Loading** (`scripts/load_raw_invoices.py`): Parses JSONL and batch-upserts into `invoice_raw` table. Handles multiple timestamp formats.

3. **Transformation** (`scripts/transform_invoices.py`): Normalizes `invoice_raw` into `invoices`, `customers`, and `invoice_addresses` tables via deduplication and upsert.

**Key modules:**
- `zoho_auth.py` — OAuth 2.0 token refresh flow
- `zoho_client.py` — API client with retry/backoff, pagination (generator-based), rate limit handling
- `export.py` — Orchestrates multi-resource export, generates `summary.json`

## Database

- **Driver:** psycopg v3 (not psycopg2) — use `psycopg[binary]`, `Json()` wrapper with custom `dumps` for datetime serialization
- **Schema:** defined in `migrations/001_init.sql` — tables: `invoice_raw`, `invoices`, `customers`, `invoice_addresses`
- **Upserts:** All writes use ON CONFLICT for idempotency, batched (500-1000 rows)
- **Connection:** env vars `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE`

## Conventions

- Environment variables loaded via `python-dotenv` from `.env` (see `.env.example`)
- Sensitive values masked in output (token, secret, refresh, access)
- Default timezone: Asia/Seoul (`zoneinfo`)
- Scripts numbered by workflow order (01–08)
- Invoice payments endpoint requires probing (global vs per-invoice)

## Working Rules

- 코드 수정 전 반드시 현재 상태 분석과 변경 계획을 먼저 제시한다.
- 추측하지 않는다. 설명할 때 반드시 파일 경로(`export.py:42` 등)를 근거로 제시한다.
- `.env` 비밀값은 절대 출력하지 않는다. 키 이름(예: `PGPASSWORD`)만 언급한다.
- 큰 작업은 Agent Teams로 역할을 분리한다: ETL / Frontend / Ops.
- 작업 완료 후 변경된 파일 목록과 실행/검증 방법을 요약한다.
- 한국어로 설명하되, 코드와 명령어는 영어 그대로 유지한다.

## MCP Usage

Use configured MCP servers when helpful:
- Notion: requirement docs / notes
- Vercel: deployment/project status
- Sentry: error investigation

Before asking for manual copy/paste, check whether MCP can retrieve the info.

## Read First Order

When starting a new session, inspect in this order:
1. CLAUDE.md
2. README.md (if exists)
3. requirements.txt / pyproject.toml
4. .env.example
5. export.py
6. zoho_client.py / zoho_auth.py
7. scripts/load_raw_invoices.py
8. scripts/transform_invoices.py
9. migrations/001_init.sql

## Definition of Done

For any code change, Claude should:
1. Explain what changed and why
2. List changed files
3. Provide exact commands to run/verify
4. Mention risks or follow-up tasks