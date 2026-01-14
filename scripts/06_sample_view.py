import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

SENSITIVE_KEY_RE = re.compile(r"(token|secret|refresh|access)", re.IGNORECASE)
TIMESTAMP_DIR_RE = re.compile(r"^\d{8}_\d{6}$")

HIGHLIGHT_FIELDS = {
    "invoice": ["invoice_id", "invoice_number", "status", "date", "total", "balance"],
    "contact": ["contact_id", "contact_name", "company_name", "email", "status"],
    "item": ["item_id", "name", "rate", "unit", "status"],
    "organization": ["organization_id", "name", "currency_code", "time_zone"],
}

TABLE_COLUMNS = {
    "invoices": ["invoice_id", "invoice_number", "customer_name", "status", "date", "total", "balance"],
    "contacts": ["contact_id", "contact_name", "company_name", "email", "status"],
    "items": ["item_id", "name", "rate", "unit", "status"],
}

CSV_SCHEMAS = {
    "invoices.csv": [
        "invoice_id",
        "invoice_number",
        "date",
        "due_date",
        "status",
        "customer_id",
        "customer_name",
        "total",
        "balance",
        "currency_code",
    ],
    "contacts.csv": [
        "contact_id",
        "contact_name",
        "company_name",
        "email",
        "phone",
        "status",
        "currency_code",
    ],
    "items.csv": ["item_id", "name", "rate", "unit", "status"],
    "invoice_line_items.csv": [
        "invoice_id",
        "line_item_id",
        "item_id",
        "name",
        "quantity",
        "rate",
        "item_total",
        "sales_rate",
    ],
}

BODY_KEY_CANDIDATES = [
    "invoice",
    "contact",
    "item",
    "organization",
    "creditnote",
    "estimate",
    "salesorder",
    "purchaseorder",
    "bill",
    "payment",
    "organizations",
    "invoices",
    "contacts",
    "items",
    "payments",
    "creditnotes",
    "estimates",
    "salesorders",
    "purchaseorders",
    "bills",
]


def is_sensitive_key(key: str) -> bool:
    return bool(SENSITIVE_KEY_RE.search(key))


def mask_payload(value: Any) -> Any:
    if isinstance(value, dict):
        masked: Dict[str, Any] = {}
        for key, val in value.items():
            if is_sensitive_key(key):
                masked[key] = "***"
            else:
                masked[key] = mask_payload(val)
        return masked
    if isinstance(value, list):
        return [mask_payload(item) for item in value]
    return value


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def find_latest_sample_dir(base_dir: Path) -> Optional[Path]:
    if not base_dir.exists():
        return None
    dirs = [p for p in base_dir.iterdir() if p.is_dir() and TIMESTAMP_DIR_RE.match(p.name)]
    if not dirs:
        return None
    return sorted(dirs, key=lambda p: p.name)[-1]


def detect_body_key(payload: Any) -> Optional[str]:
    if not isinstance(payload, dict):
        return None
    for key in BODY_KEY_CANDIDATES:
        if key in payload:
            return key
    if len(payload) == 1:
        return next(iter(payload.keys()))
    return None


def trim_list(items: Iterable[str], limit: int) -> List[str]:
    return list(items)[:limit]


def summarize_list_field(name: str, value: Any) -> Optional[Tuple[str, int, List[str]]]:
    if not isinstance(value, list):
        return None
    length = len(value)
    keys: List[str] = []
    if length > 0 and isinstance(value[0], dict):
        keys = list(value[0].keys())
    return name, length, keys


def build_table(rows: List[Dict[str, Any]], columns: List[str], max_rows: int = 20) -> str:
    usable_rows = rows[:max_rows]
    rendered_rows = []
    widths = [len(col) for col in columns]
    for row in usable_rows:
        rendered = []
        for idx, col in enumerate(columns):
            value = row.get(col, "")
            text = str(value)
            if len(text) > 30:
                text = text[:27] + "..."
            widths[idx] = max(widths[idx], len(text))
            rendered.append(text)
        rendered_rows.append(rendered)

    header = " | ".join(col.ljust(widths[idx]) for idx, col in enumerate(columns))
    divider = "-+-".join("-" * widths[idx] for idx in range(len(columns)))
    lines = [header, divider]
    for rendered in rendered_rows:
        line = " | ".join(rendered[idx].ljust(widths[idx]) for idx in range(len(columns)))
        lines.append(line)
    return "\n".join(lines)


