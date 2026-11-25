import requests

from job_watcher import pipeline
from job_watcher.config import SOURCES


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeSession:
    def get(self, url, **kwargs):
        if "notion" in url:
            raise requests.RequestException("simulated outage")
        return FakeResponse({"jobs": []})


def test_failed_source_does_not_stop_other_sources(tmp_path, monkeypatch):
    selected = tuple(source for source in SOURCES if source.slug in {"ramp", "notion"})
    monkeypatch.setattr(pipeline, "SOURCES", selected)
    results = pipeline.fetch_sources(tmp_path / "raw", "2026-03-01", session=FakeSession())

    assert results == [
        {"name": "Ramp", "ok": True, "count": 0},
        {"name": "Notion", "ok": False, "count": 0, "error": "simulated outage"},
    ]
    assert (tmp_path / "raw" / "2026-03-01" / "ramp.json.gz").exists()
    assert not (tmp_path / "raw" / "2026-03-01" / "notion.json.gz").exists()
