import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests
from dotenv import load_dotenv

from zoho_auth import get_access_token

load_dotenv()


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing env: {name}")
    return value


def resolve_id(arg_value: str, env_name: str) -> str:
    if arg_value:
        return arg_value
    value = os.getenv(env_name)
    if not value:
        raise RuntimeError(f"Missing --{env_name.lower().replace('_', '-')} or env: {env_name}")
    return value


def fetch_and_save(url: str, org_id: str, access_token: str, output_path: Path) -> None:
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "X-com-zoho-invoice-organizationid": org_id,
    }
    response = requests.get(url, headers=headers, timeout=30)
    status_code = response.status_code

    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(f"Non-JSON response (status {status_code})") from exc

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(status_code)
    print(str(output_path))


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Zoho sample resources and save JSON payloads.")
    parser.add_argument("--invoice-id", default=None, help="Invoice ID (default: ZOHO_SAMPLE_INVOICE_ID)")
    parser.add_argument("--contact-id", default=None, help="Contact ID (default: ZOHO_SAMPLE_CONTACT_ID)")
    parser.add_argument("--item-id", default=None, help="Item ID (default: ZOHO_SAMPLE_ITEM_ID)")
    args = parser.parse_args()

    api_domain = os.getenv("ZOHO_API_DOMAIN", "https://www.zohoapis.com").rstrip("/")
    org_id = require_env("ZOHO_ORG_ID")
    access_token = get_access_token()

    invoice_id = resolve_id(args.invoice_id, "ZOHO_SAMPLE_INVOICE_ID")
    contact_id = resolve_id(args.contact_id, "ZOHO_SAMPLE_CONTACT_ID")
    item_id = resolve_id(args.item_id, "ZOHO_SAMPLE_ITEM_ID")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_dir = Path("data") / "samples" / timestamp

    fetch_and_save(
        f"{api_domain}/invoice/v3/invoices/{invoice_id}",
        org_id,
        access_token,
        base_dir / "invoice.json",
    )
    fetch_and_save(
        f"{api_domain}/invoice/v3/contacts/{contact_id}",
        org_id,
        access_token,
        base_dir / "contact.json",
    )
    fetch_and_save(
        f"{api_domain}/invoice/v3/items/{item_id}",
        org_id,
        access_token,
        base_dir / "item.json",
    )


if __name__ == "__main__":
    main()
