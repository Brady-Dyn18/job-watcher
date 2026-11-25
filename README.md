# Finance Job Watcher

[![Tests](https://github.com/Brady-Dyn18/job-watcher/actions/workflows/tests.yml/badge.svg)](https://github.com/Brady-Dyn18/job-watcher/actions/workflows/tests.yml)

Finance Job Watcher is a daily, entry-level finance job tracker. It reads public applicant-tracking-system JSON feeds, saves compressed snapshots, rebuilds a deterministic history, opens a daily GitHub Issue with changes, and publishes an offline-ready GitHub Pages site.

**Live site:** [Open Finance Job Watcher](https://brady-dyn18.github.io/job-watcher/)

## Watch list

The project watches 29 employers through public, no-login JSON endpoints. The enabled searches return fewer than 5,000 postings per source; Amazon and the Workday boards use documented finance search terms to keep the feed focused and paginable.

| Employer | ATS | Public JSON endpoint |
| --- | --- | --- |
| Ramp | Ashby | `api.ashbyhq.com/posting-api/job-board/ramp` |
| Notion | Ashby | `api.ashbyhq.com/posting-api/job-board/notion` |
| OpenAI | Ashby | `api.ashbyhq.com/posting-api/job-board/openai` |
| Linear | Ashby | `api.ashbyhq.com/posting-api/job-board/linear` |
| Stripe | Greenhouse | `boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true` |
| Datadog | Greenhouse | `boards-api.greenhouse.io/v1/boards/datadog/jobs?content=true` |
| Coinbase | Greenhouse | `boards-api.greenhouse.io/v1/boards/coinbase/jobs?content=true` |
| Affirm | Greenhouse | `boards-api.greenhouse.io/v1/boards/affirm/jobs?content=true` |
| Toast | Greenhouse | `boards-api.greenhouse.io/v1/boards/toast/jobs?content=true` |
| Twilio | Greenhouse | `boards-api.greenhouse.io/v1/boards/twilio/jobs?content=true` |
| Robinhood | Greenhouse | `boards-api.greenhouse.io/v1/boards/robinhood/jobs?content=true` |
| Airbnb | Greenhouse | `boards-api.greenhouse.io/v1/boards/airbnb/jobs?content=true` |
| Brex | Greenhouse | `boards-api.greenhouse.io/v1/boards/brex/jobs?content=true` |
| Chime | Greenhouse | `boards-api.greenhouse.io/v1/boards/chime/jobs?content=true` |
| Pinterest | Greenhouse | `boards-api.greenhouse.io/v1/boards/pinterest/jobs?content=true` |
| Reddit | Greenhouse | `boards-api.greenhouse.io/v1/boards/reddit/jobs?content=true` |
| Samsara | Greenhouse | `boards-api.greenhouse.io/v1/boards/samsara/jobs?content=true` |
| Asana | Greenhouse | `boards-api.greenhouse.io/v1/boards/asana/jobs?content=true` |
| Palantir | Lever | `api.lever.co/v0/postings/palantir?mode=json` |
| SoFi | Greenhouse | `boards-api.greenhouse.io/v1/boards/sofi/jobs?content=true` |
| Block | Greenhouse | `boards-api.greenhouse.io/v1/boards/block/jobs?content=true` |
| Plaid | Ashby | `api.ashbyhq.com/posting-api/job-board/plaid` |
| Upstart | Greenhouse | `boards-api.greenhouse.io/v1/boards/upstart/jobs?content=true` |
| LendingTree | Greenhouse | `boards-api.greenhouse.io/v1/boards/lendingtree/jobs?content=true` |
| Current | Greenhouse | `boards-api.greenhouse.io/v1/boards/current/jobs?content=true` |
| Bank of America | Workday | `ghr.wd1.myworkdayjobs.com/wday/cxs/ghr/Lateral-US/jobs` |
| Capital One | Workday | `capitalone.wd12.myworkdayjobs.com/wday/cxs/capitalone/Capital_One/jobs` |
| Wells Fargo | Workday | `wf.wd1.myworkdayjobs.com/wday/cxs/wf/WellsFargoJobs/jobs` |
| Amazon | Amazon Jobs JSON | `amazon.jobs/en/search.json?base_query=finance` |

Greenhouse's public job-board API, Lever's public Postings API, and Ashby's public Job Postings API are used directly. The pipeline never reads the HTML of a job board and does not require login credentials.

## Title rule

The entry-level role rule marks a posting `in_role=true` when its title contains one of these role names:

- Financial Analyst
- Junior Financial Analyst
- FP&A Analyst
- Financial Planning Analyst
- Business Finance Analyst
- Sales Finance Analyst
- Corporate Finance Analyst
- Finance Operations Analyst
- Finance Rotational Analyst
- Treasury Analyst
- Credit Analyst

The rule also recognizes Finance Analyst and common reversed forms such as Credit Analyst, Finance. It excludes titles containing Senior, Sr, Lead, Principal, Staff, Manager, Director, Vice President, VP, Head, Intern, Internship, or analyst levels II–V. All postings remain in the history; the rule only labels them. Optional source text is parsed into early-career, experience-years, education, workplace, schedule, and salary metadata.

## Pipeline and data

GitHub Actions runs `python -m job_watcher.pipeline` once a day. Each source is attempted independently. Successful responses are saved as `data/raw/YYYY-MM-DD/<source>.json.gz`; failed sources write no raw file and are recorded in `data/status.json`. A rerun replaces that day's raw snapshots.

The history is rebuilt from raw snapshots alone. The deterministic command is:

```bash
uv run python -m job_watcher.build_history --base-dir .
```

`data/history.csv` has one row per posting, sorted by `posting_id`, with the exact rubric columns. `data/details.json` stores optional salary, schedule, workplace, experience, education, and `finance_area` metadata separately so the rubric CSV stays unchanged. Reappearing postings are reopened with their original `first_seen` date; missing open postings are removed only when their source has a raw snapshot for that day. The daily workflow runs `python -m job_watcher.quality` before committing generated data.

When GitHub credentials are available, the pipeline opens or updates an issue titled with the UTC date, lists new and removed postings with links, and closes the previous day's issue. GitHub Actions commits the raw files, history, details, and status files after each run.

## Site

- `index.html` is the Today page with run time, source health, four status counts, and new/removed lists.
- `browse.html` is the Browse page with entry-level, all-finance, and all-U.S.-posting scopes; multi-employer/multi-state location filters; days-open/workplace/schedule/posted-date/experience/salary filters; title search; sorting; apply links; match explanations; freshness/availability labels; shareable URLs; saved searches; local alert counts; browser-persisted shortlist stars; and progressive loading for large result sets.
- Browse is U.S.-only and includes a 21-employer directory linking to official finance and corporate job boards, with entry-level role names shown for each employer. Six additional fintech and lending companies are connected to validated ATS feeds; cards label feed coverage and filtered results are deduplicated.
- `market.html` is the Market page. It calculates all six rubric sections in the browser from `data/history.csv` and renders charts without an external chart library.
- `manifest.webmanifest` and `service-worker.js` make the site installable. Data requests are network-first online and cached for offline use.

Enable GitHub Pages with the **GitHub Actions** source. The Pages workflow publishes the repository root, where `index.html` is the site entry point.

## File guide

| File | Purpose |
| --- | --- |
| `job_watcher/config.py` | Employer list, ATS configuration, role names, and title-rule description. |
| `job_watcher/normalize.py` | Greenhouse, Lever, Ashby, Workday, and Amazon JSON adapters plus common-column conversion. |
| `job_watcher/history.py` | Raw-file discovery, deterministic history logic, CSV writing, and history loading. |
| `job_watcher/pipeline.py` | Daily fetch, compressed raw snapshots, history/status output, and run orchestration. |
| `job_watcher/github_issues.py` | Daily Issue creation/update and previous-Issue closing. |
| `job_watcher/build_history.py` | Command-line history rebuild from `data/raw` only. |
| `job_watcher/quality.py` | Generated-data validation used by the daily workflow. |
| `tests/test_normalize.py` | Adapter conversion and title-rule tests. |
| `tests/test_history.py` | First-run, first-seen, last-seen, removal, reopening, sorting, and reproducibility tests. |
| `data/raw/` | Compressed daily source snapshots. |
| `data/history.csv` | Fixed-path posting history. |
| `data/status.json` | Fixed-path latest-run status and source health. |
| `data/details.json` | Optional salary, schedule, workplace, experience, education, and finance-area metadata keyed by posting ID. |
| `index.html` | Today page. |
| `browse.html` | Browse and shortlist page. |
| `market.html` | Browser-calculated market report. |
| `app.js` | Shared data loader, page rendering, filters, shortlist, and charts. |
| `styles.css` | Shared site layout, typography, colors, and responsive styling. |
| `manifest.webmanifest` | Installable web-app metadata. |
| `service-worker.js` | Offline shell and data caching. |
| `icon.svg` | App icon. |
| `.github/workflows/tests.yml` | Pytest on every push and pull request. |
| `.github/workflows/daily.yml` | Daily fetch, Issue, data commit, and push. |
| `.github/workflows/pages.yml` | GitHub Pages deployment. |
| `pyproject.toml` | Python package and test dependencies. |
