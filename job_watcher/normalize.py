"""Convert ATS-specific JSON postings into the common history schema."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from .config import ROLE_NAMES, SourceConfig

COMMON_COLUMNS = (
    "posting_id",
    "source",
    "source_id",
    "employer",
    "title",
    "location",
    "department",
    "posted_date",
    "url",
    "in_role",
    "first_run",
    "first_seen",
    "last_seen",
    "status",
    "removed_date",
)


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(_as_text(item) for item in value if _as_text(item))
    if isinstance(value, dict):
        return _as_text(value.get("name") or value.get("location") or value.get("title"))
    return str(value).strip()


def _date_from_value(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, (int, float)):
        # Lever uses milliseconds since the Unix epoch.
        value = value / 1000 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(value, tz=timezone.utc).date().isoformat()
    text = str(value).strip()
    if text.isdigit():
        return _date_from_value(int(text))
    normalized = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized).date().isoformat()
    except ValueError:
        return ""


def _greenhouse_location(job: dict[str, Any]) -> str:
    location = job.get("location")
    if isinstance(location, dict):
        return _as_text(location.get("name"))
    offices = job.get("offices") or []
    return _as_text([office.get("name") for office in offices if isinstance(office, dict)])


def _greenhouse_department(job: dict[str, Any]) -> str:
    departments = job.get("departments") or []
    return _as_text([item.get("name") for item in departments if isinstance(item, dict)])


def _greenhouse(job: dict[str, Any]) -> dict[str, str]:
    return {
        "source_id": _as_text(job.get("id") or job.get("internal_job_id")),
        "title": _as_text(job.get("title")),
        "location": _greenhouse_location(job),
        "department": _greenhouse_department(job),
        "posted_date": _date_from_value(job.get("first_published") or job.get("updated_at")),
        "url": _as_text(job.get("absolute_url")),
    }


def _lever(job: dict[str, Any]) -> dict[str, str]:
    categories = job.get("categories") or {}
    return {
        "source_id": _as_text(job.get("id")),
        "title": _as_text(job.get("text")),
        "location": _as_text(categories.get("location")),
        "department": _as_text(categories.get("department") or categories.get("team")),
        "posted_date": _date_from_value(job.get("createdAt") or job.get("post_date")),
        "url": _as_text(job.get("hostedUrl") or job.get("applyUrl") or job.get("url")),
    }


def _ashby(job: dict[str, Any]) -> dict[str, str]:
    return {
        "source_id": _as_text(job.get("id")),
        "title": _as_text(job.get("title")),
        "location": _as_text(job.get("location")),
        "department": _as_text(job.get("department") or job.get("team")),
        "posted_date": _date_from_value(job.get("publishedAt")),
        "url": _as_text(job.get("jobUrl") or job.get("applyUrl")),
    }


def _jobs_from_payload(source: SourceConfig, payload: Any) -> list[dict[str, Any]]:
    if source.ats == "greenhouse":
        return list((payload or {}).get("jobs") or [])
    if source.ats == "lever":
        return list(payload or []) if isinstance(payload, list) else list((payload or {}).get("data") or [])
    if source.ats == "ashby":
        return list((payload or {}).get("jobs") or [])
    raise ValueError(f"Unsupported ATS: {source.ats}")


def title_in_role(title: str) -> bool:
    """Return whether a posting title matches the entry-level finance rule."""

    normalized = re.sub(r"[^a-z0-9&]+", " ", (title or "").lower()).strip()
    if not normalized:
        return False
    if re.search(r"\b(senior|sr|lead|principal|staff|manager|director|vice president|vp|head|intern|internship)\b", normalized):
        return False
    patterns = (
        r"\bfinancial\s+analyst\b",
        r"\bfinance\s+analyst\b",
        r"\bjunior\s+financial\s+analyst\b",
        r"\bfp\s*&\s*a\s+analyst\b",
        r"\bfinancial\s+planning\s+(?:and|&)\s+analysis\s+analyst\b",
        r"\bfinance\s+rotational\s+analyst\b",
        r"\btreasury\s+analyst\b",
        r"\bcredit\s+analyst\b",
        r"\banalyst\s+(?:[-,]\s*)?fp\s*&\s*a\b",
        r"\banalyst\s+(?:[-,]\s*)?treasury\b",
        r"\banalyst\s+(?:[-,]\s*)?credit\b",
    )
    return any(re.search(pattern, normalized) for pattern in patterns)


def normalize_posting(source: SourceConfig, raw: dict[str, Any]) -> dict[str, Any]:
    if source.ats == "greenhouse":
        fields = _greenhouse(raw)
    elif source.ats == "lever":
        fields = _lever(raw)
    elif source.ats == "ashby":
        fields = _ashby(raw)
    else:
        raise ValueError(f"Unsupported ATS: {source.ats}")
    source_id = fields["source_id"]
    if not source_id:
        raise ValueError(f"Posting from {source.slug} has no source ID")
    row = {
        "posting_id": f"{source.slug}:{source_id}",
        "source": source.slug,
        "source_id": source_id,
        "employer": source.employer,
        "title": fields["title"],
        "location": fields["location"],
        "department": fields["department"],
        "posted_date": fields["posted_date"],
        "url": fields["url"],
        "in_role": title_in_role(fields["title"]),
        "first_run": False,
        "first_seen": "",
        "last_seen": "",
        "status": "open",
        "removed_date": "",
    }
    return row


def normalize_payload(source: SourceConfig, payload: Any) -> list[dict[str, Any]]:
    rows = [normalize_posting(source, raw) for raw in _jobs_from_payload(source, payload)]
    return sorted({row["posting_id"]: row for row in rows}.values(), key=lambda row: row["posting_id"])
