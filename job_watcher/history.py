"""Deterministic history construction from compressed raw snapshots."""

from __future__ import annotations

import csv
import gzip
import json
from collections.abc import Iterable
from datetime import date
from pathlib import Path
from typing import Any

from .config import SOURCES, SourceConfig
from .normalize import COMMON_COLUMNS, normalize_payload


def _source_map() -> dict[str, SourceConfig]:
    return {source.slug: source for source in SOURCES}


def raw_files(raw_root: Path) -> list[tuple[str, SourceConfig, Path]]:
    """Return raw files as (UTC date, source config, path), sorted deterministically."""

    found: list[tuple[str, SourceConfig, Path]] = []
    sources = _source_map()
    if not raw_root.exists():
        return found
    for day_dir in sorted(path for path in raw_root.iterdir() if path.is_dir()):
        day = day_dir.name
        try:
            date.fromisoformat(day)
        except ValueError:
            continue
        for path in sorted(day_dir.glob("*.json.gz")):
            slug = path.name.removesuffix(".json.gz")
            source = sources.get(slug)
            if source is not None:
                found.append((day, source, path))
    return found


def read_raw(path: Path) -> Any:
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        return json.load(stream)


def build_history_rows(raw_root: Path) -> list[dict[str, Any]]:
    """Build all history rows using only the raw snapshot files."""

    files = raw_files(raw_root)
    first_raw_date: dict[str, str] = {}
    for day, source, _ in files:
        first_raw_date.setdefault(source.slug, day)

    history: dict[str, dict[str, Any]] = {}
    for day, source, path in files:
        normalized = normalize_payload(source, read_raw(path))
        current_ids = {row["posting_id"] for row in normalized}

        # A source snapshot is evidence that missing open postings were removed.
        for row in history.values():
            if row["source"] == source.slug and row["status"] == "open" and row["posting_id"] not in current_ids:
                row["status"] = "removed"
                row["removed_date"] = day

        for row in normalized:
            posting_id = row["posting_id"]
            existing = history.get(posting_id)
            if existing is None:
                row["first_run"] = day == first_raw_date[source.slug]
                row["first_seen"] = day
                row["last_seen"] = day
                row["status"] = "open"
                row["removed_date"] = ""
                history[posting_id] = row
                continue

            # Keep the original first-seen metadata, but refresh current fields.
            for field in ("source", "source_id", "employer", "title", "location", "department", "posted_date", "url", "in_role"):
                existing[field] = row[field]
            existing["last_seen"] = day
            existing["status"] = "open"
            existing["removed_date"] = ""

    return [history[key] for key in sorted(history)]


def write_history(rows: Iterable[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=COMMON_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in sorted(rows, key=lambda item: item["posting_id"]):
            output = {column: row.get(column, "") for column in COMMON_COLUMNS}
            output["in_role"] = str(bool(row["in_role"])).lower()
            output["first_run"] = str(bool(row["first_run"])).lower()
            writer.writerow(output)


def build_details(raw_root: Path) -> dict[str, dict[str, Any]]:
    """Build optional display metadata without changing the rubric CSV schema."""

    details: dict[str, dict[str, Any]] = {}
    for _day, source, path in raw_files(raw_root):
        for row in normalize_payload(source, read_raw(path)):
            details[row["posting_id"]] = {
                key: row.get(key, "")
                for key in ("employment_type", "workplace_type", "salary_min", "salary_max", "salary_currency")
            }
    return {key: details[key] for key in sorted(details)}


def write_details(details: dict[str, dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(details, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def load_history(history_path: Path) -> list[dict[str, str]]:
    if not history_path.exists():
        return []
    with history_path.open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))
