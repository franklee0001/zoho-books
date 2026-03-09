"""Transform payment_raw → customer_payments + payment_invoices."""

import argparse
import sys
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
load_dotenv()

import psycopg
from psycopg.types.json import Json

from scripts.transform_invoices import (
    build_conn,
    execute_values,
    parse_date,
    parse_decimal,
    parse_timestamp,
)


def json_dumps_default(obj) -> str:
    import json
    return json.dumps(obj, default=str, ensure_ascii=False)


def J(obj) -> Json:
    return Json(obj, dumps=json_dumps_default)


def fetch_latest_raw_payments(conn: psycopg.Connection) -> List[Dict[str, Any]]:
    sql = """
        SELECT DISTINCT ON (payment_id)
            payment_id,
            raw_json,
            ingested_at
        FROM payment_raw
        WHERE payment_id IS NOT NULL AND payment_id <> ''
        ORDER BY payment_id, ingested_at DESC
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    results = []
    for payment_id, raw_json, ingested_at in rows:
        payload = raw_json if isinstance(raw_json, dict) else dict(raw_json)
        payload["_payment_id"] = payment_id
        payload["_ingested_at"] = ingested_at
        results.append(payload)
    return results


def build_payment_row(payload: Dict[str, Any]) -> Tuple:
    return (
        payload.get("payment_id"),
        payload.get("customer_id") or None,
        payload.get("customer_name"),
        payload.get("payment_number"),
        parse_date(payload.get("date")),
        parse_decimal(payload.get("amount")),
        parse_decimal(payload.get("unused_amount")),
        payload.get("payment_mode"),
        payload.get("description"),
        payload.get("reference_number"),
        payload.get("currency_code"),
        payload.get("account_id") or None,
        payload.get("account_name"),
        parse_timestamp(payload.get("created_time")),
        parse_timestamp(payload.get("updated_time")),
        parse_timestamp(payload.get("last_modified_time")),
        J(payload),
    )


def build_payment_invoice_rows(payload: Dict[str, Any]) -> List[Tuple]:
    payment_id = payload.get("payment_id")
    if not payment_id:
        return []
    invoices = payload.get("invoices") or payload.get("applied_invoices") or []
    if not isinstance(invoices, list):
        return []
    rows = []
    for inv in invoices:
        if not isinstance(inv, dict):
            continue
        invoice_id = inv.get("invoice_id")
        if not invoice_id:
            continue
        rows.append((
            str(payment_id),
            str(invoice_id),
            parse_decimal(inv.get("amount_applied")),
            parse_decimal(inv.get("tax_amount_withheld")),
        ))
    return rows


def upsert_payments(conn: psycopg.Connection, rows: List[Tuple]) -> None:
    if not rows:
        return
    deduped = {row[0]: row for row in rows}
    rows = list(deduped.values())
    sql = """
        INSERT INTO customer_payments (
            payment_id, customer_id, customer_name, payment_number,
            date, amount, unused_amount, payment_mode,
            description, reference_number, currency_code,
            account_id, account_name,
            created_time, updated_time, last_modified_time,
            raw_json
        ) VALUES %s
        ON CONFLICT (payment_id) DO UPDATE SET
            customer_id = EXCLUDED.customer_id,
            customer_name = EXCLUDED.customer_name,
            payment_number = EXCLUDED.payment_number,
            date = EXCLUDED.date,
            amount = EXCLUDED.amount,
            unused_amount = EXCLUDED.unused_amount,
            payment_mode = EXCLUDED.payment_mode,
            description = EXCLUDED.description,
            reference_number = EXCLUDED.reference_number,
            currency_code = EXCLUDED.currency_code,
            account_id = EXCLUDED.account_id,
            account_name = EXCLUDED.account_name,
            created_time = EXCLUDED.created_time,
            updated_time = EXCLUDED.updated_time,
            last_modified_time = EXCLUDED.last_modified_time,
            raw_json = EXCLUDED.raw_json
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()


def upsert_payment_invoices(conn: psycopg.Connection, rows: List[Tuple]) -> None:
    if not rows:
        return
    deduped = {(row[0], row[1]): row for row in rows}
    rows = list(deduped.values())
    sql = """
        INSERT INTO payment_invoices (
            payment_id, invoice_id, amount_applied, tax_amount_withheld
        ) VALUES %s
        ON CONFLICT (payment_id, invoice_id) DO UPDATE SET
            amount_applied = EXCLUDED.amount_applied,
            tax_amount_withheld = EXCLUDED.tax_amount_withheld
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Transform payment_raw into normalized tables.")
    parser.add_argument("--batch", type=int, default=500, help="Batch size")
    args = parser.parse_args()

    conn = build_conn()
    payloads = fetch_latest_raw_payments(conn)

    payment_rows: List[Tuple] = []
    pi_rows: List[Tuple] = []

    for payload in payloads:
        payment_rows.append(build_payment_row(payload))
        pi_rows.extend(build_payment_invoice_rows(payload))

    for start in range(0, len(payment_rows), args.batch):
        upsert_payments(conn, payment_rows[start : start + args.batch])

    for start in range(0, len(pi_rows), args.batch):
        upsert_payment_invoices(conn, pi_rows[start : start + args.batch])

    print(f"customer_payments upserted: {len(payment_rows)}")
    print(f"payment_invoices upserted: {len(pi_rows)}")


if __name__ == "__main__":
    main()
