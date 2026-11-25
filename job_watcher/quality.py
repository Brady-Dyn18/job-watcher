"""Validate generated data before the daily workflow commits it."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .history import load_history
from .normalize import COMMON_COLUMNS


def validate_data(base_dir: Path) -> dict[str, int]:
    data_dir = base_dir / "data"
    rows = load_history(data_dir / "history.csv")
    ids = [row.get("posting_id", "") for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError("history.csv contains duplicate posting IDs")
    missing_columns = [column for column in COMMON_COLUMNS if rows and column not in rows[0]]
    if missing_columns:
        raise ValueError(f"history.csv is missing columns: {', '.join(missing_columns)}")
    details = json.loads((data_dir / "details.json").read_text(encoding="utf-8")) if (data_dir / "details.json").exists() else {}
    status = json.loads((data_dir / "status.json").read_text(encoding="utf-8")) if (data_dir / "status.json").exists() else {}
    if status and not isinstance(status.get("sources", []), list):
        raise ValueError("status.json sources must be a list")
    return {"history_rows": len(rows), "detail_rows": len(details), "sources": len(status.get("sources", []))}


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate generated Finance Job Watcher data.")
    parser.add_argument("--base-dir", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    print(json.dumps(validate_data(args.base_dir), sort_keys=True))


if __name__ == "__main__":
    main()