def safe_value(value: Any) -> Any:
    return mask_payload(value)


def read_payloads(sample_dir: Path) -> Dict[str, Any]:
    payloads = {}
    for path in sorted(sample_dir.glob("*.json")):
        payloads[path.name] = load_json(path)
    return payloads


def extract_entity_list(payload: Any, list_key: str, detail_key: str) -> List[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    list_value = payload.get(list_key)
    if isinstance(list_value, list):
        return [item for item in list_value if isinstance(item, dict)]
    detail_value = payload.get(detail_key)
    if isinstance(detail_value, dict):
        return [detail_value]
    return []


def export_csvs(sample_dir: Path, payloads: Dict[str, Any]) -> Path:
    out_dir = sample_dir / "out"
    out_dir.mkdir(parents=True, exist_ok=True)

    invoices = extract_entity_list(payloads.get("invoices.json"), "invoices", "invoice")
    if not invoices:
        invoices = extract_entity_list(payloads.get("invoice.json"), "invoices", "invoice")
    contacts = extract_entity_list(payloads.get("contacts.json"), "contacts", "contact")
    if not contacts:
        contacts = extract_entity_list(payloads.get("contact.json"), "contacts", "contact")
    items = extract_entity_list(payloads.get("items.json"), "items", "item")
    if not items:
        items = extract_entity_list(payloads.get("item.json"), "items", "item")

    line_items = []
    for invoice in invoices:
        for item in invoice.get("line_items", []) if isinstance(invoice, dict) else []:
            if isinstance(item, dict):
                row = {"invoice_id": invoice.get("invoice_id")}
                row.update(item)
                line_items.append(row)

    csv_data = {
        "invoices.csv": invoices,
        "contacts.csv": contacts,
        "items.csv": items,
        "invoice_line_items.csv": line_items,
    }

    for filename, rows in csv_data.items():
        columns = CSV_SCHEMAS[filename]
        path = out_dir / filename
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            for row in rows:
                masked_row = {col: safe_value(row.get(col)) for col in columns}
                writer.writerow(masked_row)

    return out_dir


def render_join_table(payloads: Dict[str, Any]) -> None:
    invoices = extract_entity_list(payloads.get("invoices.json"), "invoices", "invoice")
    if not invoices:
        invoices = extract_entity_list(payloads.get("invoice.json"), "invoices", "invoice")

    rows = []
    for invoice in invoices[:20]:
        line_items = invoice.get("line_items", [])
        line_items_count = len(line_items) if isinstance(line_items, list) else 0
        row = {
            "customer_name": invoice.get("customer_name"),
            "total": invoice.get("total"),
            "balance": invoice.get("balance"),
            "status": invoice.get("status"),
            "date": invoice.get("date"),
            "line_items_count": line_items_count,
        }
        rows.append({key: safe_value(value) for key, value in row.items()})

    if not rows:
        print("No invoices found for join-table.")
        print("")
        return

    columns = ["customer_name", "total", "balance", "status", "date", "line_items_count"]
    print("Join table (invoices + line_items_count):")
    print(build_table(rows, columns, max_rows=20))
    print("")


def summarize_file(path: Path, include_table: bool) -> Dict[str, Any]:
    raw_payload = load_json(path)
    payload = mask_payload(raw_payload)

    summary: Dict[str, Any] = {
        "file": str(path),
        "top_level_keys": list(payload.keys()) if isinstance(payload, dict) else [],
    }

    body_key = detect_body_key(payload)
    summary["body_key"] = body_key

    body = payload.get(body_key) if body_key and isinstance(payload, dict) else None
    summary["body_type"] = type(body).__name__ if body is not None else None

    if isinstance(body, dict):
        summary["body_keys"] = trim_list(body.keys(), 40)
        list_fields = []
        for key, value in body.items():
            info = summarize_list_field(key, value)
            if info:
                list_fields.append(info)
        summary["list_fields"] = [
            {"field": name, "length": length, "item_keys": keys}
            for name, length, keys in list_fields
        ]

        entity_type = body_key.rstrip("s") if body_key else None
        highlights = {}
        if entity_type in HIGHLIGHT_FIELDS:
            for field in HIGHLIGHT_FIELDS[entity_type]:
                if field in body:
                    highlights[field] = body.get(field)
        summary["highlights"] = highlights
    elif isinstance(body, list):
        summary["list_length"] = len(body)
        if body and isinstance(body[0], dict):
            summary["list_item_keys"] = list(body[0].keys())
        if include_table and body_key in TABLE_COLUMNS:
            summary["table_columns"] = TABLE_COLUMNS[body_key]
            summary["table_rows"] = body[:20]
    else:
        summary["body_keys"] = []
        summary["highlights"] = {}

    return summary


def render_summary(summary: Dict[str, Any], include_table: bool) -> None:
    print(f"== {Path(summary['file']).name} ==")
    print("Top-level keys:", ", ".join(summary.get("top_level_keys", [])) or "(none)")
    body_key = summary.get("body_key")
    if body_key:
        print(f"Body key: {body_key} ({summary.get('body_type')})")
    else:
        print("Body key: (none)")

    if summary.get("body_type") == "dict":
        body_keys = summary.get("body_keys", [])
        print("Body keys (top 40):", ", ".join(body_keys) or "(none)")
        highlights = summary.get("highlights", {})
        if highlights:
            highlight_pairs = [f"{key}={value}" for key, value in highlights.items()]
            print("Highlights:", ", ".join(highlight_pairs))
        list_fields = summary.get("list_fields", [])
        if list_fields:
            print("List fields:")
            for field in list_fields:
                item_keys = ", ".join(field.get("item_keys") or []) or "(none)"
                print(f"- {field['field']}: len={field['length']} keys={item_keys}")
    elif summary.get("body_type") == "list":
        print(f"List length: {summary.get('list_length')}")
        item_keys = ", ".join(summary.get("list_item_keys") or []) or "(none)"
        print(f"List item keys: {item_keys}")
        if include_table and summary.get("table_columns"):
            rows = summary.get("table_rows", [])
            print("Table:")
            print(build_table(rows, summary["table_columns"]))
    else:
        print("Body keys: (none)")

    print("")


def main() -> None:
    parser = argparse.ArgumentParser(description="View Zoho sample JSON summaries.")
    parser.add_argument("--dir", dest="sample_dir", default=None, help="Sample directory path")
    parser.add_argument("--json", action="store_true", help="Output summary as JSON")
    parser.add_argument("--table", action="store_true", help="Render tables for list bodies")
    parser.add_argument("--csv", action="store_true", help="Export CSV files to sample out/ folder")
    parser.add_argument("--join-table", action="store_true", help="Render invoice join table")
    args = parser.parse_args()

    base_dir = Path("data") / "samples"
    sample_dir = Path(args.sample_dir) if args.sample_dir else find_latest_sample_dir(base_dir)

    if not sample_dir or not sample_dir.exists():
        print("No sample directory found.", file=sys.stderr)
        sys.exit(1)

    files = sorted(sample_dir.glob("*.json"))
    if not files:
        print("No JSON files found.", file=sys.stderr)
        sys.exit(1)

    payloads = read_payloads(sample_dir)
    summaries = [summarize_file(path, args.table) for path in files]

    if args.json:
        output = {
            "directory": str(sample_dir),
            "files": summaries,
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return

    print(f"Sample directory: {sample_dir}")
    print("")

    if args.join_table:
        render_join_table(payloads)

    if args.csv:
        out_dir = export_csvs(sample_dir, payloads)
        print(f"CSV export: {out_dir}")
        print("")
    for summary in summaries:
        render_summary(summary, args.table)


if __name__ == "__main__":
    main()
