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
    assert row["finance_area"] is True


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
    assert row["location"] == "Remote - USA"
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
    assert title_in_role("Financial Planning Analyst")
    assert title_in_role("Business Finance Analyst")
    assert title_in_role("Finance Operations Analyst")
    assert title_in_role("Business Finance Analyst")
    assert not title_in_role("Senior Financial Analyst")
    assert not title_in_role("Financial Analyst III")
    assert not title_in_role("Finance Analyst II")
    assert not title_in_role("Finance Manager")
    assert not title_in_role("Financial Analyst Intern")


def test_workday_conversion_to_common_columns():
    row = normalize_payload(
        source("capital-one"),
        {
            "jobPostings": [
                {
                    "title": "Financial Planning Analyst",
                    "externalPath": "/job/McLean-VA/Financial-Planning-Analyst_R1",
                    "timeType": "Full time",
                    "locationsText": "McLean, VA",
                    "postedOn": "Posted Today",
                    "bulletFields": ["R1"],
                }
            ]
        },
    )[0]
    assert row["posting_id"] == "capital-one:R1"
    assert row["url"].endswith("/Capital_One/job/McLean-VA/Financial-Planning-Analyst_R1")
    assert row["employment_type"] == "Full time"
    assert row["in_role"] is True


def test_amazon_conversion_extracts_salary_and_workplace():
    row = normalize_payload(
        source("amazon"),
        {
            "jobs": [
                {
                    "id": "amazon-1",
                    "title": "Financial Analyst",
                    "job_path": "/en/jobs/amazon-1/financial-analyst",
                    "normalized_location": "Seattle, Washington, USA",
                    "job_category": "Finance & Accounting",
                    "job_schedule_type": "full-time",
                    "posted_date": "October 23, 2026",
                    "locations": ['{"type":"HYBRID"}'],
                    "description": "Base salary range: 73,600 - 128,800 USD annually",
                }
            ]
        },
    )[0]
    assert row["posted_date"] == "2026-10-23"
    assert row["workplace_type"] == "Hybrid"
    assert row["salary_min"] == 73600.0
    assert row["salary_max"] == 128800.0


def test_experience_and_location_metadata_are_normalized():
    row = normalize_payload(
        source("stripe"),
        {
            "jobs": [
                {
                    "id": 102,
                    "title": "Junior Financial Analyst",
                    "location": {"name": "Remote - US"},
                    "departments": [{"name": "Finance"}],
                    "first_published": "2026-01-02T10:00:00Z",
                    "absolute_url": "https://example.test/stripe/102",
                    "content": "Bachelor's degree preferred. Entry-level role with 0-2 years of experience.",
                }
            ]
        },
    )[0]
    assert row["location"] == "Remote - USA"
    assert row["experience_level"] == "Early career"
    assert row["experience_years"] == "0–2 years"
    assert row["education_requirement"] == "Bachelor's degree"


def test_additional_finance_feed_conversion():
    row = normalize_payload(
        source("sofi"),
        {
            "jobs": [
                {
                    "id": 99,
                    "title": "Corporate Finance Analyst",
                    "location": {"name": "San Francisco, CA"},
                    "departments": [{"name": "Finance"}],
                    "first_published": "2026-01-02T10:00:00Z",
                    "absolute_url": "https://example.test/sofi/99",
                }
            ]
        },
    )[0]
    assert row["employer"] == "SoFi"
    assert row["in_role"] is True
    assert row["finance_area"] is True
