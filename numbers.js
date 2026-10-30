/* Tunnel Atlas numbers page. Every table is in the HTML (make-static.py); this shows one at a time and adds sorting and search.
   All state lives in the URL: ?view=&lab=&route=&country=, and for the open table ?q=&sort=&all=1. */
const params = new URLSearchParams(location.search);
const setParam = (k, v) => { const u = new URL(location); if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); history.replaceState(null, "", u); };
const groups = [...document.querySelectorAll("[data-panels]")];
const panelsOf = (g) => [...g.children].filter((c) => c.dataset.panel);

/* ---------- panels: one pill row per group ---------- */
function show(g, id) {
  panelsOf(g).forEach((p) => { p.hidden = p.dataset.panel !== id; });
  g.querySelectorAll(":scope > .seg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === id));
}
groups.forEach((g) => {
  const ps = panelsOf(g), seg = document.createElement("div");
  seg.className = "seg";
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", g.dataset.label);
  ps.forEach((p) => { const b = document.createElement("button"); b.type = "button"; b.dataset.v = p.dataset.panel; b.textContent = p.dataset.label; seg.append(b); });
  g.prepend(seg);
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    show(g, b.dataset.v);
    setParam(g.dataset.panels, b.dataset.v === ps[0].dataset.panel ? "" : b.dataset.v);
    ["q", "sort", "all"].forEach((k) => setParam(k, ""));
    document.querySelectorAll("[data-sortable]").forEach(reset);
  });
  const want = params.get(g.dataset.panels);
  show(g, ps.some((p) => p.dataset.panel === want) ? want : ps[0].dataset.panel);
});
/* a link to any table or heading opens the panels around it */
function openHash() {
  const t = location.hash && document.getElementById(location.hash.slice(1));
  if (!t) return;
  for (let p = t.closest("[data-panel]"); p; p = p.parentElement.closest("[data-panel]")) show(p.parentElement, p.dataset.panel);
  t.scrollIntoView();
}
addEventListener("hashchange", openHash);

/* ---------- tables: sort, search, all columns ---------- */
const cellValue = (row, i) => { const c = row.cells[i], v = c.dataset.v; return v === undefined ? c.textContent.trim().toLowerCase() : +v; };
function sortBy(t, i, dir) {
  const body = t.tBodies[0], sign = dir === "ascending" ? 1 : -1;
  [...body.rows].sort((a, b) => {
    const x = cellValue(a, i), y = cellValue(b, i);
    if (x === "–") return 1;
    if (y === "–") return -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sign;
  }).forEach((r) => body.append(r));
  t.querySelectorAll("thead th").forEach((th, k) => { if (k === i) th.setAttribute("aria-sort", dir); else th.removeAttribute("aria-sort"); });
}
function search(t) {
  const box = t.closest(".panel-table"), q = $find(box).value.trim().toLowerCase(), rows = [...t.tBodies[0].rows];
  let shown = 0;
  rows.forEach((r) => { const on = !q || r.cells[0].textContent.toLowerCase().includes(q); r.hidden = !on; shown += on; });
  box.querySelector(".count").textContent = shown ? `${shown} of ${rows.length} ${t.dataset.noun}` : `No ${t.dataset.noun} match that search.`;
}
const $find = (box) => box.querySelector("input[type=search]");
function reset(t) {
  const box = t.closest(".panel-table"), first = t.dataset.sort.split(":");
  $find(box).value = "";
  t.classList.remove("all");
  const more = box.querySelector("[data-more]");
  if (more) more.setAttribute("aria-pressed", "false");
  sortBy(t, +first[0], first[1]);
  search(t);
}
document.querySelectorAll("[data-sortable]").forEach((t) => {
  const box = t.closest(".panel-table"), more = box.querySelector("[data-more]");
  t.querySelectorAll("thead th").forEach((th, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.append(...th.childNodes);
    th.append(b);
    b.addEventListener("click", () => {
      const dir = th.getAttribute("aria-sort") === th.dataset.first ? (th.dataset.first === "ascending" ? "descending" : "ascending") : th.dataset.first;
      sortBy(t, i, dir);
      setParam("sort", `${i}:${dir}`);
    });
  });
  $find(box).addEventListener("input", () => { search(t); setParam("q", $find(box).value.trim()); });
  if (more) more.addEventListener("click", () => {
    const on = t.classList.toggle("all");
    more.setAttribute("aria-pressed", on);
    setParam("all", on ? "1" : "");
  });
  reset(t);
  if (box.closest("[data-panel]").checkVisibility && !box.closest("[hidden]")) {
    if (params.get("q")) $find(box).value = params.get("q");
    if (params.get("sort")) { const [i, dir] = params.get("sort").split(":"); if (t.tHead.rows[0].cells[+i]) sortBy(t, +i, dir); }
    if (params.get("all") && more) more.click();
    search(t);
  }
});
openHash();
