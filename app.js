/* Shared browser-side data loading, filtering, charts, and page rendering. */

const state = { status: null, rows: [], details: {} };
const ROLE_SHORTLIST_KEY = "finance-job-watcher-shortlist-v1";
const BROWSE_PREFS_KEY = "finance-job-watcher-browse-preferences-v1";
const SAVED_SEARCHES_KEY = "finance-job-watcher-saved-searches-v1";
const APP_VERSION = "14";
const US_STATE_CODES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
const FOCUS_EMPLOYERS = [
  { name: "JPMorgan Chase", group: "Financial services", url: "https://www.jpmorganchase.com/careers", roles: ["Financial Analyst", "Treasury Analyst", "Credit Analyst"] },
  { name: "Bank of America", group: "Financial services", url: "https://careers.bankofamerica.com/en-us/job-search", roles: ["Financial Analyst", "FP&A Analyst", "Credit Analyst"] },
  { name: "Wells Fargo", group: "Financial services", url: "https://www.wellsfargojobs.com/en/jobs/", roles: ["Financial Analyst", "Treasury Analyst", "Credit Analyst"] },
  { name: "Citi", group: "Financial services", url: "https://jobs.citi.com/", roles: ["Financial Analyst", "Treasury Analyst", "Credit Analyst"] },
  { name: "Goldman Sachs", group: "Financial services", url: "https://www.goldmansachs.com/careers", roles: ["Financial Analyst", "Credit Analyst", "Finance Rotational Analyst"] },
  { name: "Morgan Stanley", group: "Financial services", url: "https://www.morganstanley.com/careers/career-opportunities-search", roles: ["Financial Analyst", "FP&A Analyst", "Credit Analyst"] },
  { name: "Capital One", group: "Financial services", url: "https://www.capitalonecareers.com/search-jobs", roles: ["Financial Analyst", "Treasury Analyst", "Credit Analyst"] },
  { name: "Charles Schwab", group: "Financial services", url: "https://www.schwabjobs.com/en/search-jobs", roles: ["Financial Analyst", "Credit Analyst", "Finance Rotational Analyst"] },
  { name: "Amazon", group: "Corporate finance", url: "https://www.amazon.jobs/en/search", roles: ["Financial Analyst", "FP&A Analyst", "Finance Rotational Analyst"] },
  { name: "Microsoft", group: "Corporate finance", url: "https://jobs.careers.microsoft.com/global/en/search", roles: ["Financial Analyst", "FP&A Analyst", "Finance Rotational Analyst"] },
  { name: "Apple", group: "Corporate finance", url: "https://jobs.apple.com/en-us/search", roles: ["Financial Analyst", "FP&A Analyst", "Treasury Analyst"] },
  { name: "Walmart", group: "Corporate finance", url: "https://careers.walmart.com/us/en/search-results", roles: ["Financial Analyst", "FP&A Analyst", "Finance Rotational Analyst"] },
  { name: "PepsiCo", group: "Corporate finance", url: "https://www.pepsicojobs.com/main/jobs", roles: ["Financial Analyst", "FP&A Analyst", "Finance Rotational Analyst"] },
  { name: "United Airlines", group: "Corporate finance", url: "https://careers.united.com/us/en/search-results", roles: ["Financial Analyst", "FP&A Analyst", "Treasury Analyst"] },
  { name: "McDonald's", group: "Corporate finance", url: "https://careers.mcdonalds.com/", roles: ["Financial Analyst", "FP&A Analyst", "Finance Rotational Analyst"] },
];
const ADDITIONAL_FINANCE_EMPLOYERS = [
  { name: "SoFi", group: "Fintech", url: "https://sofi.com/careers", roles: ["Financial Analyst", "FP&A Analyst", "Corporate Finance Analyst"], feed: true },
  { name: "Block", group: "Fintech", url: "https://block.xyz/careers", roles: ["Financial Analyst", "Business Finance Analyst", "Treasury Analyst"], feed: true },
  { name: "Plaid", group: "Fintech", url: "https://jobs.ashbyhq.com/plaid", roles: ["Financial Analyst", "FP&A Analyst", "Finance Operations Analyst"], feed: true },
  { name: "Upstart", group: "Lending and credit", url: "https://careers.upstart.com", roles: ["Financial Analyst", "Credit Analyst", "FP&A Analyst"], feed: true },
  { name: "LendingTree", group: "Lending and credit", url: "https://www.lendingtree.com/careers", roles: ["Financial Analyst", "FP&A Analyst", "Credit Analyst"], feed: true },
  { name: "Current", group: "Fintech", url: "https://current.com/careers", roles: ["Financial Analyst", "Business Finance Analyst", "FP&A Analyst"], feed: true },
  { name: "Adyen", group: "Payments", url: "https://careers.adyen.com/", roles: ["Financial Analyst", "Risk Analyst", "Credit Analyst"], feed: true },
  { name: "Webflow", group: "Corporate finance", url: "https://webflow.com/careers", roles: ["Financial Analyst", "FP&A Analyst", "Business Finance Analyst"], feed: true },
  { name: "Marqeta", group: "Payments", url: "https://www.marqeta.com/company/careers", roles: ["Financial Analyst", "Credit Analyst", "Risk Analyst"], feed: true },
];
const DIRECTORY_EMPLOYERS = [...FOCUS_EMPLOYERS, ...ADDITIONAL_FINANCE_EMPLOYERS];
const US_STATES = [
  ["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"], ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"], ["Delaware", "DE"], ["Florida", "FL"], ["Georgia", "GA"], ["Hawaii", "HI"], ["Idaho", "ID"], ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"], ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"], ["Massachusetts", "MA"], ["Michigan", "MI"], ["Minnesota", "MN"], ["Mississippi", "MS"], ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"], ["New Hampshire", "NH"], ["New Jersey", "NJ"], ["New Mexico", "NM"], ["New York", "NY"], ["North Carolina", "NC"], ["North Dakota", "ND"], ["Ohio", "OH"], ["Oklahoma", "OK"], ["Oregon", "OR"], ["Pennsylvania", "PA"], ["Rhode Island", "RI"], ["South Carolina", "SC"], ["South Dakota", "SD"], ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"], ["Vermont", "VT"], ["Virginia", "VA"], ["Washington", "WA"], ["West Virginia", "WV"], ["Wisconsin", "WI"], ["Wyoming", "WY"], ["District of Columbia", "DC"],
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') { quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function loadData() {
  let status, csv, details = {};
  const needsDetails = document.body.dataset.page !== "today";
  try {
    const [statusResponse, csvResponse, detailsResponse] = await Promise.all([
      fetch("./data/status.json", { cache: "no-store" }),
      fetch("./data/history.csv", { cache: "no-store" }),
      needsDetails ? fetch(`./data/details.json?v=${APP_VERSION}`, { cache: "no-store" }) : Promise.resolve(null),
    ]);
    if (!statusResponse.ok || !csvResponse.ok) throw new Error("The data files could not be loaded.");
    status = await statusResponse.json();
    csv = await csvResponse.text();
    if (detailsResponse?.ok) details = await detailsResponse.json();
    try {
      localStorage.setItem("finance-job-watcher-status", JSON.stringify(status));
      localStorage.setItem("finance-job-watcher-history", csv);
    } catch { /* Keep the live response when browser storage is full. */ }
    try { localStorage.setItem("finance-job-watcher-details", JSON.stringify(details)); } catch { /* Details remain available for this session. */ }
  } catch (error) {
    const savedStatus = localStorage.getItem("finance-job-watcher-status");
    const savedCsv = localStorage.getItem("finance-job-watcher-history");
    if (!savedStatus || savedCsv === null) throw error;
    status = JSON.parse(savedStatus);
    csv = savedCsv;
    if (needsDetails) {
      try { details = JSON.parse(localStorage.getItem("finance-job-watcher-details") || "{}"); } catch { details = {}; }
    }
  }
  state.status = status;
  state.rows = parseCsv(csv);
  state.details = details || {};
  return state;
}

