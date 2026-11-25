from job_watcher.config import SOURCES
from job_watcher.normalize import normalize_payload, title_in_role


def source(slug: str):
    return next(item for item in SOURCES if item.slug == slug)


def test_greenhouse_conversion_to_common_columns():
    row = normalize_payload(
        source("stripe"),
        {
            "jobs": [
                {
                    "id": 101,
                    "title": "Financial Analyst",
                    "location": {"name": "New York, NY"},
                    "departments": [{"name": "Finance"}],
                    "first_published": "2026-01-02T10:00:00Z",
                    "absolute_url": "https://example.test/stripe/101",
                }
            ]
        },
    )[0]
    assert row["posting_id"] == "stripe:101"
    assert row["employer"] == "Stripe"
    assert row["location"] == "New York, NY"
    assert row["department"] == "Finance"
    assert row["posted_date"] == "2026-01-02"
    assert row["in_role"] is True


def test_lever_conversion_to_common_columns():
    row = normalize_payload(
        source("palantir"),
        [
            {
                "id": "box-1",
                "text": "Treasury Analyst",
                "categories": {"location": "Remote - US", "department": "Finance"},
                "createdAt": 1767355200000,
                "hostedUrl": "https://jobs.lever.co/box/box-1",
            }
        ],
    )[0]
    assert row["posting_id"] == "palantir:box-1"
    assert row["location"] == "Remote - US"
    assert row["department"] == "Finance"
    assert row["posted_date"] == "2026-01-02"


def test_ashby_conversion_to_common_columns():
    row = normalize_payload(
        source("ramp"),
        {
            "jobs": [
                {
                    "id": "ramp-1",
                    "title": "Credit Analyst",
                    "location": "New York, NY",
                    "department": "Finance",
                    "publishedAt": "2026-01-03T12:30:00.000+00:00",
                    "jobUrl": "https://jobs.ashbyhq.com/ramp/ramp-1",
                }
            ]
        },
    )[0]
    assert row["posting_id"] == "ramp:ramp-1"
    assert row["posted_date"] == "2026-01-03"
    assert row["url"].endswith("ramp-1")


def test_entry_level_title_rule():
    assert title_in_role("Financial Analyst")
    assert title_in_role("Junior Financial Analyst")
    assert title_in_role("FP&A Analyst")
    assert title_in_role("Finance Rotational Analyst")
    assert title_in_role("Treasury Analyst - Entry Level")
    assert title_in_role("Credit Analyst, Finance")
    assert not title_in_role("Senior Financial Analyst")
    assert not title_in_role("Finance Manager")
    assert not title_in_role("Financial Analyst Intern")
