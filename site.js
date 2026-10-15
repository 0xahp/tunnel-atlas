/* Tunnel Atlas: renders index.html from data.js. Two tabs: timeline; setup (picks, their flow, and the client-app benchmark). */

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const srcLinks = (keys) => `<div class="src-list">${[...new Set(keys || [])].filter((k) => SRC[k])
  .map((k) => `<a href="${esc(SRC[k][1])}"${/^https?:/.test(SRC[k][1]) ? ' target="_blank" rel="noopener"' : ""}>${esc(SRC[k][0])}</a>`).join("")}</div>`;

/* ---------- Theme ---------- */
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

/* ---------- Tabs ---------- */
const TABS = ["setup", "timeline"];
const rendered = {};
function showTab(id, focus) {
  const toBench = id === "bench";
  if (id === "picks" || toBench) id = "setup"; // old links
  if (!TABS.includes(id)) id = "setup";
  for (const t of TABS) {
    const on = t === id, btn = $("#tab-" + t);
    btn.setAttribute("aria-selected", on);
    btn.tabIndex = on ? 0 : -1;
    $("#" + t).hidden = !on;
  }
  if (focus) $("#tab-" + id).focus();
  if (!rendered[id]) { rendered[id] = true; ({ timeline: Timeline, setup: Picks })[id].init(); }
  if (id === "timeline") Timeline.layout();
  if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
  if (toBench && $("#bench")) { Bench.jump = true; $("#bench").scrollIntoView(); }
}
for (const t of TABS) $("#tab-" + t).addEventListener("click", () => { showTab(t); window.scrollTo(0, 0); });
$(".rail-tabs").addEventListener("keydown", (e) => {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const cur = TABS.findIndex((t) => $("#tab-" + t).getAttribute("aria-selected") === "true");
  showTab(TABS[(cur + step + TABS.length) % TABS.length], true);
  window.scrollTo(0, 0);
});
addEventListener("hashchange", () => showTab(location.hash.slice(1)));

/* ---------- Shared bits ---------- */
const CLS_ORDER = { edge: 0, popular: 1, legacy: 2 };
const WAVES = { // tiny line glyphs for the connection type
  tcp: "M0 9h5V3h7v6h5V3h7v6h10", udp: "M0 9h34M4 9V3M12 9V3M22 9V3M30 9V3", quic: "M0 9h34M4 9V3M10 9V3M16 9V3M22 9V3M28 9V3",
  both: "M0 9h4V3h6v6h3M17 9h17M20 9V3M27 9V3", dns: "M0 9h6l3-6 3 6h4l3-6 3 6h12", raw: "M0 9h8V2h1v7h8V2h1v7h16", any: "M0 6h34"
};
const wave = (c) => `<svg class="wave" viewBox="0 0 34 12" aria-hidden="true"><path d="${WAVES[c]}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
const meter = (p) => `<span class="meter" data-p="${p}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
const ST_LABEL = { ok: "Works", deg: "Degraded", blk: "Blocked", unk: "No data" };

/* status for the four countries: [{s, inf, note}] */
function dpiOf(id) {
  const d = TL[id].d;
  if (typeof d === "string") {
    const row = MATRIX.rows.find((r) => r[0] === d);
    return row[1].map(([s, note]) => ({ s, inf: /unconfirmed|no 2026/i.test(note), note }));
  }
  return d.map((x) => ({ s: x.replace("~", ""), inf: x.endsWith("~"), note: "" }));
}
const stCell = (c, code) => `<span class="st ${c.s}${c.inf ? " inf" : ""}" title="${esc(COUNTRIES.find((k) => k[0] === code)[1])}: ${esc(ST_LABEL[c.s])}${c.inf ? " (inferred)" : ""}${c.note ? " · " + esc(c.note) : ""}">${code}</span>`;

