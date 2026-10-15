/* Tunnel Atlas: renders index.html from data.js. Three tabs: benchmark; setup (picks and their flow); timeline. */

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
const TABS = ["bench", "setup", "timeline"];
const rendered = {};
function showTab(id, focus) {
  if (id === "picks") id = "setup"; // old link
  if (!TABS.includes(id)) id = "bench";
  for (const t of TABS) {
    const on = t === id, btn = $("#tab-" + t);
    btn.setAttribute("aria-selected", on);
    btn.tabIndex = on ? 0 : -1;
    $("#" + t).hidden = !on;
  }
  if (focus) $("#tab-" + id).focus();
  if (!rendered[id]) { rendered[id] = true; ({ timeline: Timeline, setup: Picks, bench: Bench })[id].init(); }
  if (id === "timeline") Timeline.layout();
  if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
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
   Reads bench/experiments.json. Three setups, never pooled. */
const BENCH_NAMES = { anywhere: "Anywhere", sfm: "SFM", happ: "Happ", v2box: "V2Box", shadowrocket: "Shadowrocket", egern: "Egern", karing: "Karing", rabbithole: "Rabbit Hole" };
const BENCH_APP_NOTES = { anywhere: "Anywhere", sfm: "sing-box for Apple", karing: "Karing", shadowrocket: "Shadowrocket", egern: "Egern" };
const BENCH_MACS = { "MacBookAir10,1": "MacBook Air M1" };
const BENCH_SETUPS = {
  A: ["Chain + rules", "The everyday setup: the app chains two proxies, and rules decide which sites use the tunnel, which go straight out and which ads are blocked."],
  B: ["Basic", "The simplest setup: one proxy, no rules, everything through the tunnel."],
  C: ["Top speed", "A lab test on the Mac itself, with no internet in the way: how fast each app can move data, and what it costs at a steady 500 Mbit/s. One round only, so a first look rather than a ranking."]
};
// table columns per setup: [group, label, unit, case, metric, scale, higher is better]
const IDLE_COLS = (c) => [["Idle", "Wakeups", "per s", c, "tunnel_wakeups_per_s", 1], ["Idle", "Power", "µW", c, "tunnel_power_w", 1e6]];
const LOAD_COLS = (g, c) => [[g, "Power", "mW", c, "tunnel_power_w", 1e3], [g, "Energy", "J per GB", c, "tunnel_energy_per_gb", 1], [g, "CPU", "%", c, "tunnel_cpu_pct", 1]];
const BENCH_COLS = {
  A: [...IDLE_COLS("idle"), ...LOAD_COLS("At 100 Mbit/s", "dl_100m"), ["Full speed", "Speed", "Mbit/s", "dl_max", "mbps", 1, true], ["Web pages", "First byte", "ms", "req50", "first_byte_ms", 1]],
  B: [...IDLE_COLS("idle"), ...LOAD_COLS("At 100 Mbit/s", "dl_100m"), ["Web pages", "First byte", "ms", "req50", "first_byte_ms", 1]],
  C: [["Top speed", "Upload", "Gbit/s", "tcp_up_1", "gbps", 1, true], ...LOAD_COLS("At 500 Mbit/s", "tcp_up_500m"), ...IDLE_COLS("idle30")]
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
    $("#bn-exp").innerHTML = Object.entries(BENCH_SETUPS).map(([id, [t]]) => `<button type="button" role="radio" data-v="${id}">${esc(t)}</button>`).join("");
    $("#bn-exp").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { this.exp = b.dataset.v; this.render(); } });
    this.render();
  },
  render() {
    $("#bn-exp").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.v === this.exp));
    const x = this.data.experiments.find((e) => e.id === this.exp);
    const name = (a) => BENCH_NAMES[a] || a;
    const ver = (a) => x.versions[a].replace(/\s*\(.*\)$/, "");
    const stats = (ca, me) => (x.metrics.find((m) => m.case === ca && m.metric === me) || {}).stats || {};
    const date = (s) => { const m = s.match(/^\d{4}(\d\d)(\d\d)/); return m ? `${+m[2]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m[1] - 1]}` : s; };
    const cols = BENCH_COLS[this.exp];
    const lb = x.leaderboard;
    // rows: leaderboard order, or fastest first when there is no leaderboard
    const [, , , ca0, me0] = cols[0];
    const apps = lb ? Object.keys(lb) : Object.keys(x.versions).sort((p, q) => (stats(ca0, me0)[q] || { median: -1 }).median - (stats(ca0, me0)[p] || { median: -1 }).median);

    const cell = ([, , , ca, me, sc, hi], a) => {
      const s = stats(ca, me), v = s[a];
      if (!v) return `<td class="num na" title="No result">–</td>`;
      const beats = hi ? (d) => s[d].min > v.max : (d) => s[d].max < v.min;
      const best = !Object.keys(s).some((d) => d !== a && beats(d));
      const meds = Object.values(s).map((y) => y.median);
      const worst = Object.keys(s).length > 2 && v.median === (hi ? Math.min(...meds) : Math.max(...meds));
      const tip = `${name(a)}: median ${fmtNum(v.median * sc)}${v.n > 1 ? `, range ${fmtNum(v.min * sc)}–${fmtNum(v.max * sc)} over ${v.n} rounds` : ""}`;
      return `<td class="num${best ? " best" : worst ? " worst" : ""}" title="${esc(tip)}">${fmtNum(v.median * sc)}</td>`;
    };
    const groups = [];
    cols.forEach(([g]) => { const last = groups[groups.length - 1]; if (last && last[0] === g) last[1]++; else groups.push([g, 1]); });
    const lead = lb ? 3 : 1;
    const table = `<div class="table-wrap"><table class="bn-table">
      <thead><tr><th colspan="${lead}"></th>${groups.map(([g, n]) => `<th class="grp" colspan="${n}">${esc(g)}</th>`).join("")}</tr>
        <tr>${lb ? `<th class="num">#</th>` : ""}<th class="who">App</th>${lb ? `<th class="num">Score</th>` : ""}${cols.map(([, l, u, , , , hi]) => `<th class="num">${esc(l)}<span>${esc(u)} ${hi ? "↑" : "↓"}</span></th>`).join("")}</tr></thead>
      <tbody>${apps.map((a, i) => `<tr${lb && i === 0 ? ' class="lead"' : ""}>${lb ? `<td class="num">${i + 1}</td>` : ""}
        <td class="who"><b>${esc(name(a))}</b><span class="note">${esc(ver(a))}</span></td>
        ${lb ? `<td class="num" title="Tie-aware score ${lb[a].score_tie.toFixed(2)}"><b>${lb[a].score.toFixed(2)}</b></td>` : ""}
        ${cols.map((c) => cell(c, a)).join("")}</tr>`).join("")}</tbody></table></div>`;

    const cc = this.data.chain_cost && this.data.chain_cost["dl_100m.tunnel_energy_per_gb"];
    const chain = this.exp === "A" && cc ? `<div class="bn-block"><h3>What the chain costs</h3>
        <p>App energy per GB at 100 Mbit/s, basic setup against chain + rules. The two ran on different days.</p>
        <div class="table-wrap"><table><thead><tr><th>App</th><th class="num">Basic (J)</th><th class="num">Chain + rules (J)</th><th class="num">Factor</th></tr></thead><tbody>
        ${Object.entries(cc).map(([a, v]) => `<tr><td><b>${esc(name(a))}</b>${v.same_version ? "" : ` <span class="note">updated in between (2.3 → 2.4)</span>`}</td>
          <td class="num">${fmtNum(v.one_hop)}</td><td class="num">${fmtNum(v.chain)}</td><td class="num">${v.factor.toFixed(1)}×</td></tr>`).join("")}
        </tbody></table></div>
        <p>Anywhere 2.4 runs about a quarter of its tunnel work on the Mac's performance cores (2.3 used none), and each CPU-second there
          costs about 3× the energy. On the chain, 2.3 measured 2.2 J/GB in a one-round check, so most of its jump comes from the update.</p></div>` : "";

    const appCards = apps.map((c) => {
      const a = APPS.find((y) => y.name === BENCH_APP_NOTES[c]);
      return a ? `<div class="app"><h3>${esc(name(c))}<span>${esc(ver(c))}</span></h3>
        <dl class="kv">${a.kv.filter(([k]) => /Core|IP stack|License/.test(k)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <p>${esc(a.note)}</p>${srcLinks(a.src)}</div>` : "";
    }).join("");

    $("#bn-body").innerHTML = `
      <div class="bn-block"><p class="bn-setup">${esc(BENCH_SETUPS[this.exp][1])}</p>
        <div class="bn-meta"><span>Mac <b>${esc(BENCH_MACS[x.mac] || x.mac)}</b>, on battery</span>
          <span>${x.sessions.length > 1 ? "Runs" : "Run"} <b>${esc([...new Set(x.sessions.map(date))].join(", "))} 2026</b></span>
          <span>Rounds <b>${x.rounds}</b></span><span>Apps <b>${apps.length}</b></span></div></div>
      <div class="bn-block"><h3>${lb ? "Leaderboard and every measure" : "Every measure"}</h3>
        ${table}
        <p>Each number is the app's median over all rounds; hover it for the range. ↓ lower is better, ↑ higher is better.
          <span class="key best">Green</span> = best, or tied with the best (their ranges overlap). <span class="key worst">Red</span> = worst.
          ${lb ? "Score = 35% efficiency under traffic + 35% efficiency at idle + 30% performance; each part is the app's average place, so lower is better." : ""}
          Power, energy and CPU are for the app's tunnel process only.${x.note ? ` ${esc(x.note)}` : ""}</p></div>
      ${chain}
      ${appCards ? `<div class="bn-block"><h3>What's inside each app</h3>
        <p>From the apps' published code and App Store notes. On iPhone the tunnel runs in a Network Extension with a ~50 MiB memory limit.</p>
        <div class="apps">${appCards}</div></div>` : ""}
      <p class="note">One Mac, one network, one week of October 2026; results can change with app updates. Every app window was closed during the tests,
        since an open window costs more than the tunnel. The Mac numbers stand in for iPhone ones: same apps and code, but no phone battery was measured.</p>`;
  }
};
function fmtNum(v) { const a = Math.abs(v); return a >= 100 ? Math.round(v).toLocaleString("en") : a >= 10 ? +v.toFixed(1) + "" : a >= 1 ? +v.toFixed(2) + "" : +v.toFixed(3) + ""; }

showTab(location.hash.slice(1) || "bench");
