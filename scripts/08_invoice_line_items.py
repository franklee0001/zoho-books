import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from zoho_client import ZohoClient


def find_latest_invoices_jsonl(base_dir: Path) -> Optional[Path]:
    if not base_dir.exists():
        return None
    candidates = []
    for path in base_dir.iterdir():
        if path.is_dir() and path.name and path.name[0].isdigit():
            invoices_path = path / "invoices.jsonl"
            if invoices_path.exists():
                candidates.append(invoices_path)
    if not candidates:
        return None
    return sorted(candidates, key=lambda p: p.parent.name)[-1]


def read_invoice_ids(path: Path) -> List[str]:
    invoice_ids = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict):
                invoice_id = payload.get("invoice_id")
                if invoice_id:
                    invoice_ids.append(str(invoice_id))
    return invoice_ids


def write_jsonl(path: Path, records: Iterable[Dict[str, object]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=True))
            handle.write("\n")
            count += 1
    return count


def export_list_resource(
    client: ZohoClient,
    path: str,
    list_key: str,
    out_path: Path,
    per_page: int,
) -> int:
    total = 0
    with out_path.open("w", encoding="utf-8") as handle:
        for _, items in client.get_paginated(path, params=None, list_key=list_key, per_page=per_page):
            for item in items:
                handle.write(json.dumps(item, ensure_ascii=True))
                handle.write("\n")
                total += 1
    return total


def fetch_invoice_details(
    client: ZohoClient, invoice_ids: List[str]
) -> Iterable[Dict[str, object]]:
    for invoice_id in invoice_ids:
        try:
            payload = client.request("GET", f"/invoice/v3/invoices/{invoice_id}")
        except RuntimeError:
            print(f"Failed invoice {invoice_id}", file=sys.stderr)
            continue
        invoice = payload.get("invoice")
        if isinstance(invoice, dict):
            yield invoice


def flatten_line_items(invoice: Dict[str, object]) -> Iterable[Dict[str, object]]:
    base = {
        "invoice_id": invoice.get("invoice_id"),
        "invoice_number": invoice.get("invoice_number"),
        "customer_id": invoice.get("customer_id"),
        "customer_name": invoice.get("customer_name"),
    }
    line_items = invoice.get("line_items")
    if not isinstance(line_items, list):
        return []
    rows = []
    for item in line_items:
        if not isinstance(item, dict):
            continue
        row = dict(base)
        row.update(item)
        rows.append(row)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build invoice_line_items.jsonl and export items/contacts JSONL."
    )
    parser.add_argument("--src", default=None, help="Path to invoices.jsonl")
    parser.add_argument("--outdir", default=None, help="Output directory (default: src folder)")
    parser.add_argument("--per-page", type=int, default=200, help="Pagination size")
    parser.add_argument("--max-invoices", type=int, default=None, help="Limit invoice detail fetch")
    parser.add_argument("--skip-contacts", action="store_true", help="Skip contacts export")
    parser.add_argument("--skip-items", action="store_true", help="Skip items export")
    args = parser.parse_args()

    base_dir = Path("data") / "raw"
    src_path = Path(args.src) if args.src else find_latest_invoices_jsonl(base_dir)
    if not src_path or not src_path.exists():
        print(
            "No invoices.jsonl found. Run: python export.py --resources invoices --out data/raw",
            file=sys.stderr,
        )
        sys.exit(1)

    out_dir = Path(args.outdir) if args.outdir else src_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    invoice_ids = read_invoice_ids(src_path)
    if args.max_invoices is not None:
        invoice_ids = invoice_ids[: args.max_invoices]
    if not invoice_ids:
        print("No invoice IDs found.", file=sys.stderr)
        sys.exit(1)

    client = ZohoClient()

    line_items_path = out_dir / "invoice_line_items.jsonl"
    contacts_path = out_dir / "contacts.jsonl"
    items_path = out_dir / "items.jsonl"

    invoice_detail_count = 0
    line_items_count = 0
    with line_items_path.open("w", encoding="utf-8") as handle:
        for invoice in fetch_invoice_details(client, invoice_ids):
            invoice_detail_count += 1
            for row in flatten_line_items(invoice):
                handle.write(json.dumps(row, ensure_ascii=True))
                handle.write("\n")
                line_items_count += 1

    contacts_count = 0
    items_count = 0
    if not args.skip_contacts:
        contacts_count = export_list_resource(
            client, "/invoice/v3/contacts", "contacts", contacts_path, args.per_page
        )
    if not args.skip_items:
        items_count = export_list_resource(
            client, "/invoice/v3/items", "items", items_path, args.per_page
        )

    print(f"invoice_details: {invoice_detail_count}")
    print(f"invoice_line_items: {line_items_count} -> {line_items_path}")
    if not args.skip_contacts:
        print(f"contacts: {contacts_count} -> {contacts_path}")
    if not args.skip_items:
        print(f"items: {items_count} -> {items_path}")


if __name__ == "__main__":
    main()