/* ==================== Timeline ==================== */
const Timeline = {
  items: [], slot: 224, cursor: 300, active: -1, laneH: 13,
  init() {
    this.items = TECHS.slice().sort((a, b) => b.y - a.y || CLS_ORDER[a.cls] - CLS_ORDER[b.cls] || a.name.localeCompare(b.name));
    $("#tl-legend").innerHTML = `
      <div><b>Link</b>${wave("tcp")}TCP ${wave("quic")}QUIC ${wave("udp")}UDP</div>
      <div><b>Power</b>${meter(1)} low … ${meter(4)} highest (estimate)</div>`;
    const track = $("#tl-track");
    track.addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) this.goTo(+c.dataset.i); });
    track.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      this.goTo(Math.max(0, Math.min(this.items.length - 1, this.active + step)), true);
    });
    track.addEventListener("focusin", (e) => {
      $("#tl-window").scrollLeft = 0; // keep focus from scrolling the clipped window sideways
      const c = e.target.closest(".card");
      if (c && +c.dataset.i !== this.active) this.goTo(+c.dataset.i);
    });
    addEventListener("scroll", () => this.queue(), { passive: true });
    addEventListener("resize", () => { if ($("#timeline").hidden) return; const keep = this.active; this.layout(); if (keep > 0) this.goTo(keep, false, true); });
  },
  layout() {
    const win = $("#tl-window"), W = win.clientWidth, narrow = W < 640;
    if (!W) return;
    this.slot = narrow ? 188 : 224;
    $("#tl-lane-labels").innerHTML = FAMILIES.map((f) => `<span>${esc(f.label)}</span>`).join("");
    const labelsW = $("#tl-lane-labels").offsetWidth;
    this.cursor = Math.round(Math.max(labelsW + this.slot / 2 + 12, W * 0.3));
    win.style.setProperty("--cursor-x", this.cursor + "px");
    win.style.setProperty("--slot", this.slot + "px");
    const n = this.items.length, padL = this.cursor - this.slot / 2, trackW = padL + n * this.slot + (W - this.cursor);
    this.padL = padL;
    const fams = FAMILIES.map((f) => f.id), lh = this.laneH, laneTop = 4;
    const x0 = (i) => padL + i * this.slot;
    // ruler: a year mark where each new year starts
    let ruler = "", prev = null;
    this.items.forEach((t, i) => { if (t.y !== prev) { ruler += `<span class="yr" data-y="${t.y}" style="left:${x0(i)}px">${t.y}</span>`; prev = t.y; } });
    // lanes: one square-wave trace per family; a pulse where that family has a technique
    let lanes = "";
    fams.forEach((f, li) => {
      const yLow = laneTop + li * lh + lh - 3, yHigh = laneTop + li * lh + 3;
      let d = `M0 ${yLow}`;
      this.items.forEach((t, i) => {
        if (t.fam !== f) return;
        const a = x0(i) + this.slot * 0.2, b = x0(i) + this.slot * 0.8;
        d += `H${a}V${yHigh}H${b}V${yLow}`;
      });
      lanes += `<path class="lane-trace" d="${d}H${trackW}"/>`;
    });
    lanes += `<rect class="lane-hit" id="tl-hit" x="0" y="0" width="${this.slot * 0.6}" height="${lh - 6}" rx="1"/>`;
    const lanesH = laneTop + fams.length * lh + 4;
    const cards = this.items.map((t, i) => {
      const tl = TL[t.id], dpi = dpiOf(t.id);
      return `<button class="card" type="button" data-i="${i}" style="left:${x0(i) + 7}px" aria-label="${esc(t.name)}, ${esc(t.year)}">
        <span class="card-top"><span>${esc(t.year)}</span><span class="chip c-${t.cls}">${esc(CLASSES[t.cls].label)}</span></span>
        <span class="card-name">${esc(t.name)}</span>
        <span class="card-dpi">${dpi.map((c, k) => stCell(c, COUNTRIES[k][0])).join("")}</span>
        <span class="card-foot"><span class="conn">${wave(tl.c)}${esc(CONN[tl.c].label)}</span>${meter(tl.p)}</span>
      </button>`;
    }).join("");
    $("#tl-track").style.width = trackW + "px";
    $("#tl-track").innerHTML = `<div class="tl-ruler">${ruler}</div>
      <svg class="tl-lanes" width="${trackW}" height="${lanesH}" aria-hidden="true">${lanes}</svg>
      <div class="tl-cards">${cards}</div>`;
    $("#tl-lane-labels").style.gridTemplateRows = `repeat(${fams.length}, ${lh}px)`;
    $("#tl-lane-labels").style.paddingTop = laneTop + "px";
    // vertical scroll distance = horizontal travel, so each slot takes one slot-width of scrolling
    const frameH = $("#tl-frame").offsetHeight;
    $("#tl-scroll").style.height = frameH + (n - 1) * this.slot + "px";
    this.active = -1;
    this.update();
  },
  queue() {
    if (this.raf || $("#timeline").hidden) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
  },
  update() {
    const sc = $("#tl-scroll"), frame = $("#tl-frame");
    const stickyTop = parseFloat(getComputedStyle(frame).top) || 0;
    const max = (this.items.length - 1) * this.slot;
    const off = Math.max(0, Math.min(max, stickyTop - sc.getBoundingClientRect().top));
    $("#tl-track").style.transform = `translateX(${-off}px)`;
    const nowW = $("#tl-now").offsetWidth;
    document.querySelectorAll(".yr").forEach((y) => { y.style.visibility = y.offsetLeft - off < nowW ? "hidden" : ""; });
    const i = Math.round(off / this.slot);
    if (i !== this.active) this.select(i);
  },
  select(i) {
    const prev = $(".card.on");
    if (prev) prev.classList.remove("on");
    this.active = i;
    const t = this.items[i], card = $(`.card[data-i="${i}"]`);
    card.classList.add("on");
    const famIdx = FAMILIES.findIndex((f) => f.id === t.fam);
    const hit = $("#tl-hit");
    hit.setAttribute("x", this.padL + i * this.slot + this.slot * 0.2);
    hit.setAttribute("y", 4 + famIdx * this.laneH + 3);
    document.querySelectorAll(".yr").forEach((y) => y.classList.toggle("on", +y.dataset.y === t.y));
    $("#tl-now").textContent = t.y;
    $("#tl-cursor-year").textContent = `${t.y} · ${i + 1} of ${this.items.length}`;
    this.readout(t);
  },
  goTo(i, focus, instant) {
    const sc = $("#tl-scroll"), stickyTop = parseFloat(getComputedStyle($("#tl-frame")).top) || 0;
    const top = sc.getBoundingClientRect().top + window.scrollY - stickyTop + i * this.slot;
    window.scrollTo({ top, behavior: reduced || focus || instant ? "auto" : "smooth" });
    if (focus) $(`.card[data-i="${i}"]`).focus({ preventScroll: true });
  },
  readout(t) {
    const tl = TL[t.id], dpi = dpiOf(t.id), pt = POWER_TIERS[tl.p];
    const notes = typeof tl.d === "string";
    const rows = dpi.map((c, k) => `<li>${stCell(c, COUNTRIES[k][0])}<span>${esc(ST_LABEL[c.s])}${c.inf ? ", inferred" : ""}</span><span>${esc(notes ? c.note : "")}</span></li>`).join("");
    const measured = tl.m ? `Measured: <b>+${tl.m}%</b> battery current over no VPN on a 5G Android phone (2022, the only independent phone test).` : "No phone measurement exists for this technique.";
    $("#tl-readout").innerHTML = `
      <div class="ro-title"><h2>${esc(t.name)}</h2><span class="ro-year">${esc(t.year)} · ${esc(FAMILIES.find((f) => f.id === t.fam).label)}</span><span class="chip c-${t.cls}">${esc(CLASSES[t.cls].label)}</span></div>
      <p class="ro-one">${esc(t.one)}</p>
      <div class="ro-col">
        <dl class="kv">
          <dt>How</dt><dd>${esc(t.how)}</dd>
          <dt>Hides</dt><dd>${esc(t.hides)}</dd>
          <dt>Runs over</dt><dd>${esc(t.over)}</dd>
          <dt>Found in</dt><dd>${esc(t.cores)}</dd>
          <dt>Status</dt><dd>${esc(t.status)}</dd>
        </dl>
        ${srcLinks(t.src)}
      </div>
      <div class="ro-col">
        <span class="ro-label">Censorship, 2026</span>
        <ul class="dpi-rows">${rows}</ul>
        ${tl.dn ? `<p class="note" style="margin:0">${esc(tl.dn)}</p>` : ""}
        <span class="ro-label">Connection</span>
        <div class="pw-row">${wave(tl.c)}<span><b>${esc(CONN[tl.c].label)}</b>: ${esc(CONN[tl.c].desc)}</span></div>
        <span class="ro-label">Power on a phone (estimate)</span>
        <div class="pw-row">${meter(tl.p)}<span><b>${pt.label}.</b> ${esc(pt.desc)} ${measured}</span></div>
      </div>`;
  }
};

