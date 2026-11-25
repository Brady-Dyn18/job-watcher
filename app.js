/* Shared browser-side data loading, filtering, charts, and page rendering. */

const state = { status: null, rows: [] };
const ROLE_SHORTLIST_KEY = "finance-job-watcher-shortlist-v1";
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
  let status, csv;
  try {
    const [statusResponse, csvResponse] = await Promise.all([fetch("./data/status.json", { cache: "no-store" }), fetch("./data/history.csv", { cache: "no-store" })]);
    if (!statusResponse.ok || !csvResponse.ok) throw new Error("The data files could not be loaded.");
    status = await statusResponse.json();
    csv = await csvResponse.text();
    localStorage.setItem("finance-job-watcher-status", JSON.stringify(status));
    localStorage.setItem("finance-job-watcher-history", csv);
  } catch (error) {
    const savedStatus = localStorage.getItem("finance-job-watcher-status");
    const savedCsv = localStorage.getItem("finance-job-watcher-history");
    if (!savedStatus || savedCsv === null) throw error;
    status = JSON.parse(savedStatus);
    csv = savedCsv;
  }
  state.status = status;
  state.rows = parseCsv(csv);
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
  document.getElementById("source-table").innerHTML = (state.status.sources || []).map((source) => `<tr><td>${escapeHtml(source.name)}</td><td><span class="status ${source.ok ? "" : "bad"}">${source.ok ? "OK" : "Failed"}</span></td><td>${source.ok ? source.count : "-"}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">No source run recorded yet.</td></tr>`;
}

function getShortlist() { try { return new Set(JSON.parse(localStorage.getItem(ROLE_SHORTLIST_KEY) || "[]")); } catch { return new Set(); } }
function saveShortlist(set) { localStorage.setItem(ROLE_SHORTLIST_KEY, JSON.stringify([...set])); }

