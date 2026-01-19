# Zoho Invoice Export Tools

## Setup
1) Copy `.env.example` to `.env` and fill in values.
2) Keep `.env` local only (never commit).

Required keys:
- ZOHO_ACCOUNTS_URL
- ZOHO_CLIENT_ID
- ZOHO_CLIENT_SECRET
- ZOHO_REFRESH_TOKEN
- ZOHO_ORG_ID

Optional:
- ZOHO_API_DOMAIN (default: https://www.zohoapis.com)

## Run
1) Activate venv:
   - `.\.venv\Scripts\Activate.ps1`
2) Install deps:
   - `python -m pip install -r requirements.txt`
3) Export:
   - `python export.py --resources contacts,items,invoices --out data/raw`
4) Fetch sample JSON:
   - `python scripts/04_sample_fetch.py --invoice-id ... --contact-id ... --item-id ...`
   - Uses refresh token flow; no `ZOHO_ACCESS_TOKEN` required.
5) Probe multiple resources (list -> detail -> save one sample):
   - `python scripts/05_resource_probe.py`

## Notes
- `data/raw` can contain sensitive customer data. Do not share externally.

## macOS/Windows Quick Run
- `python -m venv .venv`
- Activate:
  - macOS: `source .venv/bin/activate`
  - Windows: `.\.venv\Scripts\Activate.ps1`
- `python -m pip install -r requirements.txt`
- `cp .env.example .env` and fill in required keys
- Export: `python export.py --resources contacts,items,invoices --out data/raw`
- Sample fetch: `python scripts/04_sample_fetch.py --invoice-id ... --contact-id ... --item-id ...`
- Resource probe: `python scripts/05_resource_probe.py`
- Resource probe with extras:
  - `python scripts/05_resource_probe.py --extra payments,creditnotes,estimates,salesorders,purchaseorders,bills`
- Monthly invoices: `python scripts/07_monthly_invoices.py --month 2026-01`
- `data/` is local-only (do not commit)

Notes:
- `scripts/05_resource_probe.py` defaults to organizations, contacts, items, invoices.
- Uses refresh token flow; no `ZOHO_ACCESS_TOKEN` required.

## View sample data
- Summary (latest samples): `python scripts/06_sample_view.py`
- Summary (specific folder): `python scripts/06_sample_view.py --dir data/samples/20260114_235147`
- JSON output: `python scripts/06_sample_view.py --json`
- Tables for list bodies: `python scripts/06_sample_view.py --table`
- Join table (invoice + line_items_count): `python scripts/06_sample_view.py --join-table`
- CSV export: `python scripts/06_sample_view.py --csv`
- Masks secret-like keys (token/secret/refresh/access) when printing.

## Monthly invoices
Uses existing `data/raw/<timestamp>/invoices.jsonl` exports only (no API calls, no secrets needed once data exists).

- macOS/Windows common flow:
  - `python -m venv .venv`
  - `python -m pip install -r requirements.txt`
  - `python export.py --resources invoices,contacts,items --out data/raw`
  - `python scripts/07_monthly_invoices.py --month 2026-01`
- Default month (Asia/Seoul): `python scripts/07_monthly_invoices.py`
- Custom source:
  - `python scripts/07_monthly_invoices.py --month 2026-01 --src data/raw/20260114_235147/invoices.jsonl`
- Custom output directory:
  - `python scripts/07_monthly_invoices.py --month 2026-01 --outdir data/raw/20260114_235147/out`

## Postgres invoice pipeline
Loads raw invoices JSONL into Postgres and upserts normalized tables.

Never commit `.env` (secrets must stay local).

### Supabase 사용 (권장)
Direct host DNS가 실패하면 Session pooler만 사용한다.
Pooler username은 반드시 <role>.<project-ref> 형식이다.
chmod +x scripts/supabase_bootstrap.sh 를 실행한다.
./scripts/supabase_bootstrap.sh 를 실행한다.
스크립트에 project ref와 owner 비밀번호를 입력한다.
psql 프롬프트에서 zoho_ingest 비밀번호를 입력한다.
invoices.jsonl 경로를 입력하면 로더/트랜스폼이 실행된다.
비밀번호가 노출되면 즉시 교체하고 .env는 커밋하지 않는다.

검증 SQL (Supabase psql 예시):
- `psql "sslmode=require host=db.<project-ref>.supabase.co port=5432 dbname=postgres user=zoho_ingest password=REPLACE_WITH_STRONG_PASSWORD" -c "select count(*) from invoice_raw;"`
- `psql "sslmode=require host=db.<project-ref>.supabase.co port=5432 dbname=postgres user=zoho_ingest password=REPLACE_WITH_STRONG_PASSWORD" -c "select count(*) from invoices;"`
- `psql "sslmode=require host=db.<project-ref>.supabase.co port=5432 dbname=postgres user=zoho_ingest password=REPLACE_WITH_STRONG_PASSWORD" -c "select invoice_id,count(*) from invoices group by invoice_id having count(*)>1;"`
- `psql "sslmode=require host=db.<project-ref>.supabase.co port=5432 dbname=postgres user=zoho_ingest password=REPLACE_WITH_STRONG_PASSWORD" -c "select sum(balance) from invoices where status='overdue';"`
- `psql "sslmode=require host=db.<project-ref>.supabase.co port=5432 dbname=postgres user=zoho_ingest password=REPLACE_WITH_STRONG_PASSWORD" -c "select customer_name,sum(balance) from invoices where balance>0 group by customer_name order by sum(balance) desc limit 20;"`

### Docker 사용 (옵션)
1) Start Postgres:
   - `docker compose up -d`
2) Run migrations:
   - `docker compose exec -T postgres psql -U zoho -d zoho -f migrations/001_init.sql`
3) Export data (JSONL):
   - `python export.py --resources invoices,contacts,items --out data/raw`
4) Load raw invoices:
   - `python scripts/load_raw_invoices.py --src data/raw/<timestamp>/invoices.jsonl`
5) Transform to normalized tables:
   - `python scripts/transform_invoices.py`

Environment variables (Supabase 권장):
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSLMODE` (default: require)

Note: This repo uses psycopg v3; psycopg2 extras are not available.
JSON values are serialized with default=str to handle datetime objects.