/* ==================== Picks + flow ==================== */
const PICK_ROUTES = { efficient: ["vpn", "vpn", "selfsteal"], censor: ["selfsteal", "quic", "cdn"], blackout: ["relay", "cdn", "dns"] };
const SEEN_MARK = { y: "sees it", n: "can't see it", p: "partly" };
const Picks = {
  goal: "censor", idx: 0,
  init() {
    const seg = (el, opts, key) => {
      el.innerHTML = opts.map((o) => `<button type="button" role="radio" data-v="${o.id}">${esc(o.label)}</button>`).join("");
      el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { this[key] = b.dataset.v; this.idx = 0; this.render(); } });
    };
    seg($("#pk-goal"), GOALS, "goal");
    $("#pk-list").addEventListener("click", (e) => { const b = e.target.closest(".pick"); if (b) { this.idx = +b.dataset.i; this.render(); } });
    this.render();
    if ($("#bench")) Bench.init();
  },
  render() {
    $("#pk-goal").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.v === this.goal));
    const set = PICKS[this.goal];
    $("#pk-list").innerHTML = set.items.map((p, i) => `<li><button class="pick" type="button" data-i="${i}" aria-pressed="${i === this.idx}">
      <span class="pick-rank">${esc(p.rank)}</span><span class="pick-proto">${esc(p.proto)}</span>
      <span class="pick-why">${esc(p.why)}</span>
      ${p.server ? `<span class="pick-app"><b>Server:</b> ${esc(p.server)}</span>` : ""}</button>
      ${srcLinks(p.src)}</li>`).join("");
    $("#pk-note").textContent = set.note;
    this.flow(ROUTES[PICK_ROUTES[this.goal][this.idx]]);
  },
  flow(r) {
    const n = r.hops.length, U = 160, W = n * U, cx = (i) => i * U + U / 2, y = 52;
    // zone bands, merged where neighbours share a zone
    const ZN = { home: "Inside the country", border: "Border filter", abroad: "Abroad" };
    let bands = "", i = 0;
    while (i < n) {
      let j = i; while (j + 1 < n && r.hops[j + 1].zone === r.hops[i].zone) j++;
      bands += `<div class="zone-band ${r.hops[i].zone}" style="grid-column:${i + 2} / ${j + 3}">${ZN[r.hops[i].zone]}</div>`;
      i = j + 1;
    }
    let svg = `<line class="wire" x1="${cx(0)}" y1="${y}" x2="${cx(n - 1)}" y2="${y}"/>`;
    r.enc.forEach(([a, b, lbl], k) => {
      const ty = 18; // tunnels drawn side by side on one row
      svg += `<line class="tun" x1="${cx(a) + 12}" y1="${ty + 10}" x2="${cx(b) - 12}" y2="${ty + 10}"/><text class="tun-lbl" x="${(cx(a) + cx(b)) / 2}" y="${ty + 2}" text-anchor="middle">${esc(lbl)}</text>`;
    });
    (r.legs || []).forEach((lbl, k) => { if (lbl && k < n - 1) svg += `<text class="leg-lbl" x="${(cx(k) + cx(k + 1)) / 2}" y="${y + 26}" text-anchor="middle">${esc(lbl)}</text>`; });
    r.hops.forEach((h, k) => { svg += `<circle class="node ${h.zone}" cx="${cx(k)}" cy="${y}" r="9"/>`; });
    if (!reduced) {
      const dur = (n * 0.9).toFixed(1);
      svg += `<circle class="pkt" r="4"><animateMotion dur="${dur}s" repeatCount="indefinite" path="M${cx(0)} ${y}H${cx(n - 1)}"/></circle>`;
    }
    const cell = (v) => {
      const [s, note] = Array.isArray(v) ? v : [v, ""];
      return `<div class="seen"><span class="dot ${s}" title="${SEEN_MARK[s]}"></span>${note ? `<span>${esc(note)}</span>` : ""}</div>`;
    };
    let grid = `<div style="grid-row:1"></div>${bands}<div style="grid-row:2"></div>
      <svg class="flow-svg" viewBox="0 0 ${W} 92" role="img" aria-label="Path: ${esc(r.hops.map((h) => h.title).join(" → "))}">${svg}</svg>
      <div style="grid-row:3"></div>${r.hops.map((h) => `<div class="hop"><span class="hop-title">${esc(h.title)}</span><span class="hop-sub">${esc(h.sub)}</span></div>`).join("")}`;
    for (const [key, lbl] of SEEN_KEYS) grid += `<div class="seen-lbl">${esc(lbl)}</div>${r.hops.map((h) => cell(h.seen[key])).join("")}`;
    grid += `<div class="seen-lbl">What happens</div>${r.hops.map((h) => `<div class="hop-desc">${esc(h.desc)}</div>`).join("")}`;
    $("#pk-flow").innerHTML = `
      <div class="flow-head"><h2>${esc(r.name)}</h2>
        <div class="flow-stats"><span>Censor sees <b>${esc(r.sees)}</b></span><span>Servers <b>${esc(r.extra)}</b></span><span>Delay <b>${esc(r.latency)}</b></span></div></div>
      <div class="flow-scroll"><div class="flow-grid" style="--hops:${n}">${grid}</div></div>
      <div class="flow-key"><span><i class="dot y"></i>sees it</span><span><i class="dot p"></i>partly</span><span><i class="dot n"></i>can't see it</span><span>Blue bar: encrypted span</span></div>
      <div class="flow-pc"><div><span class="ro-label">Good</span><ul>${r.pros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><span class="ro-label">Watch out</span><ul>${r.cons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><span class="ro-label">Used by</span><ul>${r.used.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      ${srcLinks(r.src.concat(r.hops.flatMap((h) => h.src || [])))}`;
  }
};