function renderBrowse() {
  setText("last-run", dataThrough());
  document.getElementById("focus-employers").innerHTML = FOCUS_EMPLOYERS.map((company) => `<a class="focus-card" href="${escapeHtml(company.url)}" target="_blank" rel="noopener noreferrer"><div><strong>${escapeHtml(company.name)}</strong><small>${escapeHtml(company.group)}</small><div class="role-chips">${company.roles.map((role) => `<span class="role-chip">${escapeHtml(role)}</span>`).join("")}</div></div><span class="external-arrow">↗</span></a>`).join("");
  const employerFilter = document.getElementById("employer-filter");
  const locationFilter = document.getElementById("location-filter");
  const matchingEmployerCounts = state.rows.filter((row) => row.status === "open" && isTrue(row.in_role) && isUnitedStatesLocation(row.location)).reduce((counts, row) => { counts[row.employer] = (counts[row.employer] || 0) + 1; return counts; }, {});
  const focusNames = new Set(FOCUS_EMPLOYERS.map((company) => company.name));
  const additionalEmployers = Object.keys(matchingEmployerCounts).filter((name) => !focusNames.has(name)).sort();
  const focusOptions = FOCUS_EMPLOYERS.map((company) => {
    const count = matchingEmployerCounts[company.name];
    const suffix = count ? ` (${count} available)` : " (official board)";
    return `<option value="${escapeHtml(company.name)}">${escapeHtml(company.name + suffix)}</option>`;
  }).join("");
  const additionalOptions = additionalEmployers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(`${name} (${matchingEmployerCounts[name]} available)`)}</option>`).join("");
  employerFilter.innerHTML = `<option value="">All finance employers</option><optgroup label="Focus employers">${focusOptions}</optgroup>${additionalOptions ? `<optgroup label="Other employers with matching roles">${additionalOptions}</optgroup>` : ""}`;
  locationFilter.innerHTML = `<option value="__US__">United States</option>${US_STATES.map(([name]) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  const update = () => {
    const onlyRole = document.getElementById("role-toggle").checked;
    const employer = document.getElementById("employer-filter").value;
    const location = document.getElementById("location-filter").value;
    const maxDays = document.getElementById("days-open-filter").value;
    const search = document.getElementById("title-search").value.trim().toLowerCase();
    const sort = document.getElementById("sort-order").value;
    const last = dataThrough();
    const filtered = state.rows.filter((row) => {
      if (row.status !== "open") return false;
      if (!matchesMarketLocation(row.location, location)) return false;
      if (onlyRole && !isTrue(row.in_role)) return false;
      if (employer && row.employer !== employer) return false;
      if (search && !row.title.toLowerCase().includes(search)) return false;
      if (maxDays !== "" && (dateDiff(row.first_seen, last) ?? 0) > Number(maxDays)) return false;
      return true;
    }).sort((a, b) => sort === "oldest" ? a.first_seen.localeCompare(b.first_seen) : b.first_seen.localeCompare(a.first_seen));
    const shortlist = getShortlist();
    setText("browse-count", filtered.length);
    setText("shortlist-count", shortlist.size);
    const list = document.getElementById("browse-list");
    list.innerHTML = filtered.length ? filtered.map((row) => `<article class="job-card"><button class="star ${shortlist.has(row.posting_id) ? "saved" : ""}" data-star="${escapeHtml(row.posting_id)}" aria-label="${shortlist.has(row.posting_id) ? "Remove from" : "Add to"} shortlist">${shortlist.has(row.posting_id) ? "★" : "☆"}</button><h3>${rowLink(row)}</h3><p>${escapeHtml(row.employer)} · ${escapeHtml(row.location || "Location not listed")}</p><div class="tags"><span class="tag ${isTrue(row.in_role) ? "role" : ""}">${isTrue(row.in_role) ? "In my role" : "Other posting"}</span><span class="tag">${escapeHtml(row.department || "Department not listed")}</span><span class="tag">First seen ${escapeHtml(displayDate(row.first_seen))}</span></div><div class="job-card-footer"><small>${escapeHtml(String(dateDiff(row.first_seen, last) ?? 0))} days open in watch</small><a class="apply-link" href="${escapeHtml(row.url || "#")}" target="_blank" rel="noopener noreferrer">Apply ↗</a></div></article>`).join("") : emptyMessage("No open postings match these filters.");
  };
  ["role-toggle", "employer-filter", "location-filter", "days-open-filter", "title-search", "sort-order"].forEach((id) => document.getElementById(id).addEventListener("input", update));
  document.getElementById("browse-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-star]");
    if (!button) return;
    const shortlist = getShortlist();
    if (shortlist.has(button.dataset.star)) shortlist.delete(button.dataset.star); else shortlist.add(button.dataset.star);
    saveShortlist(shortlist);
    update();
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

function renderMarket() {
  setText("last-run", dataThrough());
  document.getElementById("market-sections").innerHTML = [
    marketSection("new-per-day", "New postings arrive in waves", "First-run postings are left out because their true start date is unknown."),
    marketSection("removed-per-day", "Removals show when opportunity windows close", "Every posting removed on a source snapshot contributes to the day it disappeared."),
    marketSection("open-employer", "A small group of employers carries the largest open inventory", "Open postings are counted by employer as of the latest run."),
    marketSection("days-open", "Most observed roles stay open for a measurable window", "Days open is the median from first seen to removed, excluding first-run postings."),
    marketSection("within-seven", "Early removals reveal how quickly roles can disappear", "The share uses postings observed at least seven days before the latest run and counts removal within seven days."),
    marketSection("top-locations", "Open roles cluster in a few hiring markets", "Locations are counted among open postings, with missing locations grouped as Unlisted.", "wide"),
  ].join("");
  const roleRows = state.rows.filter((row) => isTrue(row.in_role));
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
  const median = daysOpen.length ? (daysOpen.length % 2 ? daysOpen[(daysOpen.length - 1) / 2] : (daysOpen[daysOpen.length / 2 - 1] + daysOpen[daysOpen.length / 2]) / 2) : 0;
  drawGroupedBars(document.getElementById("days-open-chart"), ["Median days"], [{ name: "Days", values: [median], color: "#b7791f" }]);
  setText("days-open-paragraph", daysOpen.length ? `The median observed open window is ${median} day${median === 1 ? "" : "s"}, based on ${daysOpen.length} removed non-first-run postings.` : "There are not enough removed non-first-run postings to calculate this median yet.");

  const last = dataThrough();
  const eligible = state.rows.filter((row) => !isTrue(row.first_run) && dateDiff(row.first_seen, last) >= 7);
  const fastRemoved = eligible.filter((row) => row.removed_date && dateDiff(row.first_seen, row.removed_date) <= 7).length;
  const slowerOrOpen = eligible.length - fastRemoved;
  drawGroupedBars(document.getElementById("within-seven-chart"), ["Eligible postings"], [{ name: "Within 7 days", values: [fastRemoved], color: "#d66a50" }, { name: "Other/open", values: [slowerOrOpen], color: "#dfe5ee" }]);
  setText("within-seven-paragraph", eligible.length ? `${fastRemoved} of ${eligible.length} eligible postings (${Math.round(100 * fastRemoved / eligible.length)}%) were removed within seven days of first seen.` : "No posting has been observable for at least seven days yet.");

  const locationCounts = countsBy(openRows, "location"), locations = sortedKeys(locationCounts).slice(0, 15);
  drawGroupedBars(document.getElementById("top-locations-chart"), locations.length ? locations : ["None"], [{ name: "Open", values: locations.length ? locations.map((location) => locationCounts[location]) : [0], color: "#0e8c82" }]);
  setText("top-locations-paragraph", `${openRows.length} open postings are spread across ${locations.length} locations in the top-location view.`);
}

async function boot() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  try {
    await loadData();
    const page = document.body.dataset.page;
    if (page === "today") renderToday();
    if (page === "browse") renderBrowse();
    if (page === "market") renderMarket();
  } catch (error) { showError(error); }
}

document.addEventListener("DOMContentLoaded", boot);
