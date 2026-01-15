import argparse
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple

import psycopg
from psycopg.extras import execute_values
from psycopg.types.json import Json


def build_conn() -> psycopg.Connection:
    return psycopg.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
        dbname=os.getenv("PGDATABASE", "zoho"),
        user=os.getenv("PGUSER", "zoho"),
        password=os.getenv("PGPASSWORD", "zoho"),
    )


def parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed:
        return None

    candidates = [trimmed]
    if trimmed.endswith("Z"):
        candidates.append(trimmed[:-1] + "+00:00")

    if len(trimmed) >= 5 and trimmed[-5] in ["+", "-"]:
        sign = trimmed[-5]
        digits = trimmed[-4:]
        if digits.isdigit():
            candidates.append(trimmed + "00")
            candidates.append(trimmed[:-5] + sign + digits[:2] + ":" + digits[2:])

    if len(trimmed) >= 6 and trimmed[-6] in ["+", "-"] and trimmed[-3] == ":":
        candidates.append(trimmed[:-6] + trimmed[-6:-3] + trimmed[-2:])

    for candidate in candidates:
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            pass
        for fmt in (
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
        ):
            try:
                return datetime.strptime(candidate, fmt)
            except ValueError:
                continue
    return None


def parse_date(value: Optional[str]) -> Optional[date]:
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


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


def fetch_latest_raw(conn: psycopg.Connection) -> Iterable[Dict[str, Any]]:
    sql = """
        SELECT DISTINCT ON (invoice_id)
            invoice_id,
            raw_json,
            updated_time,
            last_modified_time,
            created_time,
            ingested_at
        FROM invoice_raw
        WHERE invoice_id IS NOT NULL AND invoice_id <> ''
        ORDER BY invoice_id,
                 COALESCE(last_modified_time, updated_time, created_time, ingested_at) DESC,
                 ingested_at DESC
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    results = []
    for invoice_id, raw_json, updated_time, last_modified_time, created_time, ingested_at in rows:
        if isinstance(raw_json, dict):
            payload = raw_json
        else:
            payload = dict(raw_json)
        payload["_invoice_id"] = invoice_id
        payload["_updated_time"] = updated_time
        payload["_last_modified_time"] = last_modified_time
        payload["_created_time"] = created_time
        payload["_ingested_at"] = ingested_at
        results.append(payload)
    return results


def build_invoice_row(payload: Dict[str, Any]) -> Tuple:
    updated_time = payload.get("_updated_time")
    last_modified_time = payload.get("_last_modified_time")
    created_time = payload.get("_created_time")
    raw_invoice_url = payload.get("invoice_url")
    invoice_url = raw_invoice_url.strip() if isinstance(raw_invoice_url, str) else None
    if not invoice_url:
        invoice_url = None

    return (
        payload.get("invoice_id"),
        payload.get("invoice_number"),
        parse_date(payload.get("date")),
        parse_date(payload.get("due_date")),
        payload.get("status"),
        payload.get("current_sub_status"),
        parse_decimal(payload.get("total")),
        parse_decimal(payload.get("balance")),
        payload.get("currency_code"),
        payload.get("customer_id"),
        payload.get("customer_name"),
        invoice_url,
        payload.get("salesperson_id"),
        payload.get("salesperson_name"),
        created_time,
        updated_time,
        last_modified_time,
        Json(payload),
    )


def extract_address(payload: Dict[str, Any], kind: str) -> Optional[Dict[str, Any]]:
    key = f"{kind}_address"
    value = payload.get(key)
    if not isinstance(value, dict):
        return None
    return value


def build_address_rows(payload: Dict[str, Any]) -> List[Tuple]:
    rows: List[Tuple] = []
    for kind in ("billing", "shipping"):
        address = extract_address(payload, kind)
        if not address:
            continue
        rows.append(
            (
                payload.get("invoice_id"),
                kind,
                address.get("attention"),
                address.get("address"),
                address.get("street2"),
                address.get("city"),
                address.get("state"),
                address.get("zipcode") or address.get("zip"),
                address.get("country"),
                address.get("phone"),
                Json(address),
            )
        )
    return rows


def build_customer_row(payload: Dict[str, Any]) -> Optional[Tuple]:
    customer_id = payload.get("customer_id")
    if not customer_id:
        return None
    return (
        customer_id,
        payload.get("customer_name"),
        payload.get("company_name"),
        payload.get("email"),
        payload.get("phone"),
        payload.get("country"),
        Json(payload),
        payload.get("_updated_time") or payload.get("_last_modified_time") or payload.get("_created_time"),
    )


def upsert_invoices(conn: psycopg.Connection, rows: List[Tuple]) -> None:
    sql = """
        INSERT INTO invoices (
            invoice_id,
            invoice_number,
            date,
            due_date,
            status,
            current_sub_status,
            total,
            balance,
            currency_code,
            customer_id,
            customer_name,
            invoice_url,
            salesperson_id,
            salesperson_name,
            created_time,
            updated_time,
            last_modified_time,
            raw_json
        ) VALUES %s
        ON CONFLICT (invoice_id) DO UPDATE SET
            invoice_number = EXCLUDED.invoice_number,
            date = EXCLUDED.date,
            due_date = EXCLUDED.due_date,
            status = EXCLUDED.status,
            current_sub_status = EXCLUDED.current_sub_status,
            total = EXCLUDED.total,
            balance = EXCLUDED.balance,
            currency_code = EXCLUDED.currency_code,
            customer_id = EXCLUDED.customer_id,
            customer_name = EXCLUDED.customer_name,
            invoice_url = EXCLUDED.invoice_url,
            salesperson_id = EXCLUDED.salesperson_id,
            salesperson_name = EXCLUDED.salesperson_name,
            created_time = EXCLUDED.created_time,
            updated_time = EXCLUDED.updated_time,
            last_modified_time = EXCLUDED.last_modified_time,
            raw_json = EXCLUDED.raw_json
        WHERE COALESCE(EXCLUDED.last_modified_time, EXCLUDED.updated_time, EXCLUDED.created_time)
            > COALESCE(invoices.last_modified_time, invoices.updated_time, invoices.created_time)
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()


