"""Rebuild data/history.csv and data/status.json inputs from existing raw files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .history import build_history_rows, load_history, write_history


def main() -> None:
    parser = argparse.ArgumentParser(description="Build history.csv from data/raw only.")
    parser.add_argument("--base-dir", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    data_dir = args.base_dir / "data"
    history_path = data_dir / "history.csv"
    write_history(build_history_rows(data_dir / "raw"), history_path)
    rows = load_history(history_path)
    print(json.dumps({"rows": len(rows), "history": str(history_path)}))


if __name__ == "__main__":
    main()