function latestDate() {
  return (state.status.run_time || "").slice(0, 10) || state.rows.reduce((latest, row) => row.last_seen > latest ? row.last_seen : latest, "");
}

function dataThrough() {
  return (state.status.run_time || "").slice(0, 10) || state.rows.reduce((latest, row) => row.last_seen > latest ? row.last_seen : latest, "") || "No run yet";
}

function dateDiff(start, end) {
  if (!start || !end) return null;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
}

function displayDate(value) {
  if (!value) return "Not listed";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatSalary(detail) {
  const minimum = Number(detail?.salary_min), maximum = Number(detail?.salary_max);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0 || maximum <= 0) return "";
  const currency = detail.salary_currency || "USD";
  const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 });
  return `${formatter.format(minimum)}–${formatter.format(maximum)}`;
}

function browsePreferences() {
  try { return JSON.parse(localStorage.getItem(BROWSE_PREFS_KEY) || "{}"); } catch { return {}; }
}

function saveBrowsePreferences(preferences) { try { localStorage.setItem(BROWSE_PREFS_KEY, JSON.stringify(preferences)); } catch { /* Preferences are a convenience, not a load blocker. */ } }
function savedSearches() { try { return JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || "[]"); } catch { return []; } }
function saveSearches(searches) { try { localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches)); } catch { /* Saved searches are local-only. */ } }
function preferenceList(value) { if (Array.isArray(value)) return value.filter(Boolean); if (typeof value === "string" && value) return value.split("|").filter(Boolean); return []; }
function selectedValues(element) { return Array.from(element.selectedOptions || []).map((option) => option.value).filter(Boolean); }
function setSelectedValues(element, values, fallback = []) {
  const desired = new Set(preferenceList(values));
  if (!desired.size) fallback.forEach((value) => desired.add(value));
  Array.from(element.options).forEach((option) => { option.selected = desired.has(option.value); });
}
function urlPreferences() {
  const params = new URLSearchParams(window.location.search);
  if (![...params.keys()].length) return {};
  const scope = params.get("scope") || (params.get("role") === "all" ? "all" : "entry");
  return {
    scope,
    onlyRole: scope === "entry",
    employer: params.getAll("employer"),
    location: params.getAll("location"),
    daysOpen: params.get("days") || "",
    workplace: params.get("workplace") || "",
    employment: params.get("schedule") || "",
    postedWithin: params.get("posted") || "",
    experience: params.get("experience") || "",
    minimumSalary: params.get("minSalary") || "",
    titleSearch: params.get("title") || "",
    sort: params.get("sort") || "newest",
  };
}
function writeFilterUrl(preferences) {
  const params = new URLSearchParams();
  if (preferences.scope && preferences.scope !== "entry") params.set("scope", preferences.scope);
  preferenceList(preferences.employer).forEach((value) => params.append("employer", value));
  preferenceList(preferences.location).forEach((value) => params.append("location", value));
  if (preferences.daysOpen) params.set("days", preferences.daysOpen);
  if (preferences.workplace) params.set("workplace", preferences.workplace);
  if (preferences.employment) params.set("schedule", preferences.employment);
  if (preferences.postedWithin) params.set("posted", preferences.postedWithin);
  if (preferences.experience) params.set("experience", preferences.experience);
  if (preferences.minimumSalary) params.set("minSalary", preferences.minimumSalary);
  if (preferences.titleSearch) params.set("title", preferences.titleSearch);
  if (preferences.sort && preferences.sort !== "newest") params.set("sort", preferences.sort);
  const query = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function isTrue(value) { return value === true || value === "true"; }
function emptyMessage(message) { return `<div class="empty">${escapeHtml(message)}</div>`; }

function isUnitedStatesLocation(location) {
  const value = String(location || "").trim();
  if (!value) return false;
  if (/\b(united states|u\.s\.a?\.?|usa|remote\s*\(?us\)?|us\s*remote)\b/i.test(value)) return true;
  const tokens = value.toUpperCase().replace(/[^A-Z\s]/g, " ").split(/\s+/).filter(Boolean);
  return tokens.some((token) => US_STATE_CODES.has(token));
}

function matchesMarketLocation(location, selected) {
  if (!selected || selected === "__US__") return isUnitedStatesLocation(location);
  const state = US_STATES.find(([name]) => name === selected);
  if (!state) return true;
  const value = String(location || "").toUpperCase();
  const tokens = value.replace(/[^A-Z\s]/g, " ").split(/\s+/).filter(Boolean);
  return value.includes(state[0].toUpperCase()) || tokens.includes(state[1]);
}

function isFinancePosting(row, detail = state.details[row.posting_id] || {}) {
  if (isTrue(detail.finance_area)) return true;
  return /\b(finance|financial|fp\s*&\s*a|accounting|treasury|credit|audit|risk|investment|controller|tax|revenue|pricing)\b/i.test(`${row.title || ""} ${row.department || ""}`);
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const url = String(row.url || "").toLowerCase().split("?")[0];
    const key = url || `${row.employer}|${row.title}|${row.location}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchReason(row, preferences, detail) {
  if (preferences.scope === "all") return "U.S. posting from a connected public feed";
  if (preferences.scope === "finance") return isTrue(detail.finance_area) ? "Title, department, or description contains a finance-area keyword" : "Title or department contains a finance-area keyword";
  return "Title matches the entry-level finance role rule";
}

function rowLink(row) {
  const url = row.url || "#";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.title || "Untitled posting")}</a>`;
}

function compactRow(row) {
  return `<div class="job-row"><span class="job-title">${rowLink(row)}</span><span class="job-meta">${escapeHtml(row.employer)} · ${escapeHtml(row.location || "Location not listed")}</span></div>`;
}

function showError(error) {
  const box = document.getElementById("load-error");
  if (box) { box.textContent = `Data could not be loaded: ${error.message}`; box.classList.remove("hidden"); }
}

function renderToday() {
  setText("last-run", dataThrough());
  setText("metric-days", state.status.days_with_success ?? 0);
  setText("metric-open", state.status.open ?? 0);
  setText("metric-new", state.status.new_today ?? 0);
  setText("metric-removed", state.status.removed_today ?? 0);
  const day = dataThrough();
  const newRows = state.rows.filter((row) => row.first_seen === day && !isTrue(row.first_run));
  const removedRows = state.rows.filter((row) => row.removed_date === day);
  document.getElementById("new-list").innerHTML = newRows.length ? newRows.map(compactRow).join("") : emptyMessage("No new postings in the latest run.");
  document.getElementById("removed-list").innerHTML = removedRows.length ? removedRows.map(compactRow).join("") : emptyMessage("No postings were removed in the latest run.");
  const sources = state.status.sources || [];
  setText("metric-healthy", sources.filter((source) => source.ok).length);
  setText("health-summary", `${sources.filter((source) => source.ok).length} of ${sources.length} boards returned data on the latest run.`);
  document.getElementById("source-table").innerHTML = sources.map((source) => {
    const note = source.ok ? `${source.count} postings` : (source.error || "No response");
    const lastSuccessful = source.last_successful_run || (source.ok ? dataThrough() : "No successful run");
    return `<tr><td><strong>${escapeHtml(source.name)}</strong></td><td><span class="status ${source.ok ? "" : "bad"}">${source.ok ? "Healthy" : "Needs attention"}</span><small class="source-note">${escapeHtml(note)}</small></td><td>${escapeHtml(displayDate(lastSuccessful))}</td><td>${escapeHtml(dataThrough())}</td></tr>`;
  }).join("") || `<tr><td colspan="4" class="muted">No source run recorded yet.</td></tr>`;
}

function getShortlist() { try { return new Set(JSON.parse(localStorage.getItem(ROLE_SHORTLIST_KEY) || "[]")); } catch { return new Set(); } }
function saveShortlist(set) { localStorage.setItem(ROLE_SHORTLIST_KEY, JSON.stringify([...set])); }

function browsePreferencesFromControls() {
  const scope = document.getElementById("role-scope").value;
  return {
    scope,
    onlyRole: scope === "entry",
    employer: selectedValues(document.getElementById("employer-filter")),
    location: selectedValues(document.getElementById("location-filter")),
    daysOpen: document.getElementById("days-open-filter").value,
    workplace: document.getElementById("workplace-filter").value,
    employment: document.getElementById("employment-filter").value,
    postedWithin: document.getElementById("posted-within-filter").value,
    experience: document.getElementById("experience-filter").value,
    minimumSalary: document.getElementById("minimum-salary-filter").value,
    titleSearch: document.getElementById("title-search").value,
    sort: document.getElementById("sort-order").value,
  };
}

function applyBrowsePreferences(preferences) {
  const scope = preferences.scope || (preferences.onlyRole === false ? "all" : "entry");
  document.getElementById("role-scope").value = scope;
  setSelectedValues(document.getElementById("employer-filter"), preferences.employer, [""]);
  setSelectedValues(document.getElementById("location-filter"), preferences.location, ["__US__"]);
  ["daysOpen", "minimumSalary", "titleSearch"].forEach((key) => {
    const id = { daysOpen: "days-open-filter", minimumSalary: "minimum-salary-filter", titleSearch: "title-search" }[key];
    document.getElementById(id).value = preferences[key] || "";
  });
  ["workplace", "employment", "postedWithin", "experience", "sort"].forEach((key) => {
    const id = { workplace: "workplace-filter", employment: "employment-filter", postedWithin: "posted-within-filter", experience: "experience-filter", sort: "sort-order" }[key];
    const element = document.getElementById(id);
    if (Array.from(element.options).some((option) => option.value === (preferences[key] || ""))) element.value = preferences[key] || "";
  });
}

function matchesBrowseRow(row, preferences, last) {
  if (row.status !== "open") return false;
  const employers = preferenceList(preferences.employer);
  const locations = preferenceList(preferences.location);
  if ((locations.length ? locations : ["__US__"]).includes("__US__")) {
    if (!isUnitedStatesLocation(row.location)) return false;
  } else if (!locations.some((location) => matchesMarketLocation(row.location, location))) return false;
  const detail = state.details[row.posting_id] || {};
  const scope = preferences.scope || (preferences.onlyRole === false ? "all" : "entry");
  if (scope === "entry" && !isTrue(row.in_role)) return false;
  if (scope === "finance" && !isFinancePosting(row, detail)) return false;
  if (employers.length && !employers.includes(row.employer)) return false;
  if (preferences.titleSearch && !String(row.title || "").toLowerCase().includes(preferences.titleSearch.trim().toLowerCase())) return false;
  if (preferences.daysOpen !== "" && (dateDiff(row.first_seen, last) ?? 0) > Number(preferences.daysOpen)) return false;
  const workplaceText = `${detail.workplace_type || ""} ${row.location || ""}`.toLowerCase();
  if (preferences.workplace === "Remote" && !workplaceText.includes("remote")) return false;
  if (preferences.workplace === "Hybrid" && !workplaceText.includes("hybrid")) return false;
  if (preferences.workplace === "On-site" && (workplaceText.includes("remote") || workplaceText.includes("hybrid"))) return false;
  if (preferences.employment === "full-time" && !String(detail.employment_type || "").toLowerCase().replace(/[-_]/g, " ").includes("full")) return false;
  if (preferences.postedWithin !== "") {
    const postedAge = dateDiff(row.posted_date || row.first_seen, last);
    if (postedAge === null || postedAge > Number(preferences.postedWithin)) return false;
  }
  if (preferences.experience === "early" && detail.experience_level !== "Early career") return false;
  if (preferences.experience === "unspecified" && detail.experience_level) return false;
  const minimumSalary = Number(preferences.minimumSalary);
  if (Number.isFinite(minimumSalary) && minimumSalary > 0 && Number(detail.salary_max || 0) < minimumSalary) return false;
  return true;
}

function filterBrowseRows(preferences) {
  const last = dataThrough();
  return dedupeRows(state.rows.filter((row) => matchesBrowseRow(row, preferences, last))).sort((a, b) => {
    const aDate = a.posted_date || a.first_seen || "";
    const bDate = b.posted_date || b.first_seen || "";
    return preferences.sort === "oldest" ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
  });
}

function searchLabel(preferences) {
  const scopeLabel = { entry: "Entry-level roles", finance: "All finance openings", all: "All U.S. postings" }[preferences.scope || (preferences.onlyRole ? "entry" : "all")];
  const roles = preferences.titleSearch || scopeLabel;
  const employers = preferenceList(preferences.employer);
  const locations = preferenceList(preferences.location);
  const place = locations.includes("__US__") || !locations.length ? "United States" : locations.join(", ");
  return `${roles} · ${employers.length ? employers.join(", ") : "All employers"} · ${place}`;
}

function renderSavedSearches(currentPreferences) {
  const container = document.getElementById("saved-search-list");
  if (!container) return;
  const searches = savedSearches();
  if (!searches.length) {
    container.innerHTML = `<div class="saved-search-empty">Save a filter combination to track new matches from this browser.</div>`;
    return;
  }
  const last = dataThrough();
  container.innerHTML = searches.map((search) => {
    const matches = filterBrowseRows(search.preferences);
    const newMatches = matches.filter((row) => row.first_seen === last && !isTrue(row.first_run)).length;
    const emailLink = `mailto:?subject=${encodeURIComponent(`Finance Job Watcher: ${search.name}`)}&body=${encodeURIComponent(`Open this saved search: ${window.location.href}`)}`;
    return `<article class="saved-search"><div><strong>${escapeHtml(search.name)}</strong><small>${matches.length} match${matches.length === 1 ? "" : "es"}${newMatches ? ` · ${newMatches} new today` : ""}</small></div><div class="saved-search-actions"><button class="mini-button" type="button" data-use-search="${escapeHtml(search.id)}">Use</button><a class="mini-button" href="${escapeHtml(emailLink)}">Email link</a><button class="mini-button danger" type="button" data-delete-search="${escapeHtml(search.id)}">Delete</button></div></article>`;
  }).join("");
}

function renderBrowse() {
  setText("last-run", dataThrough());
  const employerFilter = document.getElementById("employer-filter");
  const locationFilter = document.getElementById("location-filter");
  const loadMore = document.getElementById("load-more-postings");
  let visibleLimit = 60;
  const matchingEmployerCounts = state.rows.filter((row) => row.status === "open" && isFinancePosting(row) && isUnitedStatesLocation(row.location)).reduce((counts, row) => { counts[row.employer] = (counts[row.employer] || 0) + 1; return counts; }, {});
  const directoryNames = new Set(DIRECTORY_EMPLOYERS.map((company) => company.name));
  const additionalEmployers = Object.keys(matchingEmployerCounts).filter((name) => !directoryNames.has(name)).sort();
  const focusOptions = FOCUS_EMPLOYERS.map((company) => {
    const count = matchingEmployerCounts[company.name];
    const suffix = count ? ` (${count} available)` : " (official board)";
    return `<option value="${escapeHtml(company.name)}">${escapeHtml(company.name + suffix)}</option>`;
  }).join("");
  const validatedOptions = ADDITIONAL_FINANCE_EMPLOYERS.map((company) => {
    const count = matchingEmployerCounts[company.name];
    const suffix = count ? ` (${count} available)` : " (feed connected)";
    return `<option value="${escapeHtml(company.name)}">${escapeHtml(company.name + suffix)}</option>`;
  }).join("");
  const additionalOptions = additionalEmployers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(`${name} (${matchingEmployerCounts[name]} available)`)}</option>`).join("");
  document.getElementById("focus-employers").innerHTML = DIRECTORY_EMPLOYERS.map((company) => {
    const count = matchingEmployerCounts[company.name] || 0;
    const source = (state.status.sources || []).find((item) => item.name === company.name);
    const coverage = source ? (source.ok ? "Validated public feed" : "Feed connected · needs attention") : (company.feed ? "Validated feed · awaiting first run" : "Official board only");
    const availability = count ? `${count} tracked U.S. finance posting${count === 1 ? "" : "s"}` : coverage;
    return `<a class="focus-card" href="${escapeHtml(company.url)}" target="_blank" rel="noopener noreferrer"><div><strong>${escapeHtml(company.name)}</strong><small>${escapeHtml(company.group)} · ${escapeHtml(availability)}</small><div class="role-chips">${company.roles.map((role) => `<span class="role-chip">${escapeHtml(role)}</span>`).join("")}</div></div><span class="external-arrow">↗</span></a>`;
  }).join("");
  employerFilter.innerHTML = `<option value="">All finance employers</option><optgroup label="Focus employers">${focusOptions}</optgroup><optgroup label="More validated finance companies">${validatedOptions}</optgroup>${additionalOptions ? `<optgroup label="Other employers with matching roles">${additionalOptions}</optgroup>` : ""}`;
  locationFilter.innerHTML = `<option value="__US__">United States · all states</option>${US_STATES.map(([name]) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  const preferences = { scope: "entry", onlyRole: true, location: ["__US__"], sort: "newest", ...browsePreferences(), ...urlPreferences() };
  applyBrowsePreferences(preferences);

  const update = (resetLimit = false) => {
    if (resetLimit) visibleLimit = 60;
    const current = browsePreferencesFromControls();
    const filtered = filterBrowseRows(current);
    const shortlist = getShortlist();
    saveBrowsePreferences(current);
    writeFilterUrl(current);
    setText("browse-count", filtered.length);
    setText("shortlist-count", shortlist.size);
    const metadataCount = Object.values(state.details).filter((detail) => detail.salary_max || detail.workplace_type || detail.employment_type || detail.experience_level || isTrue(detail.finance_area)).length;
    setText("browse-freshness", `Updated ${displayDate(dataThrough())} · ${Object.keys(matchingEmployerCounts).length} finance employers · ${metadataCount} enriched postings`);
    const list = document.getElementById("browse-list");
    const last = dataThrough();
    if (filtered.length) {
      const visibleRows = filtered.slice(0, visibleLimit);
      list.innerHTML = visibleRows.map((row) => {
        const detail = state.details[row.posting_id] || {};
        const salary = formatSalary(detail);
        const postedLabel = row.posted_date ? `Posted ${displayDate(row.posted_date)}` : `First seen ${displayDate(row.first_seen)}`;
        const metadataTags = [detail.workplace_type, detail.employment_type, detail.experience_level, detail.experience_years, detail.education_requirement, salary ? `Salary ${salary}` : ""].filter(Boolean).map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join("");
        const reason = matchReason(row, current, detail);
        return `<article class="job-card"><button class="star ${shortlist.has(row.posting_id) ? "saved" : ""}" data-star="${escapeHtml(row.posting_id)}" aria-label="${shortlist.has(row.posting_id) ? "Remove from" : "Add to"} shortlist" title="${shortlist.has(row.posting_id) ? "Remove from" : "Add to"} shortlist">${shortlist.has(row.posting_id) ? "★" : "☆"}</button><div class="job-card-kicker">${current.scope === "entry" && isTrue(row.in_role) ? "Entry-level match" : current.scope === "finance" ? "Finance-area match" : "U.S. posting"}</div><h3>${rowLink(row)}</h3><p>${escapeHtml(row.employer)} · ${escapeHtml(row.location || "Location not listed")}</p><div class="tags"><span class="tag ${isTrue(row.in_role) ? "role" : ""}">${isTrue(row.in_role) ? "Entry-level title" : "Finance-area posting"}</span><span class="tag">${escapeHtml(row.department || "Department not listed")}</span><span class="tag">${escapeHtml(postedLabel)}</span>${metadataTags}</div><p class="match-reason"><strong>Why this matched:</strong> ${escapeHtml(reason)}</p><div class="job-card-footer"><small>${escapeHtml(String(dateDiff(row.first_seen, last) ?? 0))} days in watch · Checked ${escapeHtml(displayDate(last))} · Available</small><a class="apply-link" href="${escapeHtml(row.url || "#")}" target="_blank" rel="noopener noreferrer">Apply ↗</a></div></article>`;
      }).join("");
    } else {
      const employers = preferenceList(current.employer);
      const company = employers.length === 1 ? DIRECTORY_EMPLOYERS.find((item) => item.name === employers[0]) : null;
      list.innerHTML = company ? `<div class="empty browse-empty"><span>No tracked roles match these filters.</span><a class="text-link" href="${escapeHtml(company.url)}" target="_blank" rel="noopener noreferrer">Check ${escapeHtml(company.name)}'s official board ↗</a></div>` : emptyMessage("No open postings match these filters.");
    }
    loadMore.hidden = filtered.length <= visibleLimit;
    if (!loadMore.hidden) loadMore.textContent = `Show more postings (${visibleLimit} of ${filtered.length})`;
    renderSavedSearches(current);
  };
  ["role-scope", "employer-filter", "location-filter", "days-open-filter", "title-search", "sort-order", "workplace-filter", "employment-filter", "posted-within-filter", "experience-filter", "minimum-salary-filter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => update(true));
    document.getElementById(id).addEventListener("change", () => update(true));
  });
  document.getElementById("reset-filters").addEventListener("click", () => {
    applyBrowsePreferences({ scope: "entry", onlyRole: true, employer: [], location: ["__US__"], daysOpen: "", workplace: "", employment: "", postedWithin: "", experience: "", minimumSalary: "", titleSearch: "", sort: "newest" });
    update(true);
  });
  loadMore.addEventListener("click", () => {
    visibleLimit += 60;
    update();
  });
  document.getElementById("browse-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-star]");
    if (!button) return;
    const shortlist = getShortlist();
    if (shortlist.has(button.dataset.star)) shortlist.delete(button.dataset.star); else shortlist.add(button.dataset.star);
    saveShortlist(shortlist);
    update();
  });
  document.getElementById("save-search")?.addEventListener("click", () => {
    const current = browsePreferencesFromControls();
    const searches = savedSearches();
    const duplicate = searches.find((search) => JSON.stringify(search.preferences) === JSON.stringify(current));
    if (!duplicate) searches.unshift({ id: String(Date.now()), name: searchLabel(current), preferences: current, createdAt: new Date().toISOString() });
    saveSearches(searches.slice(0, 10));
    setText("save-search-status", duplicate ? "Already saved" : "Search saved");
    renderSavedSearches(current);
  });
  document.getElementById("copy-search")?.addEventListener("click", async () => {
    const link = window.location.href;
    try { await navigator.clipboard.writeText(link); setText("save-search-status", "Share link copied"); } catch { setText("save-search-status", link); }
  });
  document.getElementById("saved-search-list")?.addEventListener("click", (event) => {
    const useButton = event.target.closest("[data-use-search]");
    const deleteButton = event.target.closest("[data-delete-search]");
    const searches = savedSearches();
    if (useButton) {
      const found = searches.find((search) => search.id === useButton.dataset.useSearch);
      if (found) { applyBrowsePreferences(found.preferences); update(); }
    }
    if (deleteButton) { saveSearches(searches.filter((search) => search.id !== deleteButton.dataset.deleteSearch)); renderSavedSearches(browsePreferencesFromControls()); }
  });
  update();
}

