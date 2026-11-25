"""Convert ATS-specific JSON postings into the common history schema."""

from __future__ import annotations

import re
import json
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

DETAIL_COLUMNS = (
    "employment_type",
    "workplace_type",
    "salary_min",
    "salary_max",
    "salary_currency",
)


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(_as_text(item) for item in value if _as_text(item))
    if isinstance(value, dict):
        return _as_text(value.get("name") or value.get("location") or value.get("title"))
    return " ".join(str(value).split())


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
        for pattern in ("%B %d, %Y", "%b %d, %Y"):
            try:
                return datetime.strptime(text, pattern).date().isoformat()
            except ValueError:
                continue
        return ""


def _salary_details(*values: Any) -> dict[str, Any]:
    text = " ".join(_as_text(value) for value in values if value not in (None, ""))
    match = re.search(
        r"\$\s*(\d[\d,]*(?:\.\d+)?)\s*-\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(USD|US\s*Dollars?|CAD|EUR)?\s*(?:annually|per\s+year|yearly)?",
        text,
        flags=re.IGNORECASE,
    ) or re.search(
        r"(\d[\d,]*(?:\.\d+)?)\s*-\s*(\d[\d,]*(?:\.\d+)?)\s*(USD|US\s*Dollars?|CAD|EUR)\s*(?:annually|per\s+year|yearly)?",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return {"salary_min": "", "salary_max": "", "salary_currency": ""}
    minimum = float(match.group(1).replace(",", ""))
    maximum = float(match.group(2).replace(",", ""))
    if minimum < 10_000 or maximum < minimum:
        return {"salary_min": "", "salary_max": "", "salary_currency": ""}
    currency = (match.group(3) or "USD").upper().replace(" ", "")
    return {
        "salary_min": minimum,
        "salary_max": maximum,
        "salary_currency": currency,
    }


def _amazon_workplace(job: dict[str, Any]) -> str:
    workplace_types: list[str] = []
    for location in job.get("locations") or []:
        try:
            parsed = json.loads(location) if isinstance(location, str) else location
        except (TypeError, json.JSONDecodeError):
            continue
        if isinstance(parsed, dict) and parsed.get("type"):
            workplace_types.append(str(parsed["type"]).upper())
    if any("REMOTE" in item for item in workplace_types):
        return "Remote"
    if any("HYBRID" in item for item in workplace_types):
        return "Hybrid"
    return "On-site" if workplace_types else ""


def _greenhouse_location(job: dict[str, Any]) -> str:
    location = job.get("location")
    if isinstance(location, dict):
        return _as_text(location.get("name"))
    offices = job.get("offices") or []
    return _as_text([office.get("name") for office in offices if isinstance(office, dict)])


def _greenhouse_department(job: dict[str, Any]) -> str:
    departments = job.get("departments") or []
    return _as_text([item.get("name") for item in departments if isinstance(item, dict)])


def _greenhouse(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_id": _as_text(job.get("id") or job.get("internal_job_id")),
        "title": _as_text(job.get("title")),
        "location": _greenhouse_location(job),
        "department": _greenhouse_department(job),
        "posted_date": _date_from_value(job.get("first_published") or job.get("updated_at")),
        "url": _as_text(job.get("absolute_url")),
        "employment_type": _as_text(job.get("employment_type")),
        "workplace_type": _as_text(job.get("workplace_type")),
        **_salary_details(job.get("content"), job.get("description")),
    }


def _lever(job: dict[str, Any]) -> dict[str, Any]:
    categories = job.get("categories") or {}
    return {
        "source_id": _as_text(job.get("id")),
        "title": _as_text(job.get("text")),
        "location": _as_text(categories.get("location")),
        "department": _as_text(categories.get("department") or categories.get("team")),
        "posted_date": _date_from_value(job.get("createdAt") or job.get("post_date")),
        "url": _as_text(job.get("hostedUrl") or job.get("applyUrl") or job.get("url")),
        "employment_type": _as_text(categories.get("commitment")),
        "workplace_type": "",
        **_salary_details(job.get("description")),
    }


def _ashby(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_id": _as_text(job.get("id")),
        "title": _as_text(job.get("title")),
        "location": _as_text(job.get("location")),
        "department": _as_text(job.get("department") or job.get("team")),
        "posted_date": _date_from_value(job.get("publishedAt")),
        "url": _as_text(job.get("jobUrl") or job.get("applyUrl")),
        "employment_type": _as_text(job.get("employmentType")),
        "workplace_type": _as_text(job.get("workplaceType")),
        **_salary_details(job.get("description"), job.get("compensationTierSummary")),
    }


def _workday(job: dict[str, Any], source: SourceConfig) -> dict[str, Any]:
    bullet_fields = job.get("bulletFields") or []
    source_id = _as_text(bullet_fields[0] if bullet_fields else job.get("externalPath"))
    external_path = _as_text(job.get("externalPath"))
    return {
        "source_id": source_id,
        "title": _as_text(job.get("title")),
        "location": _as_text(job.get("locationsText")),
        "department": "",
        "posted_date": _date_from_value(job.get("postedOn")),
        "url": f"{source.board_url.rstrip('/')}{external_path}" if external_path else source.board_url,
        "employment_type": _as_text(job.get("timeType")),
        "workplace_type": "",
        "salary_min": "",
        "salary_max": "",
        "salary_currency": "",
    }


def _amazon(job: dict[str, Any]) -> dict[str, Any]:
    job_path = _as_text(job.get("job_path"))
    return {
        "source_id": _as_text(job.get("id") or job.get("id_icims") or job_path),
        "title": _as_text(job.get("title")),
        "location": _as_text(job.get("normalized_location") or job.get("location")),
        "department": _as_text(job.get("job_category") or job.get("job_family")),
        "posted_date": _date_from_value(job.get("posted_date")),
        "url": f"https://www.amazon.jobs{job_path}" if job_path.startswith("/") else _as_text(job.get("url_next_step")),
        "employment_type": _as_text(job.get("job_schedule_type")),
        "workplace_type": _amazon_workplace(job),
        **_salary_details(job.get("description"), job.get("preferred_qualifications"), job.get("basic_qualifications")),
    }


def _jobs_from_payload(source: SourceConfig, payload: Any) -> list[dict[str, Any]]:
    if source.ats == "greenhouse":
        return list((payload or {}).get("jobs") or [])
    if source.ats == "lever":
        return list(payload or []) if isinstance(payload, list) else list((payload or {}).get("data") or [])
    if source.ats == "ashby":
        return list((payload or {}).get("jobs") or [])
    if source.ats in {"workday", "amazon"}:
        key = "jobPostings" if source.ats == "workday" else "jobs"
        return list((payload or {}).get(key) or [])
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
        r"\bfinancial\s+planning\s+analyst\b",
        r"\bfinance\s+operations\s+analyst\b",
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
    elif source.ats == "workday":
        fields = _workday(raw, source)
    elif source.ats == "amazon":
        fields = _amazon(raw)
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
    row.update({key: fields.get(key, "") for key in DETAIL_COLUMNS})
    return row


def normalize_payload(source: SourceConfig, payload: Any) -> list[dict[str, Any]]:
    rows = [normalize_posting(source, raw) for raw in _jobs_from_payload(source, payload)]
    return sorted({row["posting_id"]: row for row in rows}.values(), key=lambda row: row["posting_id"])
