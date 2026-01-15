import argparse
import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from zoneinfo import ZoneInfo

TIMESTAMP_DIR_RE = r"^\d{8}_\d{6}$"

CSV_COLUMNS = [
    "invoice_id",
    "invoice_number",
    "date",
    "due_date",
    "customer_id",
    "customer_name",
    "status",
    "total",
    "balance",
    "currency_code",
    "last_modified_time",
    "line_items_count",
]


def parse_month(month: str) -> str:
    if len(month) != 7 or month[4] != "-":
        raise ValueError("--month must be YYYY-MM")
    year, mon = month.split("-")
    if not (year.isdigit() and mon.isdigit()):
        raise ValueError("--month must be YYYY-MM")
    if not (1 <= int(mon) <= 12):
        raise ValueError("--month must be YYYY-MM")
    return f"{year}-{mon}"


def current_month_seoul() -> str:
    now = datetime.now(ZoneInfo("Asia/Seoul"))
    return now.strftime("%Y-%m")


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


def read_jsonl(path: Path) -> Iterable[Dict[str, object]]:
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
                yield payload


def filter_invoices(invoices: Iterable[Dict[str, object]], month_prefix: str) -> List[Dict[str, object]]:
    filtered = []
    for invoice in invoices:
        date_value = invoice.get("date")
        if isinstance(date_value, str) and date_value.startswith(month_prefix):
            filtered.append(invoice)
    return filtered


def sum_amount(values: Iterable[Dict[str, object]], key: str) -> float:
    total = 0.0
    for item in values:
        value = item.get(key)
        if isinstance(value, (int, float)):
            total += float(value)
    return total


def build_table(rows: List[Dict[str, object]], columns: List[str], max_rows: int) -> str:
    widths = [len(col) for col in columns]
    rendered_rows = []
    for row in rows[:max_rows]:
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


def export_csv(rows: List[Dict[str, object]], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({col: row.get(col) for col in CSV_COLUMNS})


def normalize_invoice(invoice: Dict[str, object]) -> Dict[str, object]:
    line_items = invoice.get("line_items")
    if isinstance(line_items, list):
        line_items_count = len(line_items)
    else:
        line_items_count = 0

    normalized = dict(invoice)
    normalized["line_items_count"] = line_items_count
    return normalized


def main() -> None:
    parser = argparse.ArgumentParser(description="List monthly invoices from exported JSONL.")
    parser.add_argument("--month", default=None, help="Target month (YYYY-MM)")
    parser.add_argument("--src", default=None, help="Path to invoices.jsonl")
    parser.add_argument("--limit", type=int, default=30, help="Max rows to display")
    parser.add_argument("--outdir", default=None, help="Custom output directory")
    args = parser.parse_args()

    month_value = args.month or current_month_seoul()
    try:
        month_prefix = parse_month(month_value)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    base_dir = Path("data") / "raw"
    src_path = Path(args.src) if args.src else find_latest_invoices_jsonl(base_dir)
    if not src_path or not src_path.exists():
        print(
            "No invoices.jsonl found. Run: python export.py --resources invoices --out data/raw",
            file=sys.stderr,
        )
        sys.exit(1)

    invoices = list(read_jsonl(src_path))
    filtered = [normalize_invoice(inv) for inv in filter_invoices(invoices, month_prefix)]

    total_sum = sum_amount(filtered, "total")
    balance_sum = sum_amount(filtered, "balance")

    month_label = month_prefix.replace("-", "_")
    if args.outdir:
        out_dir = Path(args.outdir) / f"month={month_prefix}"
    else:
        out_dir = src_path.parent / "out" / f"month={month_prefix}"
    out_path = out_dir / f"invoices_{month_label}.csv"

    print(f"Month: {month_prefix}")
    print(f"Source: {src_path}")
    print(f"Count: {len(filtered)}")
    print(f"Total sum: {total_sum}")
    print(f"Balance sum: {balance_sum} | CSV: {out_path}")

    table_columns = [
        "invoice_number",
        "date",
        "customer_name",
        "status",
        "total",
        "balance",
        "currency_code",
        "line_items_count",
    ]
    print(build_table(filtered, table_columns, args.limit))
    export_csv(filtered, out_path)


if __name__ == "__main__":
    main()