function drawGroupedBars(container, labels, sets) {
  const width = Math.max(720, labels.length * 76), height = 260, left = 42, bottom = 42, top = 20, chartWidth = width - left - 18, chartHeight = height - top - bottom;
  const max = Math.max(1, ...sets.flatMap((set) => set.values));
  const groupWidth = chartWidth / Math.max(1, labels.length), barWidth = Math.max(8, Math.min(25, groupWidth / (sets.length + 1)));
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(labels.join(", "))}">`;
  [0, .5, 1].forEach((fraction) => { const y = top + chartHeight * (1 - fraction); svg += `<line class="chart-gridline" x1="${left}" x2="${width - 18}" y1="${y}" y2="${y}" /><text class="chart-label" x="2" y="${y + 4}">${Math.round(max * fraction)}</text>`; });
  labels.forEach((label, index) => {
    const x = left + groupWidth * index + groupWidth / 2;
    svg += `<text class="chart-label" text-anchor="middle" x="${x}" y="${height - 14}">${escapeHtml(label.length > 11 ? `${label.slice(0, 10)}…` : label)}</text>`;
    sets.forEach((set, setIndex) => { const value = Number(set.values[index] || 0), h = chartHeight * value / max, barX = x - (sets.length * barWidth) / 2 + setIndex * barWidth; svg += `<rect x="${barX}" y="${top + chartHeight - h}" width="${Math.max(5, barWidth - 3)}" height="${h}" rx="3" fill="${set.color}" /><text class="chart-value" text-anchor="middle" x="${barX + barWidth / 2}" y="${Math.max(13, top + chartHeight - h - 5)}">${value || ""}</text>`; });
  });
  svg += "</svg>";
  container.innerHTML = svg;
}

