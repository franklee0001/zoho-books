"""Fetch line items from Zoho detail API for paid invoices missing line items,
and upsert them into the invoice_line_items table."""

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv()

import psycopg
from psycopg.types.json import Json

from zoho_client import ZohoClient


# ---------------------------------------------------------------------------
# DB helpers (same pattern as load_raw_invoices.py / transform_invoices.py)
# ---------------------------------------------------------------------------

def build_conn() -> psycopg.Connection:
    required = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"]
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        missing_list = ", ".join(missing)
        print(
            f"Missing env vars: {missing_list}. Required for Supabase/Postgres connection.",
            file=sys.stderr,
        )
        print("Set PGSSLMODE=require for Supabase.", file=sys.stderr)
        sys.exit(1)

    sslmode = os.getenv("PGSSLMODE", "require")

    return psycopg.connect(
        host=os.getenv("PGHOST"),
        port=os.getenv("PGPORT"),
        dbname=os.getenv("PGDATABASE"),
        user=os.getenv("PGUSER"),
        password=os.getenv("PGPASSWORD"),
        sslmode=sslmode,
    )


def execute_values(cur, sql, argslist, template=None, page_size=500) -> None:
    if not argslist:
        return
    if sql.count("%s") != 1:
        raise ValueError("execute_values expects a single %s placeholder in SQL")

    value_template = template or "(" + ",".join(["%s"] * len(argslist[0])) + ")"
    chunks = [argslist[i : i + page_size] for i in range(0, len(argslist), page_size)]

    for chunk in chunks:
        placeholders = ",".join([value_template] * len(chunk))
        query = sql.replace("%s", placeholders)
        flattened = []
        for row in chunk:
            flattened.extend(row)
        cur.execute(query, flattened)


# ---------------------------------------------------------------------------
# JSON / Decimal helpers
# ---------------------------------------------------------------------------

def json_dumps_default(obj) -> str:
    return json.dumps(obj, default=str, ensure_ascii=False)


def J(obj) -> Json:
    return Json(obj, dumps=json_dumps_default)


