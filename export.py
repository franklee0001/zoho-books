import argparse
import json
import os
import time
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Tuple

from zoho_client import ZohoClient

RESOURCE_CONFIG = {
    "contacts": {"path": "/invoice/v3/contacts", "list_key": "contacts"},
    "items": {"path": "/invoice/v3/items", "list_key": "items"},
    "invoices": {"path": "/invoice/v3/invoices", "list_key": "invoices"},
    "customer_payments": {"path": "/invoice/v3/customerpayments", "list_key": "customerpayments"},
}

def parse_resources(raw: str) -> List[str]:
    if not raw:
        return []
    items = []
    for part in raw.split(","):
        name = part.strip()
        if not name:
            continue
        if name == "payments":
            name = "invoice_payments"
        items.append(name)
    return items

def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def write_jsonl(path: str, records: Iterable[Dict[str, object]]) -> int:
    count = 0
    with open(path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=True))
            f.write("\n")
            count += 1
    return count

def fetch_invoice_ids(client: ZohoClient, per_page: int) -> List[str]:
    invoice_ids: List[str] = []
    for _, invoices in client.get_paginated(
        "/invoice/v3/invoices", params=None, list_key="invoices", per_page=per_page
    ):
        for invoice in invoices:
            invoice_id = invoice.get("invoice_id")
            if invoice_id:
                invoice_ids.append(str(invoice_id))
    return invoice_ids

def probe_invoice_payments_endpoint(
    client: ZohoClient, invoice_ids: List[str]
) -> Optional[Dict[str, object]]:
    candidates = [
        {
            "mode": "global",
            "path_template": "/invoice/v3/invoices/payments",
            "list_key": "payments",
            "invoice_id_param": True,
        },
        {
            "mode": "per_invoice",
            "path_template": "/invoice/v3/invoices/{invoice_id}/payments",
            "list_key": "payments",
            "invoice_id_param": False,
        },
    ]

    test_ids = invoice_ids[:3]
    for candidate in candidates:
        for invoice_id in test_ids:
            path = candidate["path_template"].format(invoice_id=invoice_id)
            params = {"per_page": 1, "page": 1}
            if candidate.get("invoice_id_param"):
                params["invoice_id"] = invoice_id
            try:
                payload = client.request("GET", path, params=params, max_retries=1)
            except RuntimeError:
                continue
            if candidate["list_key"] in payload:
                return candidate
    return None

def export_resource(
    client: ZohoClient,
    resource: str,
    output_dir: str,
    per_page: int,
    since: Optional[str],
    invoice_ids: Optional[List[str]],
) -> Tuple[int, List[str]]:
    errors: List[str] = []
    count = 0
    file_path = os.path.join(output_dir, f"{resource}.jsonl")

    if resource == "invoice_payments":
        if not invoice_ids:
            invoice_ids = fetch_invoice_ids(client, per_page=per_page)

        candidate = probe_invoice_payments_endpoint(client, invoice_ids)
        if not candidate:
            errors.append("invoice_payments: unable to determine endpoint")
            return 0, errors

        if candidate["mode"] == "global":
            params = {}
            if since:
                params["last_modified_time"] = since
            total = 0
            with open(file_path, "w", encoding="utf-8") as f:
                for page, payments in client.get_paginated(
                    candidate["path_template"],
                    params=params,
                    list_key=candidate["list_key"],
                    per_page=per_page,
                ):
                    for payment in payments:
                        f.write(json.dumps(payment, ensure_ascii=True))
                        f.write("\n")
                        total += 1
                    print(f"invoice_payments: page {page}, total {total}")
            return total, errors

        total = 0
        invoice_total = len(invoice_ids)
        with open(file_path, "w", encoding="utf-8") as f:
            for idx, invoice_id in enumerate(invoice_ids, start=1):
                params = {}
                if since:
                    params["last_modified_time"] = since
                for page, payments in client.get_paginated(
                    candidate["path_template"].format(invoice_id=invoice_id),
                    params=params,
                    list_key=candidate["list_key"],
                    per_page=per_page,
                ):
                    for payment in payments:
                        f.write(json.dumps(payment, ensure_ascii=True))
                        f.write("\n")
                        total += 1
                    print(f"invoice_payments: invoice {idx}/{invoice_total} page {page}, total {total}")
        return total, errors

    config = RESOURCE_CONFIG.get(resource)
    if not config:
        errors.append(f"{resource}: unsupported resource")
        return 0, errors

    params = {}
    if since:
        params["last_modified_time"] = since

    total = 0
    with open(file_path, "w", encoding="utf-8") as f:
        for page, items in client.get_paginated(
            config["path"],
            params=params,
            list_key=config["list_key"],
            per_page=per_page,
        ):
            for item in items:
                if resource == "invoices" and invoice_ids is not None:
                    invoice_id = item.get("invoice_id")
                    if invoice_id:
                        invoice_ids.append(str(invoice_id))
                f.write(json.dumps(item, ensure_ascii=True))
                f.write("\n")
                total += 1
            print(f"{resource}: page {page}, total {total}")

    return total, errors

def main() -> None:
    parser = argparse.ArgumentParser(description="Export Zoho Invoice resources to JSONL.")
    parser.add_argument("--out", default="data/raw", help="Base output directory.")
    parser.add_argument(
        "--resources",
        default="contacts,items,invoices",
        help="Comma-separated resources: contacts,items,invoices,invoice_payments,customer_payments",
    )
    parser.add_argument("--since", default="none", help="Optional since filter, or 'none'.")
    parser.add_argument("--per-page", type=int, default=200, help="Pagination size (default 200).")
    args = parser.parse_args()

    resources = parse_resources(args.resources)
    since = None if args.since.lower() == "none" else args.since

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(args.out, timestamp)
    ensure_dir(output_dir)

    client = ZohoClient()
    start = time.time()

    invoice_ids: List[str] = []
    counts: Dict[str, int] = {}
    all_errors: List[str] = []

    for resource in resources:
        try:
            count, errors = export_resource(
                client,
                resource,
                output_dir,
                per_page=args.per_page,
                since=since,
                invoice_ids=invoice_ids,
            )
            counts[resource] = count
            all_errors.extend(errors)
        except RuntimeError as exc:
            all_errors.append(f"{resource}: {exc}")

    duration = round(time.time() - start, 2)
    summary = {
        "timestamp": timestamp,
        "output_dir": output_dir,
        "resources": resources,
        "counts": counts,
        "duration_seconds": duration,
        "error_count": len(all_errors),
        "errors": all_errors,
    }

    summary_path = os.path.join(output_dir, "summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=True, indent=2)

    print("Export complete.")
    for resource, count in counts.items():
        print(f"- {resource}: {count} records")
        print(f"  {os.path.join(output_dir, f'{resource}.jsonl')}")
    print(f"Summary: {summary_path}")

if __name__ == "__main__":
    main()
