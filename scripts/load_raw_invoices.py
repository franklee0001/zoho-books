import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

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


def iter_records(
    path: Path,
) -> Iterable[
    Tuple[str, int, Optional[str], Json, Optional[datetime], Optional[datetime], Optional[datetime]]
]:
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
            invoice_id = payload.get("invoice_id")
            if not invoice_id:
                print(f"{source_file}:{idx} missing invoice_id", file=sys.stderr)
                invoice_id = None
            created_time = parse_timestamp(payload.get("created_time"))
            updated_time = parse_timestamp(payload.get("updated_time"))
            last_modified_time = parse_timestamp(payload.get("last_modified_time"))
            yield (
                source_file,
                idx,
                str(invoice_id) if invoice_id else None,
                Json(payload),
                created_time,
                updated_time,
                last_modified_time,
            )


def upsert_batch(conn: psycopg.Connection, rows: List[Tuple]) -> None:
    sql = """
        INSERT INTO invoice_raw (
            source_file,
            line_no,
            invoice_id,
            raw_json,
            created_time,
            updated_time,
            last_modified_time,
            ingested_at
        ) VALUES %s
        ON CONFLICT (source_file, line_no)
        DO UPDATE SET
            raw_json = EXCLUDED.raw_json,
            created_time = EXCLUDED.created_time,
            updated_time = EXCLUDED.updated_time,
            last_modified_time = EXCLUDED.last_modified_time,
            ingested_at = EXCLUDED.ingested_at
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Load invoices.jsonl into invoice_raw.")
    parser.add_argument("--src", default="data/invoices.jsonl", help="Path to invoices.jsonl")
    parser.add_argument("--batch", type=int, default=500, help="Batch size")
    args = parser.parse_args()

    src_path = Path(args.src)
    if not src_path.exists():
        print(f"Input file not found: {src_path}", file=sys.stderr)
        sys.exit(1)

    conn = build_conn()
    batch: List[Tuple] = []
    total = 0

    for row in iter_records(src_path):
        batch.append(row)
        if len(batch) >= args.batch:
            upsert_batch(conn, batch)
            total += len(batch)
            batch = []

    if batch:
        upsert_batch(conn, batch)
        total += len(batch)

    print(f"loaded: {total}")


if __name__ == "__main__":
    main()
