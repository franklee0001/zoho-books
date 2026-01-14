import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

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


def build_headers(access_token: str, org_id: Optional[str], include_org: bool) -> Dict[str, str]:
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
    }
    if include_org:
        if not org_id:
            raise RuntimeError("Missing env: ZOHO_ORG_ID")
        headers["X-com-zoho-invoice-organizationid"] = org_id
    return headers


def request_json(
    method: str,
    url: str,
    headers: Dict[str, str],
    params: Optional[Dict[str, object]] = None,
) -> Tuple[int, Optional[Dict[str, object]]]:
    response = requests.request(method, url, headers=headers, params=params, timeout=30)
    status_code = response.status_code
    try:
        payload = response.json()
    except ValueError:
        return status_code, None

    return status_code, payload


def fetch_resource_sample(
    resource: Dict[str, object],
    api_domain: str,
    org_id: Optional[str],
    access_token: str,
    base_dir: Path,
) -> None:
    include_org = bool(resource.get("needs_org_header", True))
    headers = build_headers(access_token, org_id, include_org)

    list_params = {"per_page": 1, "page": 1}
    list_params.update(resource.get("list_params", {}))

    list_url = f"{api_domain}{resource['list_path']}"
    list_status, list_payload = request_json("GET", list_url, headers=headers, params=list_params)
    if list_status < 200 or list_status >= 300 or list_payload is None:
        print(f"Failed {resource['name']}: HTTP {list_status} for {list_url}")
        return

    list_key = resource["list_key"]
    items = list_payload.get(list_key, [])
    if not items:
        output_path = base_dir / f"{resource['name']}.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump(list_payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

        print(list_status)
        print(str(output_path))
        return

    id_field = resource["id_field"]
    item_id = items[0].get(id_field)
    if not item_id:
        print(f"Failed {resource['name']}: HTTP {list_status} for {list_url}")
        return

    detail_url = f"{api_domain}{resource['detail_path'].format(id=item_id)}"
    status_code, detail_payload = request_json("GET", detail_url, headers=headers)
    if status_code < 200 or status_code >= 300 or detail_payload is None:
        print(f"Failed {resource['name']}: HTTP {status_code} for {detail_url}")
        return

    output_path = base_dir / f"{resource['name']}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(detail_payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(status_code)
    print(str(output_path))


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Zoho Invoice samples (list -> detail).")
    parser.add_argument(
        "--extra",
        default="",
        help="Comma-separated extra resources: payments,creditnotes,estimates,salesorders,purchaseorders,bills",
    )
    args = parser.parse_args()

    api_domain = os.getenv("ZOHO_API_DOMAIN", "https://www.zohoapis.com").rstrip("/")
    org_id = require_env("ZOHO_ORG_ID")
    access_token = get_access_token()

    base_resources = [
        {
            "name": "organizations",
            "list_path": "/invoice/v3/organizations",
            "list_key": "organizations",
            "id_field": "organization_id",
            "detail_path": "/invoice/v3/organizations/{id}",
            "needs_org_header": False,
        },
        {
            "name": "contacts",
            "list_path": "/invoice/v3/contacts",
            "list_key": "contacts",
            "id_field": "contact_id",
            "detail_path": "/invoice/v3/contacts/{id}",
        },
        {
            "name": "items",
            "list_path": "/invoice/v3/items",
            "list_key": "items",
            "id_field": "item_id",
            "detail_path": "/invoice/v3/items/{id}",
        },
        {
            "name": "invoices",
            "list_path": "/invoice/v3/invoices",
            "list_key": "invoices",
            "id_field": "invoice_id",
            "detail_path": "/invoice/v3/invoices/{id}",
        },
    ]

    extra_resource_map = {
        "payments": {
            "name": "payments",
            "list_path": "/invoice/v3/payments",
            "list_key": "payments",
            "id_field": "payment_id",
            "detail_path": "/invoice/v3/payments/{id}",
            "list_params": {"per_page": 1, "page": 1},
        },
        "creditnotes": {
            "name": "creditnotes",
            "list_path": "/invoice/v3/creditnotes",
            "list_key": "creditnotes",
            "id_field": "creditnote_id",
            "detail_path": "/invoice/v3/creditnotes/{id}",
        },
        "estimates": {
            "name": "estimates",
            "list_path": "/invoice/v3/estimates",
            "list_key": "estimates",
            "id_field": "estimate_id",
            "detail_path": "/invoice/v3/estimates/{id}",
        },
        "salesorders": {
            "name": "salesorders",
            "list_path": "/invoice/v3/salesorders",
            "list_key": "salesorders",
            "id_field": "salesorder_id",
            "detail_path": "/invoice/v3/salesorders/{id}",
        },
        "purchaseorders": {
            "name": "purchaseorders",
            "list_path": "/invoice/v3/purchaseorders",
            "list_key": "purchaseorders",
            "id_field": "purchaseorder_id",
            "detail_path": "/invoice/v3/purchaseorders/{id}",
        },
        "bills": {
            "name": "bills",
            "list_path": "/invoice/v3/bills",
            "list_key": "bills",
            "id_field": "bill_id",
            "detail_path": "/invoice/v3/bills/{id}",
        },
    }

    extras = [name.strip() for name in args.extra.split(",") if name.strip()]
    extra_resources = [extra_resource_map[name] for name in extras if name in extra_resource_map]
    resources = base_resources + extra_resources

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_dir = Path("data") / "samples" / timestamp

    for resource in resources:
        try:
            fetch_resource_sample(resource, api_domain, org_id, access_token, base_dir)
        except Exception:
            print(f"Failed {resource['name']}: HTTP 000 for {api_domain}{resource['list_path']}")


if __name__ == "__main__":
    main()