/* ==================== Client-app benchmark ====================
   Reads bench/experiments.json, copied from proxy-bench by sync-bench.sh. Three setups, never pooled. */
const BENCH_NAMES = { anywhere: "Anywhere", sfm: "SFM", happ: "Happ", v2box: "V2Box", shadowrocket: "Shadowrocket", egern: "Egern", karing: "Karing", rabbithole: "Rabbit Hole" };
const BENCH_APP_NOTES = { anywhere: "Anywhere", sfm: "sing-box for Apple", karing: "Karing", shadowrocket: "Shadowrocket", egern: "Egern" };
const BENCH_MACS = { "MacBookAir10,1": "MacBook Air M1" };
const BENCH_TABS = { A: "Daily setup: chain + rules", B: "Simple setup: one hop", C: "Lab: top speed" };
// [title, unit, case, metric, scale, higher is better]
const IDLE = (c) => ["Idle", [
  ["Idle wakeups", "times per second the app wakes the CPU", c, "tunnel_wakeups_per_s", 1],
  ["Idle power", "app only · µW", c, "tunnel_power_w", 1e6]]];
const AT100 = ["At 100 Mbit/s download", [
  ["Power at 100 Mbit/s", "app only · mW", "dl_100m", "tunnel_power_w", 1e3],
  ["Energy per GB at 100 Mbit/s", "app only · joules", "dl_100m", "tunnel_energy_per_gb", 1],
  ["CPU at 100 Mbit/s", "app only · % of one core", "dl_100m", "tunnel_cpu_pct", 1],
  ["Whole-Mac energy per GB", "battery sensor · joules", "dl_100m", "pstr_energy_per_gb", 1]]];