function marketSection(id, heading, paragraph, chartClass = "") {
  return `<section class="panel market-section ${chartClass}"><p class="eyebrow">Market finding</p><h2>${escapeHtml(heading)}</h2><p id="${id}-paragraph">${escapeHtml(paragraph)}</p><div id="${id}-chart" class="chart-wrap"></div></section>`;
}

function countsBy(rows, key) { return rows.reduce((counts, row) => { const value = row[key] || "Unlisted"; counts[value] = (counts[value] || 0) + 1; return counts; }, {}); }
function sortedKeys(counts) { return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b)); }

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function renderMarketSnapshot(openRows, roleRows, last) {
  const recent = (days) => roleRows.filter((row) => !isTrue(row.first_run) && row.first_seen && dateDiff(row.first_seen, last) <= days).length;
  const salaries = roleRows.map((row) => Number(state.details[row.posting_id]?.salary_min)).filter((value) => value > 0);
  const salaryMedian = median(salaries);
  const locations = countsBy(openRows.filter((row) => isUnitedStatesLocation(row.location)), "location");
  const topLocation = sortedKeys(locations)[0] || "Not enough data";
  document.getElementById("market-snapshot").innerHTML = [
    ["7-day pulse", recent(7), "new finance roles"],
    ["30-day pulse", recent(30), "new finance roles"],
    ["Median salary", salaryMedian ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(salaryMedian) : "—", "from posted ranges"],
    ["Top U.S. market", topLocation, `${locations[topLocation] || 0} open roles`],
  ].map(([label, value, detail]) => `<article class="snapshot-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`).join("");
}

