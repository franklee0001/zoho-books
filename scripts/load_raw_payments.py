"""Load customer_payments.jsonl into payment_raw table."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Tuple

from dotenv import load_dotenv
load_dotenv()

import psycopg
from psycopg.types.json import Json

from scripts.load_raw_invoices import build_conn, execute_values


def iter_payment_records(path: Path) -> Iterable[Tuple]:
    """Yield (source_file, line_no, payment_id, raw_json) per JSONL line."""
    source_file = str(path)
    with path.open("r", encoding="utf-8") as handle:
        for idx, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError as exc:
                print(f"{source_file}:{idx} json error: {exc}", file=sys.stderr)
                continue
            if not isinstance(payload, dict):
                print(f"{source_file}:{idx} non-object payload", file=sys.stderr)
                continue
            payment_id = payload.get("payment_id")
            if not payment_id:
                print(f"{source_file}:{idx} missing payment_id", file=sys.stderr)
                payment_id = None
            yield (
                source_file,
                idx,
                str(payment_id) if payment_id else None,
                Json(payload),
            )


def upsert_payment_batch(conn: psycopg.Connection, rows: List[Tuple]) -> None:
    if not rows:
        return
    ingested_at = datetime.now(timezone.utc)
    rows_with_ingest = [row + (ingested_at,) for row in rows]
    sql = """
        INSERT INTO payment_raw (
            source_file, line_no, payment_id, raw_json, ingested_at
        ) VALUES %s
        ON CONFLICT (source_file, line_no)
        DO UPDATE SET
            raw_json = EXCLUDED.raw_json,
            payment_id = EXCLUDED.payment_id,
            ingested_at = EXCLUDED.ingested_at
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows_with_ingest)
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Load customer_payments.jsonl into payment_raw.")
    parser.add_argument("--src", default="data/customer_payments.jsonl", help="Path to JSONL file")
    parser.add_argument("--batch", type=int, default=500, help="Batch size")
    args = parser.parse_args()

    src_path = Path(args.src)
    if not src_path.exists():
        print(f"Input file not found: {src_path}", file=sys.stderr)
        sys.exit(1)

    conn = build_conn()
    batch: List[Tuple] = []
    total = 0

    for row in iter_payment_records(src_path):
        batch.append(row)
        if len(batch) >= args.batch:
            upsert_payment_batch(conn, batch)
            total += len(batch)
            batch = []

    if batch:
        upsert_payment_batch(conn, batch)
        total += len(batch)

    print(f"loaded: {total}")


if __name__ == "__main__":
    main()
