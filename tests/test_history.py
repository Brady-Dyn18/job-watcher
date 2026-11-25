import gzip
import json

from job_watcher.config import SOURCES
from job_watcher.history import build_details, build_history_rows, write_history


def source(slug: str):
    return next(item for item in SOURCES if item.slug == slug)


def write_snapshot(root, day, slug, payload):
    target = root / day
    target.mkdir(parents=True, exist_ok=True)
    with gzip.open(target / f"{slug}.json.gz", "wt", encoding="utf-8") as stream:
        json.dump(payload, stream)


def greenhouse_job(job_id, title):
    return {
        "id": job_id,
        "title": title,
        "location": {"name": "Chicago, IL"},
        "departments": [{"name": "Finance"}],
        "first_published": "2026-01-01T10:00:00Z",
        "absolute_url": f"https://example.test/{job_id}",
    }


def test_first_seen_last_seen_removed_and_reopened(tmp_path):
    raw = tmp_path / "raw"
    write_snapshot(raw, "2026-01-01", "stripe", {"jobs": [greenhouse_job(1, "Financial Analyst"), greenhouse_job(2, "Credit Analyst")]})
    write_snapshot(raw, "2026-01-02", "stripe", {"jobs": [greenhouse_job(1, "Financial Analyst"), greenhouse_job(3, "Treasury Analyst")]})
    write_snapshot(raw, "2026-01-03", "stripe", {"jobs": [greenhouse_job(1, "Financial Analyst"), greenhouse_job(2, "Credit Analyst")]})

    rows = {row["posting_id"]: row for row in build_history_rows(raw)}
    first = rows["stripe:1"]
    reopened = rows["stripe:2"]
    new = rows["stripe:3"]

    assert first["first_run"] is True
    assert first["first_seen"] == "2026-01-01"
    assert first["last_seen"] == "2026-01-03"
    assert first["status"] == "open"
    assert first["removed_date"] == ""

    assert reopened["first_run"] is True
    assert reopened["first_seen"] == "2026-01-01"
    assert reopened["last_seen"] == "2026-01-03"
    assert reopened["status"] == "open"
    assert reopened["removed_date"] == ""

    assert new["first_run"] is False
    assert new["first_seen"] == "2026-01-02"
    assert new["last_seen"] == "2026-01-02"
    assert new["status"] == "removed"
    assert new["removed_date"] == "2026-01-03"


def test_history_is_sorted_and_reproducible(tmp_path):
    raw = tmp_path / "raw"
    write_snapshot(raw, "2026-02-01", "stripe", {"jobs": [greenhouse_job(20, "Financial Analyst"), greenhouse_job(10, "Credit Analyst")]})
    first = build_history_rows(raw)
    output = tmp_path / "history.csv"
    write_history(first, output)
    second = build_history_rows(raw)
    assert [row["posting_id"] for row in first] == ["stripe:10", "stripe:20"]
    assert first == second


def test_optional_details_are_separate_from_rubric_history_columns(tmp_path):
    raw = tmp_path / "raw"
    write_snapshot(
        raw,
        "2026-02-01",
        "amazon",
        {
            "jobs": [
                {
                    "id": "a-1",
                    "title": "Financial Analyst",
                    "job_path": "/en/jobs/a-1/financial-analyst",
                    "location": "US, NY, New York",
                    "posted_date": "February 1, 2026",
                    "description": "73,600 - 128,800 USD annually",
                }
            ]
        },
    )
    details = build_details(raw)
    assert details["amazon:a-1"]["salary_min"] == 73600.0
    assert details["amazon:a-1"]["salary_currency"] == "USD"
    assert "experience_level" in details["amazon:a-1"]