function renderMarket() {
  setText("last-run", dataThrough());
  document.getElementById("market-sections").innerHTML = [
    marketSection("new-per-day", "New postings arrive in waves", "First-run postings are left out because their true start date is unknown."),
    marketSection("removed-per-day", "Removals show when opportunity windows close", "Every posting removed on a source snapshot contributes to the day it disappeared."),
    marketSection("open-employer", "A small group of employers carries the largest open inventory", "Open postings are counted by employer as of the latest run."),
    marketSection("days-open", "Most observed roles stay open for a measurable window", "Days open is the median from first seen to removed, excluding first-run postings."),
    marketSection("within-seven", "Early removals reveal how quickly roles can disappear", "The share uses postings observed at least seven days before the latest run and counts removal within seven days."),
    marketSection("top-locations", "Open roles cluster in a few hiring markets", "Locations are counted among open postings, with missing locations grouped as Unlisted.", "wide"),
    marketSection("salary-benchmark", "Posted salary ranges reveal role bands", "Median minimum salary is shown for the most common finance role titles with published compensation.", "wide"),
  ].join("");
  const roleRows = state.rows.filter((row) => isTrue(row.in_role));
  const latestOpenRows = state.rows.filter((row) => row.status === "open");
  const last = dataThrough();
  renderMarketSnapshot(latestOpenRows, roleRows, last);
  const historical = state.rows.filter((row) => !isTrue(row.first_run));
  const newDays = Object.keys(countsBy(historical.filter((row) => row.first_seen), "first_seen")).sort();
  const roleCounts = countsBy(roleRows.filter((row) => !isTrue(row.first_run) && row.first_seen), "first_seen");
  const allCounts = countsBy(historical.filter((row) => row.first_seen), "first_seen");
  drawGroupedBars(document.getElementById("new-per-day-chart"), newDays, [{ name: "All", values: newDays.map((day) => allCounts[day] || 0), color: "#1f385e" }, { name: "Role", values: newDays.map((day) => roleCounts[day] || 0), color: "#0e8c82" }]);
  setText("new-per-day-paragraph", `${historical.filter((row) => row.first_seen).length} non-first-run postings were first seen across ${newDays.length} day${newDays.length === 1 ? "" : "s"}; ${roleRows.filter((row) => !isTrue(row.first_run) && row.first_seen).length} matched the entry-level finance title rule.`);

  const removedCounts = countsBy(state.rows.filter((row) => row.removed_date), "removed_date");
  const removedDays = Object.keys(removedCounts).sort();
  drawGroupedBars(document.getElementById("removed-per-day-chart"), removedDays.length ? removedDays : ["None"], [{ name: "Removed", values: removedDays.length ? removedDays.map((day) => removedCounts[day]) : [0], color: "#d66a50" }]);
  setText("removed-per-day-paragraph", `${state.rows.filter((row) => row.removed_date).length} postings have been removed across ${removedDays.length} day${removedDays.length === 1 ? "" : "s"}.`);

  const openRows = state.rows.filter((row) => row.status === "open"), employerCounts = countsBy(openRows, "employer"), employers = sortedKeys(employerCounts).slice(0, 15);
  drawGroupedBars(document.getElementById("open-employer-chart"), employers.length ? employers : ["None"], [{ name: "Open", values: employers.length ? employers.map((name) => employerCounts[name]) : [0], color: "#1f385e" }]);
  setText("open-employer-paragraph", `${openRows.length} postings remain open. ${employers.length ? `${employers[0]} has the most with ${employerCounts[employers[0]]}.` : "No open postings are available yet."}`);

  const daysOpen = state.rows.filter((row) => row.removed_date && !isTrue(row.first_run)).map((row) => dateDiff(row.first_seen, row.removed_date)).filter((value) => value !== null && value >= 0).sort((a, b) => a - b);
  const daysMedian = daysOpen.length ? (daysOpen.length % 2 ? daysOpen[(daysOpen.length - 1) / 2] : (daysOpen[daysOpen.length / 2 - 1] + daysOpen[daysOpen.length / 2]) / 2) : 0;
  drawGroupedBars(document.getElementById("days-open-chart"), ["Median days"], [{ name: "Days", values: [daysMedian], color: "#b7791f" }]);
  setText("days-open-paragraph", daysOpen.length ? `The median observed open window is ${daysMedian} day${daysMedian === 1 ? "" : "s"}, based on ${daysOpen.length} removed non-first-run postings.` : "There are not enough removed non-first-run postings to calculate this median yet.");

  const eligible = state.rows.filter((row) => !isTrue(row.first_run) && dateDiff(row.first_seen, last) >= 7);
  const fastRemoved = eligible.filter((row) => row.removed_date && dateDiff(row.first_seen, row.removed_date) <= 7).length;
  const slowerOrOpen = eligible.length - fastRemoved;
  drawGroupedBars(document.getElementById("within-seven-chart"), ["Eligible postings"], [{ name: "Within 7 days", values: [fastRemoved], color: "#d66a50" }, { name: "Other/open", values: [slowerOrOpen], color: "#dfe5ee" }]);
  setText("within-seven-paragraph", eligible.length ? `${fastRemoved} of ${eligible.length} eligible postings (${Math.round(100 * fastRemoved / eligible.length)}%) were removed within seven days of first seen.` : "No posting has been observable for at least seven days yet.");

  const locationCounts = countsBy(openRows, "location"), locations = sortedKeys(locationCounts).slice(0, 15);
  drawGroupedBars(document.getElementById("top-locations-chart"), locations.length ? locations : ["None"], [{ name: "Open", values: locations.length ? locations.map((location) => locationCounts[location]) : [0], color: "#0e8c82" }]);
  setText("top-locations-paragraph", `${openRows.length} open postings are spread across ${locations.length} locations in the top-location view.`);

  const salariesByRole = roleRows.reduce((groups, row) => {
    const salary = Number(state.details[row.posting_id]?.salary_min);
    if (salary > 0) { const key = row.title || "Finance role"; (groups[key] ||= []).push(salary); }
    return groups;
  }, {});
  const salaryRoles = Object.keys(salariesByRole).sort((a, b) => salariesByRole[b].length - salariesByRole[a].length || a.localeCompare(b)).slice(0, 8);
  drawGroupedBars(document.getElementById("salary-benchmark-chart"), salaryRoles.length ? salaryRoles : ["No salary data"], [{ name: "Median $000s", values: salaryRoles.length ? salaryRoles.map((role) => Math.round((median(salariesByRole[role]) || 0) / 1000)) : [0], color: "#b7791f" }]);
  setText("salary-benchmark-paragraph", salaryRoles.length ? `${salaryRoles.length} role titles have published salary ranges. Values use the median minimum salary and are shown in thousands.` : "Salary ranges are not available from the current feeds yet.");
}

async function boot() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register(`./service-worker.js?v=${APP_VERSION}`).catch(() => {});
  try {
    await loadData();
    const page = document.body.dataset.page;
    if (page === "today") renderToday();
    if (page === "browse") renderBrowse();
    if (page === "market") renderMarket();
  } catch (error) { showError(error); }
}

document.addEventListener("DOMContentLoaded", boot);
