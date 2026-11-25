"""Source configuration and the title rule used by the watcher."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceConfig:
    slug: str
    employer: str
    ats: str
    board_token: str
    board_url: str
    search_term: str = ""
    query: str = ""

    @property
    def api_url(self) -> str:
        if self.ats == "greenhouse":
            return f"https://boards-api.greenhouse.io/v1/boards/{self.board_token}/jobs?content=true"
        if self.ats == "lever":
            return f"https://api.lever.co/v0/postings/{self.board_token}?mode=json"
        if self.ats == "ashby":
            return f"https://api.ashbyhq.com/posting-api/job-board/{self.board_token}"
        if self.ats == "workday":
            return f"https://{self.board_token}/wday/cxs/{self.search_term}/jobs"
        if self.ats == "amazon":
            return "https://www.amazon.jobs/en/search.json"
        raise ValueError(f"Unsupported ATS: {self.ats}")


# These boards are public ATS endpoints and do not require login or an API key.
# The project intentionally watches more than the minimum 15 employers.
SOURCES = (
    SourceConfig("ramp", "Ramp", "ashby", "ramp", "https://jobs.ashbyhq.com/ramp"),
    SourceConfig("notion", "Notion", "ashby", "notion", "https://jobs.ashbyhq.com/notion"),
    SourceConfig("openai", "OpenAI", "ashby", "openai", "https://jobs.ashbyhq.com/openai"),
    SourceConfig("linear", "Linear", "ashby", "linear", "https://jobs.ashbyhq.com/linear"),
    SourceConfig("stripe", "Stripe", "greenhouse", "stripe", "https://boards.greenhouse.io/stripe"),
    SourceConfig("datadog", "Datadog", "greenhouse", "datadog", "https://boards.greenhouse.io/datadog"),
    SourceConfig("coinbase", "Coinbase", "greenhouse", "coinbase", "https://boards.greenhouse.io/coinbase"),
    SourceConfig("affirm", "Affirm", "greenhouse", "affirm", "https://boards.greenhouse.io/affirm"),
    SourceConfig("toast", "Toast", "greenhouse", "toast", "https://boards.greenhouse.io/toast"),
    SourceConfig("twilio", "Twilio", "greenhouse", "twilio", "https://boards.greenhouse.io/twilio"),
    SourceConfig("robinhood", "Robinhood", "greenhouse", "robinhood", "https://boards.greenhouse.io/robinhood"),
    SourceConfig("airbnb", "Airbnb", "greenhouse", "airbnb", "https://boards.greenhouse.io/airbnb"),
    SourceConfig("brex", "Brex", "greenhouse", "brex", "https://boards.greenhouse.io/brex"),
    SourceConfig("chime", "Chime", "greenhouse", "chime", "https://boards.greenhouse.io/chime"),
    SourceConfig("pinterest", "Pinterest", "greenhouse", "pinterest", "https://boards.greenhouse.io/pinterest"),
    SourceConfig("reddit", "Reddit", "greenhouse", "reddit", "https://boards.greenhouse.io/reddit"),
    SourceConfig("samsara", "Samsara", "greenhouse", "samsara", "https://boards.greenhouse.io/samsara"),
    SourceConfig("asana", "Asana", "greenhouse", "asana", "https://boards.greenhouse.io/asana"),
    SourceConfig("palantir", "Palantir", "lever", "palantir", "https://jobs.lever.co/palantir"),
    # These public Workday boards return JSON without login. The board_token is
    # the public host and search_term stores the Workday tenant/site path.
    SourceConfig("bank-of-america", "Bank of America", "workday", "ghr.wd1.myworkdayjobs.com", "https://ghr.wd1.myworkdayjobs.com/Lateral-US", "ghr/Lateral-US", "finance"),
    SourceConfig("capital-one", "Capital One", "workday", "capitalone.wd12.myworkdayjobs.com", "https://capitalone.wd12.myworkdayjobs.com/Capital_One", "capitalone/Capital_One", "finance"),
    SourceConfig("wells-fargo", "Wells Fargo", "workday", "wf.wd1.myworkdayjobs.com", "https://wf.wd1.myworkdayjobs.com/WellsFargoJobs", "wf/WellsFargoJobs", "finance"),
    # Amazon's public search endpoint is scoped to the finance search term.
    SourceConfig("amazon", "Amazon", "amazon", "finance", "https://www.amazon.jobs/en/search", "finance"),
)

ROLE_NAMES = (
    "Financial Analyst",
    "Junior Financial Analyst",
    "FP&A Analyst",
    "Financial Planning Analyst",
    "Business Finance Analyst",
    "Sales Finance Analyst",
    "Corporate Finance Analyst",
    "Finance Operations Analyst",
    "Finance Rotational Analyst",
    "Treasury Analyst",
    "Credit Analyst",
)

TITLE_RULE_DESCRIPTION = (
    "In role when the title contains Financial Analyst, Finance Analyst, Junior Financial Analyst, "
    "FP&A Analyst, Financial Planning Analyst, Business Finance Analyst, Sales Finance Analyst, "
    "Corporate Finance Analyst, Finance Operations Analyst, Finance Rotational Analyst, Treasury Analyst, "
    "or Credit Analyst; excludes senior, "
    "lead, principal, staff, manager, director, vice-president, and internship titles."
)