const BENCH_CARDS = {
  A: [IDLE("idle"), AT100,
    ["Full speed", [
      ["Top download speed", "Mbit/s · the path tops out near 182", "dl_max", "mbps", 1, true],
      ["Energy per GB at full speed", "app only · joules", "dl_max", "tunnel_energy_per_gb", 1]]],
    ["Web pages", [
      ["Foreign pages: first byte", "50 pages · ms", "req50", "first_byte_ms", 1],
      ["Local pages (direct): first byte", "20 pages · ms", "reqir", "first_byte_ms", 1]]]],
  B: [IDLE("idle"), AT100,
    ["Web pages", [["Foreign pages: first byte", "50 pages · ms", "req50", "first_byte_ms", 1]]]],
  C: [["Top speed", [["Top upload speed", "1 stream · Gbit/s", "tcp_up_1", "gbps", 1, true]]],
    ["At 500 Mbit/s upload", [
      ["Power at 500 Mbit/s", "app only · mW", "tcp_up_500m", "tunnel_power_w", 1e3],
      ["Energy per GB at 500 Mbit/s", "app only · joules", "tcp_up_500m", "tunnel_energy_per_gb", 1],
      ["CPU at 500 Mbit/s", "app only · % of one core", "tcp_up_500m", "tunnel_cpu_pct", 1]]],
    IDLE("idle30")]
};
const Bench = {
  exp: "A",
  async init() {
    try {
      const r = await fetch("bench/experiments.json", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      this.data = await r.json();
    } catch (e) {
      $("#bn-body").innerHTML = `<div class="empty"><h3>Benchmark results unavailable</h3>
        <p class="note" style="margin:0">The results load over HTTP; opened as a local file, the page can't read them.</p></div>`;
      return;
    }
    $("#bn-exp").innerHTML = Object.entries(BENCH_TABS).map(([id, t]) => `<button type="button" role="radio" data-v="${id}">${esc(t)}</button>`).join("");
    $("#bn-exp").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { this.exp = b.dataset.v; this.render(); } });
    this.render();
    if (this.jump) { this.jump = false; $("#bench").scrollIntoView(); }
  },
  render() {
    $("#bn-exp").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.v === this.exp));
    const x = this.data.experiments.find((e) => e.id === this.exp);
    const apps = Object.keys(x.versions);
    const name = (a) => BENCH_NAMES[a] || a;
    const ver = (a) => x.versions[a].replace(/\s*\(.*\)$/, "");
    const stats = (ca, me) => (x.metrics.find((m) => m.case === ca && m.metric === me) || {}).stats;
    const date = (s) => { const m = s.match(/^\d{4}(\d\d)(\d\d)/); return m ? `${+m[2]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m[1] - 1]}` : s; };

    // range plot: line = best to worst round, dot = median; green = shares first place
    const plot = ([title, unit, ca, me, sc, hi]) => {
      const s = stats(ca, me);
      if (!s) return "";
      const st = Object.entries(s).filter(([a]) => x.versions[a]).sort((p, q) => hi ? q[1].median - p[1].median : p[1].median - q[1].median);
      const beats = hi ? (d, c) => s[d].min > s[c].max : (d, c) => s[d].max < s[c].min;
      const first = (c) => !st.some(([d]) => d !== c && beats(d, c));
      const missing = apps.filter((a) => !s[a]).map(name);
      const lo = 0, top = 8, rowH = 22, L = 104, R = 396, H = top + st.length * rowH + 22;
      const hiV = Math.max(...st.map(([, v]) => v.max * sc)) * 1.06 || 1;
      const X = (v) => L + (v - lo) / (hiV - lo) * (R - L);
      const step = niceStep(hiV / 4);
      let ticks = "";
      for (let v = 0; v <= hiV; v += step)
        ticks += `<line class="ax" x1="${X(v)}" x2="${X(v)}" y1="${top - 4}" y2="${H - 18}"/><text class="tick" x="${X(v)}" y="${H - 5}" text-anchor="middle">${fmtNum(v)}</text>`;
      const rows = st.map(([a, v], k) => {
        const y = top + k * rowH + rowH / 2;
        return `<g class="${first(a) ? "best" : ""}"><text class="lbl" x="${L - 8}" y="${y + 4}" text-anchor="end">${esc(name(a))}</text>
          <line class="span" x1="${X(v.min * sc)}" x2="${Math.max(X(v.max * sc), X(v.min * sc) + 0.5)}" y1="${y}" y2="${y}"/>
          <circle class="med" cx="${X(v.median * sc)}" cy="${y}" r="4"><title>${esc(name(a))}: median ${fmtNum(v.median * sc)}${v.n > 1 ? `, range ${fmtNum(v.min * sc)}–${fmtNum(v.max * sc)}` : ""}, ${v.n} round${v.n > 1 ? "s" : ""}</title></circle>
          <text class="tick" x="${R + 8}" y="${y + 4}">${fmtNum(v.median * sc)}</text></g>`;
      }).join("");
      return `<div class="range"><h3>${esc(title)}</h3><span class="unit">${esc(unit)} · ${hi ? "higher" : "lower"} is better</span>
        <svg viewBox="0 0 440 ${H}" role="img" aria-label="${esc(title)} per app">${ticks}${rows}</svg>
        ${missing.length ? `<span class="unit">No result: ${esc(missing.join(", "))}</span>` : ""}</div>`;
    };

    const lb = x.leaderboard ? Object.entries(x.leaderboard) : [];
    const rk = (v) => fmtNum(+v.toFixed(2));
    const board = lb.length ? `<div class="bn-block"><h3>Leaderboard</h3>
        <p>Score = 35% efficiency under traffic + 35% efficiency at idle + 30% performance. Each part is the app's average place
          across its measures (1 = best), so lower is better. The tie-aware score counts two apps as tied when their best-to-worst rounds overlap.</p>
        <div class="table-wrap"><table><thead><tr><th class="num">#</th><th>App</th><th class="num">Score</th><th class="num">Tie-aware</th>
          <th class="num">Traffic</th><th class="num">Idle</th><th class="num">Performance</th></tr></thead><tbody>
        ${lb.map(([a, v], i) => `<tr${i === 0 ? ' class="lead"' : ""}><td class="num">${i + 1}</td><td><b>${esc(name(a))}</b> <span class="note">${esc(ver(a))}</span></td>
          <td class="num"><b>${v.score.toFixed(2)}</b></td><td class="num">${v.score_tie.toFixed(2)}</td>
          <td class="num">${rk(v.traffic)}</td><td class="num">${rk(v.idle)}</td><td class="num">${rk(v.perf)}</td></tr>`).join("")}
        </tbody></table></div></div>`
      : `<div class="bn-block"><h3>No leaderboard</h3><p>One round only, so this is a first look rather than a ranking. It shows each app's own limits with no internet in the way.</p></div>`;

    const cc = this.data.chain_cost && this.data.chain_cost["dl_100m.tunnel_energy_per_gb"];
    const chain = this.exp === "A" && cc ? `<div class="bn-block"><h3>What the chain costs</h3>
        <p>App energy per GB at 100 Mbit/s, one hop (simple setup) against chain + rules (daily setup). The two ran on different days.</p>
        <div class="table-wrap"><table><thead><tr><th>App</th><th class="num">One hop (J)</th><th class="num">Chain + rules (J)</th><th class="num">Factor</th></tr></thead><tbody>
        ${Object.entries(cc).map(([a, v]) => `<tr><td><b>${esc(name(a))}</b>${v.same_version ? "" : ` <span class="note">updated in between (2.3 → 2.4)</span>`}</td>
          <td class="num">${fmtNum(v.one_hop)}</td><td class="num">${fmtNum(v.chain)}</td><td class="num">${v.factor.toFixed(1)}×</td></tr>`).join("")}
        </tbody></table></div>
        <p>Anywhere 2.4 runs about a quarter of its tunnel work on the Mac's performance cores (2.3 used none), and each CPU-second there
          costs about 3× the energy. On the chain, 2.3 measured 2.2 J/GB in a one-round check, so most of its jump comes from the update.</p></div>` : "";

    const cards = BENCH_CARDS[this.exp].map(([g, list]) => {
      const html = list.map(plot).join("");
      return html ? `<div class="bn-block"><h3>${esc(g)}</h3><div class="ranges">${html}</div></div>` : "";
    }).join("");

    const appCards = apps.map((c) => {
      const a = APPS.find((y) => y.name === BENCH_APP_NOTES[c]);
      return a ? `<div class="app"><h3>${esc(name(c))}<span>${esc(ver(c))}</span></h3>
        <dl class="kv">${a.kv.filter(([k]) => /Core|IP stack|License/.test(k)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <p>${esc(a.note)}</p>${srcLinks(a.src)}</div>` : "";
    }).join("");

    $("#bn-body").innerHTML = `
      <div class="bn-meta"><span>Mac <b>${esc(BENCH_MACS[x.mac] || x.mac)}</b>, on battery</span>
        <span>${x.sessions.length > 1 ? "Runs" : "Run"} <b>${esc([...new Set(x.sessions.map(date))].join(", "))} 2026</b></span>
        <span>Rounds <b>${x.rounds}</b></span><span>Apps <b>${apps.length}</b></span></div>
      <p class="bn-setup">${esc(x.setup.replace(/->/g, "→"))}${x.note ? ` ${esc(x.note)}` : ""}</p>
      ${board}${cards}${chain}
      <p class="note">Line = best to worst round, dot = median, number = median. Green apps share first place.
        App power and energy come from macOS's per-process counters for the tunnel process; whole-Mac energy from the battery's power sensor.
        Every app window was closed during the tests: an open window costs more than the tunnel itself.</p>
      ${appCards ? `<div class="bn-block"><h3>What's inside each app</h3>
        <p>From the apps' published code and App Store notes. On iPhone the tunnel runs in a Network Extension with a ~50 MiB memory limit.</p>
        <div class="apps">${appCards}</div></div>` : ""}
      <p class="note">One Mac, one network, one week of October 2026; results can change with app updates. The Mac numbers stand in for iPhone ones: same apps and code, but no phone battery was measured.</p>`;
  }
};
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw || 1)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function fmtNum(v) { const a = Math.abs(v); return a >= 100 ? Math.round(v).toLocaleString("en") : a >= 10 ? +v.toFixed(1) + "" : a >= 1 ? +v.toFixed(2) + "" : +v.toFixed(3) + ""; }

showTab(location.hash.slice(1) || "setup");
