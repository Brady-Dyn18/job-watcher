"""Daily fetch, raw snapshot, history, status, and Issue pipeline."""

from __future__ import annotations

import argparse
import gzip
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from .config import SOURCES, SourceConfig
from .github_issues import publish_daily_issue
from .history import build_history_rows, load_history, write_history
from .normalize import normalize_payload

LOGGER = logging.getLogger(__name__)


def _payload_count(source: SourceConfig, payload: Any) -> int:
    if source.ats == "lever":
        return len(payload) if isinstance(payload, list) else len((payload or {}).get("data") or [])
    return len((payload or {}).get("jobs") or [])


def _write_raw(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as stream:
        json.dump(payload, stream, ensure_ascii=False, sort_keys=True)


def fetch_sources(raw_root: Path, day: str, session: requests.Session | None = None) -> list[dict[str, Any]]:
    """Fetch every source, recording failures without stopping the run."""

    session = session or requests.Session()
    day_dir = raw_root / day
    day_dir.mkdir(parents=True, exist_ok=True)
    # A rerun on the same day must replace today's snapshots; stale files are not success.
    for old_file in day_dir.glob("*.json.gz"):
        old_file.unlink()

    results: list[dict[str, Any]] = []
    for source in SOURCES:
        result = {"name": source.employer, "ok": False, "count": 0}
        try:
            response = session.get(
                source.api_url,
                headers={"Accept": "application/json", "User-Agent": "entry-level-finance-job-watcher/0.1"},
                timeout=45,
            )
            response.raise_for_status()
            payload = response.json()
            # Validate/normalize before saving: malformed source data becomes a clean source failure.
            normalize_payload(source, payload)
            _write_raw(day_dir / f"{source.slug}.json.gz", payload)
            result["ok"] = True
            result["count"] = _payload_count(source, payload)
        except (requests.RequestException, ValueError, TypeError, KeyError) as exc:
            LOGGER.warning("%s failed: %s", source.employer, exc)
            result["error"] = str(exc)
        results.append(result)
    return results


def _write_status(path: Path, status: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(status, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def run_pipeline(base_dir: Path, run_time: datetime | None = None, session: requests.Session | None = None) -> dict[str, Any]:
    now = run_time or datetime.now(timezone.utc)
    now = now.astimezone(timezone.utc)
    day = now.date().isoformat()
    data_dir = base_dir / "data"
    raw_root = data_dir / "raw"
    fetch_results = fetch_sources(raw_root, day, session=session)

    rows = build_history_rows(raw_root)
    history_path = data_dir / "history.csv"
    write_history(rows, history_path)
    persisted_rows = load_history(history_path)
    raw_days = sorted({path.parent.name for path in raw_root.glob("*/*.json.gz")}) if raw_root.exists() else []
    status = {
        "run_time": now.isoformat().replace("+00:00", "Z"),
        "first_run_date": raw_days[0] if raw_days else "",
        "days_with_success": len(raw_days),
        "open": sum(row.get("status") == "open" for row in persisted_rows),
        "new_today": sum(row.get("first_seen") == day and row.get("first_run") != "true" for row in persisted_rows),
        "removed_today": sum(row.get("removed_date") == day for row in persisted_rows),
        "sources": fetch_results,
    }
    _write_status(data_dir / "status.json", status)

    warning = publish_daily_issue(day, persisted_rows)
    if warning:
        LOGGER.warning(warning)
    return status


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch job boards and build the job watcher data files.")
    parser.add_argument("--base-dir", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    status = run_pipeline(args.base_dir)
    LOGGER.info("run complete: %s", json.dumps(status))


if __name__ == "__main__":
    main()
