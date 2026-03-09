"""
Zoho Books → CRM 자동 동기화 오케스트레이터.

기존 export / load / transform 파이프라인을 하나로 조합하여
delta sync를 수행한다. cron으로 15분 간격 실행 가능.

Usage:
    python sync.py              # delta sync (마지막 sync 이후 변경분만)
    python sync.py --full       # full sync (전체)
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

# -- 기존 모듈 import --
from export import ensure_dir, export_resource
from scripts.load_raw_invoices import build_conn, iter_records, upsert_batch
from scripts.load_raw_payments import iter_payment_records, upsert_payment_batch
from scripts.transform_invoices import (
    build_address_rows,
    build_customer_row,
    build_invoice_row,
    fetch_latest_raw,
    upsert_addresses,
    upsert_customers,
    upsert_invoices,
)
from scripts.transform_payments import (
    build_payment_invoice_rows,
    build_payment_row,
    fetch_latest_raw_payments,
    upsert_payment_invoices,
    upsert_payments,
)
from zoho_client import ZohoClient

import requests as _requests

TZ = ZoneInfo("Asia/Seoul")
DATA_DIR = Path("data")
STATE_FILE = DATA_DIR / "sync_state.json"
LOCK_FILE = DATA_DIR / "sync.lock"
BATCH_SIZE = 500


# ── Lock ────────────────────────────────────────────────────────────
def acquire_lock() -> bool:
    """Lock 파일 생성. 이미 존재하면 False 반환."""
    ensure_dir(str(DATA_DIR))
    try:
        fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        return True
    except FileExistsError:
        return False


def release_lock() -> None:
    try:
        LOCK_FILE.unlink(missing_ok=True)
    except OSError:
        pass


# ── Sync state ──────────────────────────────────────────────────────
def load_state() -> dict:
    if STATE_FILE.exists():
        with STATE_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state: dict) -> None:
    ensure_dir(str(DATA_DIR))
    with STATE_FILE.open("w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


# ── Pipeline steps ──────────────────────────────────────────────────
def step_export(client: ZohoClient, output_dir: str, since: Optional[str]) -> Tuple[str, int]:
    """Step 1a: Zoho invoices API → JSONL. 반환: (jsonl_path, record_count)."""
    ensure_dir(output_dir)
    count, errors = export_resource(
        client,
        resource="invoices",
        output_dir=output_dir,
        per_page=200,
        since=since,
        invoice_ids=None,
    )
    if errors:
        for err in errors:
            print(f"  export error: {err}", file=sys.stderr)
    jsonl_path = os.path.join(output_dir, "invoices.jsonl")
    return jsonl_path, count


def step_export_payments(client: ZohoClient, output_dir: str, since: Optional[str]) -> Tuple[str, int]:
    """Step 1b: Zoho customer_payments API → JSONL."""
    ensure_dir(output_dir)
    count, errors = export_resource(
        client,
        resource="customer_payments",
        output_dir=output_dir,
        per_page=200,
        since=since,
        invoice_ids=None,
    )
    if errors:
        for err in errors:
            print(f"  export error (payments): {err}", file=sys.stderr)
    jsonl_path = os.path.join(output_dir, "customer_payments.jsonl")
    return jsonl_path, count


def step_load_raw(conn, jsonl_path: str) -> int:
    """Step 2a: JSONL → invoice_raw. 반환: 적재 건수."""
    path = Path(jsonl_path)
    if not path.exists():
        return 0

    batch: List[Tuple] = []
    total = 0

    for row in iter_records(path):
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            upsert_batch(conn, batch)
            total += len(batch)
            batch = []

    if batch:
        upsert_batch(conn, batch)
        total += len(batch)

    return total


def step_load_raw_payments(conn, jsonl_path: str) -> int:
    """Step 2b: JSONL → payment_raw. 반환: 적재 건수."""
    path = Path(jsonl_path)
    if not path.exists():
        return 0

    batch: List[Tuple] = []
    total = 0

    for row in iter_payment_records(path):
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            upsert_payment_batch(conn, batch)
            total += len(batch)
            batch = []

    if batch:
        upsert_payment_batch(conn, batch)
        total += len(batch)

    return total


def step_transform(conn) -> dict:
    """Step 3a: invoice_raw → invoices, customers, invoice_addresses. 반환: 각 테이블 건수."""
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

    for start in range(0, len(customer_rows), BATCH_SIZE):
        upsert_customers(conn, customer_rows[start : start + BATCH_SIZE])

    for start in range(0, len(invoices_rows), BATCH_SIZE):
        upsert_invoices(conn, invoices_rows[start : start + BATCH_SIZE])

    for start in range(0, len(address_rows), BATCH_SIZE):
        upsert_addresses(conn, address_rows[start : start + BATCH_SIZE])

    return {
        "invoices": len(invoices_rows),
        "customers": len(customer_rows),
        "addresses": len(address_rows),
    }


def step_transform_payments(conn) -> dict:
    """Step 3b: payment_raw → customer_payments, payment_invoices. 반환: 각 테이블 건수."""
    payloads = fetch_latest_raw_payments(conn)

    payment_rows: List[Tuple] = []
    pi_rows: List[Tuple] = []

    for payload in payloads:
        payment_rows.append(build_payment_row(payload))
        pi_rows.extend(build_payment_invoice_rows(payload))

    for start in range(0, len(payment_rows), BATCH_SIZE):
        upsert_payments(conn, payment_rows[start : start + BATCH_SIZE])

    for start in range(0, len(pi_rows), BATCH_SIZE):
        upsert_payment_invoices(conn, pi_rows[start : start + BATCH_SIZE])

    return {
        "customer_payments": len(payment_rows),
        "payment_invoices": len(pi_rows),
    }


def step_fetch_line_items(client: ZohoClient, conn) -> int:
    """Step 4: paid 인보이스 중 line_items 없는 건 → Zoho 상세 API → DB upsert."""
    cur = conn.cursor()
    cur.execute("""
        SELECT i.invoice_id
        FROM invoices i
        LEFT JOIN invoice_line_items li ON i.invoice_id = li.invoice_id
        WHERE i.status = 'paid' AND li.line_item_id IS NULL
        LIMIT 50
    """)
    invoice_ids = [row[0] for row in cur.fetchall()]
    cur.close()

    if not invoice_ids:
        return 0

    from psycopg.types.json import Json

    total = 0
    for invoice_id in invoice_ids:
        try:
            payload = client.request("GET", f"/invoice/v3/invoices/{invoice_id}")
        except RuntimeError as e:
            print(f"  line_items fetch failed for {invoice_id}: {e}", file=sys.stderr)
            continue

        invoice = payload.get("invoice")
        if not isinstance(invoice, dict):
            continue

        line_items = invoice.get("line_items")
        if not isinstance(line_items, list):
            continue

        for item in line_items:
            if not isinstance(item, dict):
                continue
            line_item_id = str(item.get("line_item_id", ""))
            if not line_item_id:
                continue

            def to_decimal(val):
                if val is None:
                    return None
                try:
                    return Decimal(str(val))
                except Exception:
                    return None

            cur = conn.cursor()
            cur.execute("""
                INSERT INTO invoice_line_items
                    (line_item_id, invoice_id, name, description, sku, rate, quantity,
                     discount, tax_percentage, item_total, item_id, unit, hsn_or_sac, raw_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (line_item_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    sku = EXCLUDED.sku,
                    rate = EXCLUDED.rate,
                    quantity = EXCLUDED.quantity,
                    discount = EXCLUDED.discount,
                    tax_percentage = EXCLUDED.tax_percentage,
                    item_total = EXCLUDED.item_total,
                    item_id = EXCLUDED.item_id,
                    unit = EXCLUDED.unit,
                    hsn_or_sac = EXCLUDED.hsn_or_sac,
                    raw_json = EXCLUDED.raw_json
            """, (
                line_item_id,
                invoice_id,
                item.get("name"),
                item.get("description"),
                item.get("sku"),
                to_decimal(item.get("rate")),
                to_decimal(item.get("quantity")),
                to_decimal(item.get("discount")),
                to_decimal(item.get("tax_percentage")),
                to_decimal(item.get("item_total")),
                str(item.get("item_id", "")) or None,
                item.get("unit"),
                item.get("hsn_or_sac"),
                Json(item),
            ))
            conn.commit()
            total += 1

    return total


def step_generate_documents(crm_base_url: str, api_secret: str, conn) -> int:
    """Step 5: paid + line_items 있고 + documents 없는 인보이스 → CRM API로 PDF 생성 트리거."""
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT i.invoice_id
        FROM invoices i
        INNER JOIN invoice_line_items li ON i.invoice_id = li.invoice_id
        LEFT JOIN generated_documents gd ON i.invoice_id = gd.invoice_id
        WHERE i.status = 'paid' AND gd.id IS NULL
        LIMIT 20
    """)
    invoice_ids = [row[0] for row in cur.fetchall()]
    cur.close()

    if not invoice_ids:
        return 0

    generated = 0
    for invoice_id in invoice_ids:
        try:
            resp = _requests.post(
                f"{crm_base_url.rstrip('/')}/api/invoices/{invoice_id}/generate-documents",
                headers={"x-api-secret": api_secret},
                timeout=60,
            )
            if resp.status_code == 200:
                generated += 1
            else:
                print(f"  doc generation failed for {invoice_id}: {resp.status_code}", file=sys.stderr)
        except Exception as e:
            print(f"  doc generation error for {invoice_id}: {e}", file=sys.stderr)

    return generated


# ── Main ────────────────────────────────────────────────────────────
def run(full: bool = False) -> None:
    now = datetime.now(TZ)
    now_iso = now.isoformat()
    print(f"[sync] start: {now_iso}  mode={'full' if full else 'delta'}")

    # 1. Lock
    if not acquire_lock():
        print("[sync] another instance is running (lock exists). exiting.", file=sys.stderr)
        sys.exit(0)

    try:
        # 2. State
        state = load_state()
        since = None if full else state.get("invoices")
        since_payments = None if full else state.get("customer_payments")

        if since:
            print(f"[sync] delta since: {since}")
        else:
            print("[sync] full sync (no previous state or --full)")

        # 3. Export
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        output_dir = str(DATA_DIR / "raw" / timestamp)
        client = ZohoClient()

        t0 = time.time()
        jsonl_path, export_count = step_export(client, output_dir, since)
        print(f"[sync] step 1a export invoices: {export_count} records ({time.time() - t0:.1f}s)")

        t0p = time.time()
        payments_jsonl_path, payments_export_count = step_export_payments(client, output_dir, since_payments)
        print(f"[sync] step 1b export payments: {payments_export_count} records ({time.time() - t0p:.1f}s)")

        if export_count == 0 and payments_export_count == 0:
            print("[sync] no changes. done.")
            state["last_run"] = now_iso
            save_state(state)
            return

        # 4. Load raw
        conn = build_conn()
        try:
            t1 = time.time()
            load_count = step_load_raw(conn, jsonl_path)
            print(f"[sync] step 2a load_raw invoices: {load_count} rows ({time.time() - t1:.1f}s)")

            t1p = time.time()
            load_payments_count = step_load_raw_payments(conn, payments_jsonl_path)
            print(f"[sync] step 2b load_raw payments: {load_payments_count} rows ({time.time() - t1p:.1f}s)")

            # 5. Transform
            t2 = time.time()
            counts = step_transform(conn)
            print(f"[sync] step 3a transform invoices: {counts} ({time.time() - t2:.1f}s)")

            t2p = time.time()
            payment_counts = step_transform_payments(conn)
            print(f"[sync] step 3b transform payments: {payment_counts} ({time.time() - t2p:.1f}s)")

            # 6. Fetch line items for paid invoices
            t3 = time.time()
            li_count = step_fetch_line_items(client, conn)
            print(f"[sync] step 4 line_items: {li_count} items ({time.time() - t3:.1f}s)")

            # 7. Generate documents (PL/CI) via CRM API
            crm_base_url = os.getenv("CRM_BASE_URL", "")
            sync_api_secret = os.getenv("SYNC_API_SECRET", "")
            if crm_base_url and sync_api_secret:
                t4 = time.time()
                doc_count = step_generate_documents(crm_base_url, sync_api_secret, conn)
                print(f"[sync] step 5 documents: {doc_count} generated ({time.time() - t4:.1f}s)")
            else:
                print("[sync] step 5 documents: skipped (CRM_BASE_URL or SYNC_API_SECRET not set)")
        finally:
            conn.close()

        # 6. Update state
        state["invoices"] = now_iso
        state["customer_payments"] = now_iso
        state["last_run"] = now_iso
        state["last_export_count"] = export_count
        save_state(state)

        total_time = time.time() - t0
        print(f"[sync] done in {total_time:.1f}s")

    finally:
        release_lock()


def main() -> None:
    parser = argparse.ArgumentParser(description="Zoho Books → CRM sync orchestrator")
    parser.add_argument("--full", action="store_true", help="Full sync (ignore last sync time)")
    args = parser.parse_args()
    run(full=args.full)


if __name__ == "__main__":
    main()
