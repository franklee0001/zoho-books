# Zoho Invoice Export Tools

## Setup
1) Copy `.env.example` to `.env` and fill in values.
2) Keep `.env` local only (never commit).

Required keys:
- ZOHO_ACCOUNTS_URL
- ZOHO_CLIENT_ID
- ZOHO_CLIENT_SECRET
- ZOHO_REFRESH_TOKEN
- ZOHO_API_DOMAIN
- ZOHO_ORG_ID

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

## Notes
- `data/raw` can contain sensitive customer data. Do not share externally.

## Continue On macOS
- `python3 -m venv .venv`
- `source .venv/bin/activate`
- `pip install -r requirements.txt`
- `cp .env.example .env` and fill in required keys
- Export: `python export.py --resources contacts,items,invoices --out data/raw`
- Sample fetch: `python scripts/04_sample_fetch.py --invoice-id ... --contact-id ... --item-id ...` (no `ZOHO_ACCESS_TOKEN` required)
- `data/` is local-only (do not commit)
