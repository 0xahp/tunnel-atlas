/* Tunnel Atlas sources page: the content is in the HTML (make-static.py); this adds the claim and reference filters. */
const params = new URLSearchParams(location.search);
const setParam = (k, v) => { const u = new URL(location); if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); history.replaceState(null, "", u); };

/* claims: one verdict at a time */
const verdicts = document.getElementById("claim-filter");
const showVerdict = (v) => {
  verdicts.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v));
  document.querySelectorAll(".claim").forEach((c) => { c.hidden = v !== "all" && c.dataset.v !== v; });
  document.querySelectorAll(".claim-topic").forEach((t) => { t.hidden = !t.querySelector(".claim:not([hidden])"); });
};
verdicts.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  setParam("verdict", b.dataset.v === "all" ? "" : b.dataset.v);
  showVerdict(b.dataset.v);
});
showVerdict(verdicts.querySelector(`[data-v="${params.get("verdict")}"]`) ? params.get("verdict") : "all");

/* references: search opens the groups that match */
const refQ = document.getElementById("ref-q"), refCount = document.getElementById("ref-count");
const refs = [...document.querySelectorAll(".ref")];
const findRefs = () => {
  const q = refQ.value.trim().toLowerCase();
  let shown = 0;
  refs.forEach((li) => { const on = !q || li.textContent.toLowerCase().includes(q); li.hidden = !on; shown += on; });
  document.querySelectorAll(".ref-group").forEach((g) => { const any = g.querySelector(".ref:not([hidden])"); g.hidden = !any; if (q) g.open = !!any; else g.open = false; });
  refCount.textContent = q ? (shown ? `${shown} of ${refs.length} references` : "No reference matches that search.") : `${refs.length} references`;
};
refQ.value = params.get("q") || "";
refQ.addEventListener("input", () => { setParam("q", refQ.value.trim()); findRefs(); });
findRefs();
