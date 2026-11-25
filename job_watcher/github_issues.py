"""Optional GitHub Issue publishing for the daily pipeline."""

from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Any

import requests


def _headers(token: str) -> dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _issue_body(day: str, new_rows: list[dict[str, str]], removed_rows: list[dict[str, str]]) -> str:
    def lines(rows: list[dict[str, str]]) -> str:
        if not rows:
            return "- None"
        return "\n".join(
            f"- [{row['title']}]({row['url']}) - {row['employer']} - {row['location'] or 'Location not listed'}"
            for row in rows
        )

    return (
        f"# Job changes for {day}\n\n"
        "## New postings\n\n"
        f"{lines(new_rows)}\n\n"
        "## Removed postings\n\n"
        f"{lines(removed_rows)}\n"
    )


def publish_daily_issue(day: str, rows: list[dict[str, str]]) -> str | None:
    """Create/update today's issue and close the previous day's issue.

    Local runs without GitHub Actions credentials skip this step. Failures are
    returned as a warning string so the data pipeline can still finish.
    """

    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    repository = os.environ.get("GITHUB_REPOSITORY")
    if not token or not repository:
        return None

    try:
        base = f"https://api.github.com/repos/{repository}"
        headers = _headers(token)
        new_rows = [row for row in rows if row.get("first_seen") == day and row.get("first_run") != "true"]
        removed_rows = [row for row in rows if row.get("removed_date") == day]
        body = _issue_body(day, new_rows, removed_rows)

        issues = requests.get(f"{base}/issues", headers=headers, params={"state": "open", "per_page": 100}, timeout=30)
        issues.raise_for_status()
        open_issues = issues.json()
        previous_day = (date.fromisoformat(day) - timedelta(days=1)).isoformat()
        for issue in open_issues:
            if issue.get("pull_request"):
                continue
            if issue.get("title") == previous_day:
                response = requests.patch(
                    f"{base}/issues/{issue['number']}",
                    headers=headers,
                    json={"state": "closed"},
                    timeout=30,
                )
                response.raise_for_status()

        existing = next((issue for issue in open_issues if issue.get("title") == day and not issue.get("pull_request")), None)
        if existing:
            response = requests.patch(
                f"{base}/issues/{existing['number']}",
                headers=headers,
                json={"body": body, "state": "open"},
                timeout=30,
            )
        else:
            response = requests.post(
                f"{base}/issues",
                headers=headers,
                json={"title": day, "body": body},
                timeout=30,
            )
        response.raise_for_status()
        return None
    except (requests.RequestException, ValueError, KeyError) as exc:
        return f"GitHub Issue update skipped after error: {exc}"
