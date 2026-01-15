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
