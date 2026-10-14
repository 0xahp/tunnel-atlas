/* Tunnel Atlas sources page: references and supporting facts, rendered from data.js. */

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

const themeBtn = $("#theme-btn");
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  return t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
/* the button names the theme it switches to */
const labelTheme = () => { themeBtn.textContent = effectiveTheme() === "dark" ? "Light" : "Dark"; };
labelTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", labelTheme);
themeBtn.addEventListener("click", () => {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
  labelTheme();
});

const link = (k) => {
  const [label, url] = SRC[k];
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : `<span>${esc(label)}</span>`;
};
const srcLinks = (keys) => `<div class="src-list">${[...new Set(keys || [])].filter((k) => SRC[k]).map(link).join("")}</div>`;
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;

/* ---------- References, grouped by type and numbered ---------- */
const GROUPS = [
  ["Research papers and measurements", ["paper", "data"]],
  ["Field reports and news", ["forum", "news"]],
  ["Specifications and documentation", ["docs"]],
  ["Apps and source code", ["app", "code"]],
  ["Vendor material", ["vendor"]],
  ["Unpublished notes", ["local"]]
];
let n = 0;
$("#ref-groups").innerHTML = GROUPS.map(([title, kinds]) => {
  const keys = Object.keys(SRC).filter((k) => kinds.includes(SRC[k][2])).sort((a, b) => SRC[a][0].localeCompare(SRC[b][0]));
  if (!keys.length) return "";
  const items = keys.map((k) => `<li class="ref" data-q="${esc((SRC[k][0] + " " + (SRC[k][1] || "")).toLowerCase())}">
    <span class="ref-n">${++n}</span>${link(k)}<span class="ref-host">${esc(SRC[k][1] ? host(SRC[k][1]) : "kept private")}</span></li>`).join("");
  return `<div class="ref-group"><h3>${esc(title)}</h3><ol class="ref-list">${items}</ol></div>`;
}).join("");
$("#ref-q").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll(".ref").forEach((li) => { const on = !q || li.dataset.q.includes(q); li.hidden = !on; shown += on; });
  document.querySelectorAll(".ref-group").forEach((g) => { g.hidden = !g.querySelector(".ref:not([hidden])"); });
  $("#ref-empty").hidden = shown > 0;
});

/* ---------- Key figures ---------- */
$("#fig-table").innerHTML = table(["Figure", "What it measures", "Source"], [
  ...PERF_FACTS.map(([v, what, k]) => `<tr><td class="fig">${esc(v)}</td><td class="what">${esc(what)}</td><td>${srcLinks([k])}</td></tr>`),
  ...NUMBERS.map(([what, v, ctx, yr, k]) => `<tr><td class="fig">${esc(v)}</td><td class="what">${esc(what)}<br><span class="note">${esc(ctx)}${yr && yr !== "–" ? ", " + esc(yr) : ""}</span></td><td>${srcLinks([k])}</td></tr>`)
]);

/* ---------- Censorship matrix ---------- */
$("#mx-table").innerHTML = `<table class="mx"><thead><tr><th>Technique</th>${MATRIX.countries.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${
  MATRIX.rows.map(([name, cells]) => `<tr><td class="what">${esc(name)}</td>${cells.map(([s, note]) => {
    const inf = /unconfirmed|no 2026/i.test(note);
    return `<td><div class="mx-cell"><span class="st ${s}${inf ? " inf" : ""}" title="${esc(MATRIX.labels[s])}">${esc(MATRIX.labels[s][0])}</span><span>${esc(note || MATRIX.labels[s])}</span></div></td>`;
  }).join("")}</tr>`).join("")}</tbody></table>`;

/* ---------- Claims ---------- */
$("#claim-table").innerHTML = table(["Claim", "Verdict", "Finding"], CLAIMS.map((c) =>
  `<tr><td class="what">${esc(c.claim)}<br><span class="note">${esc(c.topic)}</span></td><td><span class="verdict ${c.v}">${esc(VERDICTS[c.v].label)}</span></td><td>${esc(c.finding)}${srcLinks(c.src)}</td></tr>`));

/* ---------- Notes ---------- */
$("#notes-list").innerHTML = CAVEATS.map((c) => `<li>${esc(c)}</li>`).join("");