def parse_decimal(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    if isinstance(value, str):
        try:
            return Decimal(value)
        except Exception:
            return None
    return None


# ---------------------------------------------------------------------------
# Query: paid invoices without line items
# ---------------------------------------------------------------------------

def fetch_paid_invoices_without_line_items(
    conn: psycopg.Connection, max_invoices: Optional[int] = None,
    all_statuses: bool = False,
) -> List[str]:
    """Return invoice_ids for invoices that have no rows in invoice_line_items."""
    if all_statuses:
        sql = """
            SELECT i.invoice_id
            FROM invoices i
            LEFT JOIN invoice_line_items li ON li.invoice_id = i.invoice_id
            WHERE li.line_item_id IS NULL
            ORDER BY i.date DESC NULLS LAST
        """
    else:
        sql = """
            SELECT i.invoice_id
            FROM invoices i
            LEFT JOIN invoice_line_items li ON li.invoice_id = i.invoice_id
            WHERE i.status = 'paid'
              AND li.line_item_id IS NULL
            ORDER BY i.date DESC NULLS LAST
        """
    if max_invoices is not None:
        sql += f" LIMIT {int(max_invoices)}"

    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    return [row[0] for row in rows]


# ---------------------------------------------------------------------------
# Fetch invoice detail from Zoho API
# ---------------------------------------------------------------------------

def fetch_invoice_line_items(
    client: ZohoClient, invoice_id: str
) -> List[Dict[str, Any]]:
    """Call Zoho detail API and return the line_items list."""
    try:
        payload = client.request("GET", f"/books/v3/invoices/{invoice_id}")
    except RuntimeError:
        print(f"Failed to fetch invoice {invoice_id}", file=sys.stderr)
        return []

    invoice = payload.get("invoice")
    if not isinstance(invoice, dict):
        print(f"No invoice object for {invoice_id}", file=sys.stderr)
        return []

    line_items = invoice.get("line_items")
    if not isinstance(line_items, list):
        return []
    return line_items


# ---------------------------------------------------------------------------
# Build DB row from a single line item dict
# ---------------------------------------------------------------------------

def build_line_item_row(invoice_id: str, item: Dict[str, Any]) -> Optional[Tuple]:
    line_item_id = item.get("line_item_id")
    if not line_item_id:
        return None
    return (
        str(line_item_id),
        str(invoice_id),
        item.get("name"),
        item.get("description"),
        item.get("sku"),
        parse_decimal(item.get("rate")),
        parse_decimal(item.get("quantity")),
        parse_decimal(item.get("discount")),
        parse_decimal(item.get("tax_percentage")),
        parse_decimal(item.get("item_total")),
        item.get("item_id"),
        item.get("unit"),
        item.get("hsn_or_sac"),
        J(item),
    )


# ---------------------------------------------------------------------------
# Upsert batch into invoice_line_items
# ---------------------------------------------------------------------------

def upsert_line_items(conn: psycopg.Connection, rows: List[Tuple]) -> None:
    if not rows:
        return
    # Deduplicate by line_item_id (first element)
    deduped = {row[0]: row for row in rows}
    rows = list(deduped.values())

    sql = """
        INSERT INTO invoice_line_items (
            line_item_id,
            invoice_id,
            name,
            description,
            sku,
            rate,
            quantity,
            discount,
            tax_percentage,
            item_total,
            item_id,
            unit,
            hsn_or_sac,
            raw_json
        ) VALUES %s
        ON CONFLICT (line_item_id) DO UPDATE SET
            invoice_id     = EXCLUDED.invoice_id,
            name           = EXCLUDED.name,
            description    = EXCLUDED.description,
            sku            = EXCLUDED.sku,
            rate           = EXCLUDED.rate,
            quantity       = EXCLUDED.quantity,
            discount       = EXCLUDED.discount,
            tax_percentage = EXCLUDED.tax_percentage,
            item_total     = EXCLUDED.item_total,
            item_id        = EXCLUDED.item_id,
            unit           = EXCLUDED.unit,
            hsn_or_sac     = EXCLUDED.hsn_or_sac,
            raw_json       = EXCLUDED.raw_json
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch line items for paid invoices and upsert into invoice_line_items."
    )
    parser.add_argument(
        "--max-invoices",
        type=int,
        default=None,
        help="Maximum number of invoices to fetch (default: all)",
    )
    parser.add_argument(
        "--all-statuses",
        action="store_true",
        default=False,
        help="Fetch line items for all invoice statuses, not just paid",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=500,
        help="Upsert batch size (default: 500)",
    )
    args = parser.parse_args()

    conn = build_conn()

    # 1. Find invoices without line items
    invoice_ids = fetch_paid_invoices_without_line_items(
        conn, args.max_invoices, all_statuses=args.all_statuses
    )
    if not invoice_ids:
        print("No paid invoices missing line items.")
        return

    print(f"Found {len(invoice_ids)} paid invoices without line items.")

    # 2. Fetch line items from Zoho API and collect rows
    client = ZohoClient()
    all_rows: List[Tuple] = []
    fetched_count = 0

    for invoice_id in invoice_ids:
        line_items = fetch_invoice_line_items(client, invoice_id)
        if not line_items:
            continue
        fetched_count += 1
        for item in line_items:
            row = build_line_item_row(invoice_id, item)
            if row:
                all_rows.append(row)

    print(f"Fetched details for {fetched_count} invoices, {len(all_rows)} line items total.")

    # 3. Batch upsert (reconnect to avoid stale connection from long API fetch)
    if not all_rows:
        print("No line items to upsert.")
        return

    conn.close()
    conn = build_conn()

    total_upserted = 0
    for start in range(0, len(all_rows), args.batch):
        batch = all_rows[start : start + args.batch]
        upsert_line_items(conn, batch)
        total_upserted += len(batch)
        print(f"  Batch upserted {total_upserted}/{len(all_rows)} ...")

    print(f"Upserted {total_upserted} line items into invoice_line_items.")


if __name__ == "__main__":
    main()
