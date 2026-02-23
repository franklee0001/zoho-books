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
from pathlib import Path
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

# -- 기존 모듈 import --
from export import ensure_dir, export_resource
from scripts.load_raw_invoices import build_conn, iter_records, upsert_batch
from scripts.transform_invoices import (
    build_address_rows,
    build_customer_row,
    build_invoice_row,
    fetch_latest_raw,
    upsert_addresses,
    upsert_customers,
    upsert_invoices,
)
from zoho_client import ZohoClient

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
    """Step 1: Zoho API → JSONL. 반환: (jsonl_path, record_count)."""
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


def step_load_raw(conn, jsonl_path: str) -> int:
    """Step 2: JSONL → invoice_raw. 반환: 적재 건수."""
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


def step_transform(conn) -> dict:
    """Step 3: invoice_raw → invoices, customers, invoice_addresses. 반환: 각 테이블 건수."""
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
        print(f"[sync] step 1 export: {export_count} records ({time.time() - t0:.1f}s)")

        if export_count == 0:
            print("[sync] no changes. done.")
            # 마지막 실행 시각만 업데이트
            state["last_run"] = now_iso
            save_state(state)
            return

        # 4. Load raw
        conn = build_conn()
        try:
            t1 = time.time()
            load_count = step_load_raw(conn, jsonl_path)
            print(f"[sync] step 2 load_raw: {load_count} rows ({time.time() - t1:.1f}s)")

            # 5. Transform
            t2 = time.time()
            counts = step_transform(conn)
            print(f"[sync] step 3 transform: {counts} ({time.time() - t2:.1f}s)")
        finally:
            conn.close()

        # 6. Update state
        state["invoices"] = now_iso
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
