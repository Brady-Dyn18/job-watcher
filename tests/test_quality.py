import json

from job_watcher.history import write_history
from job_watcher.quality import validate_data


def test_validate_data_checks_generated_outputs(tmp_path):
    data = tmp_path / "data"
    data.mkdir()
    write_history(
        [{
            "posting_id": "demo:1",
            "source": "demo",
            "source_id": "1",
            "employer": "Demo",
            "title": "Financial Analyst",
            "location": "Chicago, IL",
            "department": "Finance",
            "posted_date": "2026-01-01",
            "url": "https://example.test/1",
            "in_role": True,
            "first_run": True,
            "first_seen": "2026-01-01",
            "last_seen": "2026-01-01",
            "status": "open",
            "removed_date": "",
        }],
        data / "history.csv",
    )
    (data / "details.json").write_text(json.dumps({"demo:1": {}}), encoding="utf-8")
    (data / "status.json").write_text(json.dumps({"sources": [{"name": "Demo"}]}), encoding="utf-8")
    assert validate_data(tmp_path) == {"history_rows": 1, "detail_rows": 1, "sources": 1}