def upsert_addresses(conn: psycopg.Connection, rows: List[Tuple]) -> None:
    if not rows:
        return
    sql = """
        INSERT INTO invoice_addresses (
            invoice_id,
            kind,
            attention,
            address,
            street2,
            city,
            state,
            zipcode,
            country,
            phone,
            raw_json
        ) VALUES %s
        ON CONFLICT (invoice_id, kind) DO UPDATE SET
            attention = EXCLUDED.attention,
            address = EXCLUDED.address,
            street2 = EXCLUDED.street2,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zipcode = EXCLUDED.zipcode,
            country = EXCLUDED.country,
            phone = EXCLUDED.phone,
            raw_json = EXCLUDED.raw_json
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()


def upsert_customers(conn: psycopg.Connection, rows: List[Tuple]) -> None:
    if not rows:
        return
    sql = """
        INSERT INTO customers (
            customer_id,
            customer_name,
            company_name,
            email,
            phone,
            country,
            raw_json,
            updated_at
        ) VALUES %s
        ON CONFLICT (customer_id) DO UPDATE SET
            customer_name = EXCLUDED.customer_name,
            company_name = EXCLUDED.company_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            country = EXCLUDED.country,
            raw_json = EXCLUDED.raw_json,
            updated_at = EXCLUDED.updated_at
        WHERE COALESCE(EXCLUDED.updated_at, '1970-01-01'::timestamptz)
            > COALESCE(customers.updated_at, '1970-01-01'::timestamptz)
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Transform invoice_raw into normalized tables.")
    parser.add_argument("--skip-customers", action="store_true", help="Skip customers table")
    parser.add_argument("--batch", type=int, default=500, help="Batch size")
    args = parser.parse_args()

    conn = build_conn()
    payloads = fetch_latest_raw(conn)

    invoices_rows: List[Tuple] = []
    address_rows: List[Tuple] = []
    customer_rows: List[Tuple] = []

    for payload in payloads:
        invoices_rows.append(build_invoice_row(payload))
        address_rows.extend(build_address_rows(payload))
        customer_row = build_customer_row(payload)
        if customer_row:
            customer_rows.append(customer_row)

    if not args.skip_customers and customer_rows:
        for start in range(0, len(customer_rows), args.batch):
            upsert_customers(conn, customer_rows[start : start + args.batch])

    for start in range(0, len(invoices_rows), args.batch):
        upsert_invoices(conn, invoices_rows[start : start + args.batch])

    if address_rows:
        for start in range(0, len(address_rows), args.batch):
            upsert_addresses(conn, address_rows[start : start + args.batch])

    print(f"invoices upserted: {len(invoices_rows)}")
    print(f"addresses upserted: {len(address_rows)}")
    if not args.skip_customers:
        print(f"customers upserted: {len(customer_rows)}")


if __name__ == "__main__":
    main()
