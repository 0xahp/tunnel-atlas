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
      <div><b>2026</b>${stCell({ s: "ok" }, "IR")}works ${stCell({ s: "deg" }, "IR")}degraded ${stCell({ s: "blk" }, "IR")}blocked
        ${stCell({ s: "blk", inf: true }, "IR")}inferred ${stCell({ s: "unk" }, "IR")}no data</div>
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
   Reads proxy-bench live when the page is served next to it (local use); otherwise the copy in bench/
   made by sync-bench.sh (the published site). */
const BENCH_SOURCES = [
  { live: true, local: true, sum: "../proxy-bench/results/summary.json", apps: "../proxy-bench/configs/apps.tsv", meta: (s) => `../proxy-bench/results/raw/${s}/meta.txt` },
  { live: false, sum: "bench/summary.json", apps: "bench/apps.tsv", meta: () => "bench/meta.txt" }
];
const BENCH_APP_NOTES = { anywhere: "Anywhere", sfm: "sing-box for Apple", karing: "Karing", shadowrocket: "Shadowrocket", egern: "Egern" };
const Bench = {
  async init() {
    const get = (u, as) => fetch(u, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(r.status); return r[as](); });
    const onLocalhost = ["127.0.0.1", "localhost"].includes(location.hostname);
    for (const src of BENCH_SOURCES) {
      if (src.local && !onLocalhost) continue;
      let data;
      try {
        const [sum, tsv] = await Promise.all([get(src.sum, "json"), get(src.apps, "text")]);
        const names = {};
        tsv.trim().split("\n").slice(1).forEach((l) => { const [k, name] = l.split("\t"); names[k] = name; });
        const lastB = sum.sessions.filter((s) => s.endsWith("-B")).pop();
        const meta = lastB ? await get(src.meta(lastB), "text").catch(() => "") : "";
        data = [sum, names, meta, src.live];
      } catch (e) { continue; /* try the next source */ }
      this.render(...data);
      if (this.jump) { this.jump = false; $("#bench").scrollIntoView(); }
      return;
    }
    $("#bn-body").innerHTML = `<div class="empty"><h3>Benchmark results unavailable</h3>
      <p class="note" style="margin:0">The results load over HTTP; opened as a local file, the page can't read them.</p></div>`;
  },
  render(sum, names, meta, live) {
    const apps = Object.keys(names);
    const entry = (mo, ca, me) => sum.summary.find((e) => e.mode === mo && e.case === ca && e.metric === me);
    const versions = {}; let model = "";
    for (const line of meta.split("\n")) {
      const m = line.match(/^app (\w+)=(.+)$/); if (m) versions[m[1]] = m[2];
      const c = line.match(/^model=(\S+) cpu=(.+)$/); if (c) model = `${c[2]} (${c[1]})`;
    }
    const mtu = {};
    sum.summary.filter((e) => e.metric === "mtu").forEach((e) => { for (const [c, v] of Object.entries(e.stats)) mtu[c] = Math.round(v.median); });
    for (const c in names) if (mtu[c] && mtu[c] !== 1500) versions[c] = (versions[c] || "") + ` · MTU ${mtu[c]}`;
    const DL = entry("B", "dl_100m", "tunnel_cpu_per_gb") ? "dl_100m" : "dl_max";
    const RANKED = [ // same measures and tie rule as proxy-bench/scripts/make_page.py
      ["Idle: wakeups per second", "B", "idle", "tunnel_wakeups_per_s", "lower"],
      ["Idle: CPU", "B", "idle", "tunnel_cpu_pct", "lower"],
      ["Idle: whole-Mac power above no VPN", "B", "idle", "pstr_extra_w", "lower"],
      ["Idle: memory", "B", "idle", "tunnel_footprint_mb", "lower"],
      ["Download: CPU per GB", "B", DL, "tunnel_cpu_per_gb", "lower"],
      ["Download: app energy per GB", "B", DL, "tunnel_energy_per_gb", "lower"],
      ["Download: whole-Mac energy per GB", "B", DL, "pstr_energy_per_gb", "lower"],
      ["Web request: time to first byte", "B", "req50", "first_byte_ms", "lower"],
      ["Lab: top speed, upload", "L", "tcp_up_1", "gbps", "higher"],
      ["Lab: top speed, download", "L", "tcp_down_1", "gbps", "higher"],
      ["Lab: CPU per GB at 500 Mbit/s", "L", "tcp_up_500m", "tunnel_cpu_per_gb", "lower"]
    ];
    const tieRanks = (e, better) => {
      const st = Object.fromEntries(Object.entries(e.stats).filter(([c]) => names[c]));
      const beats = better === "lower" ? (d, c) => st[d].max < st[c].min : (d, c) => st[d].min > st[c].max;
      const r = {};
      for (const c in st) r[c] = 1 + Object.keys(st).filter((d) => d !== c && beats(d, c)).length;
      for (const c in e.excluded || {}) if (names[c]) r[c] = Object.keys(st).length + Object.keys(e.excluded).length;
      return r;
    };
    const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const ranks = {}, used = [];
    for (const [t, mo, ca, me, b] of RANKED) {
      const e = entry(mo, ca, me);
      const ns = e ? Object.entries(e.stats).filter(([c]) => names[c]).map(([, v]) => v.n) : [];
      if (!ns.length || median(ns) < 3) continue;
      used.push([t, e, b]);
      for (const [c, r] of Object.entries(tieRanks(e, b))) (ranks[c] = ranks[c] || {})[t] = r;
    }
    const avg = Object.fromEntries(Object.entries(ranks).map(([c, v]) => [c, Object.values(v).reduce((a, x) => a + x, 0) / Object.values(v).length]));
    const board = Object.keys(avg).sort((a, b) => avg[a] - avg[b]);
    const fails = (c) => Object.values(sum.failures || {}).reduce((a, by) => a + ((by[c] || {}).failed || []).length, 0);
    const runs = (c) => Object.values(sum.failures || {}).reduce((a, by) => a + ((by[c] || {}).runs || 0), 0);
    const nApps = board.length;
    const rk = (r) => r === undefined ? "–" : `<span class="rk ${r === 1 ? "r1" : r >= nApps ? "rlast" : "rmid"}">${r}</span>`;
    const fmtDate = (s) => { const m = s.match(/^(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)/); return m ? `${+m[3]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m[2] - 1]} ${m[4]}:${m[5]}` : s; };
    const head = used.map(([t], i) => `<th class="num" title="${esc(t)}">${i + 1}</th>`).join("");
    const rows = board.map((c, p) => `<tr${p === 0 ? ' class="lead"' : ""}><td class="num">${p + 1}</td><td><b>${esc(names[c])}</b> <span class="note">${esc(versions[c] || "")}</span></td>
      <td class="num"><b>${avg[c].toFixed(1)}</b></td><td class="num">${fails(c)} of ${runs(c)}</td>${used.map(([t]) => `<td class="num">${rk(ranks[c][t])}</td>`).join("")}</tr>`).join("");
    const key = used.map(([t], i) => `<li>${i + 1}. ${esc(t)}</li>`).join("");

    // range plots: min–max line and median dot per app; green = shares rank 1
    const rate = DL === "dl_100m" ? "At 100 Mbit/s" : "At full speed";
    const PLOTS = [
      ["Idle power above no VPN", "Whole Mac, screen off, 2 min · mW", "B", "idle", "pstr_extra_w", 1000],
      ["Idle wakeups", "Tunnel process · per second", "B", "idle", "tunnel_wakeups_per_s", 1],
      ["CPU per GB downloaded", `${rate} · CPU-seconds per GB`, "B", DL, "tunnel_cpu_per_gb", 1],
      ["Whole-Mac energy per GB", `${rate} · joules per GB`, "B", DL, "pstr_energy_per_gb", 1],
      ["Time to first byte", "50 web requests · ms", "B", "req50", "first_byte_ms", 1],
      ["Peak memory", "Tunnel process · MiB; red line = iOS packet-tunnel limit (50 MiB)", "B", "block", "tunnel_peak_footprint_mb", 1, 50]
    ];
    const plot = ([title, unit, mo, ca, me, sc, lim]) => {
      const e = entry(mo, ca, me);
      if (!e) return "";
      const r1 = tieRanks(e, "lower");
      const st = Object.entries(e.stats).filter(([c]) => names[c]).sort((a, b) => a[1].median - b[1].median);
      const lo = Math.min(0, ...st.map(([, v]) => v.min * sc)), hi = Math.max(lim || 0, ...st.map(([, v]) => v.max * sc)) * 1.06;
      const L = 104, R = 396, rowH = 22, top = 8, H = top + st.length * rowH + 22;
      const x = (v) => L + (v - lo) / (hi - lo || 1) * (R - L);
      const step = niceStep((hi - lo) / 4);
      let ticks = "";
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
        ticks += `<line class="ax" x1="${x(v)}" x2="${x(v)}" y1="${top - 4}" y2="${H - 18}"/><text class="tick" x="${x(v)}" y="${H - 5}" text-anchor="middle">${fmtNum(v)}</text>`;
      const bars = st.map(([c, v], k) => {
        const yy = top + k * rowH + rowH / 2;
        return `<g class="${r1[c] === 1 ? "best" : ""}"><text class="lbl" x="${L - 8}" y="${yy + 4}" text-anchor="end">${esc(names[c])}</text>
          <line class="span" x1="${x(v.min * sc)}" x2="${Math.max(x(v.max * sc), x(v.min * sc) + 0.5)}" y1="${yy}" y2="${yy}"/>
          <circle class="med" cx="${x(v.median * sc)}" cy="${yy}" r="4"><title>${esc(names[c])}: median ${fmtNum(v.median * sc)}, range ${fmtNum(v.min * sc)}–${fmtNum(v.max * sc)}, ${v.n} runs</title></circle></g>`;
      }).join("");
      const limLine = lim ? `<line class="lim" x1="${x(lim)}" x2="${x(lim)}" y1="${top - 4}" y2="${H - 18}"/>` : "";
      return `<div class="range"><h3>${esc(title)}</h3><span class="unit">${esc(unit)}</span>
        <svg viewBox="0 0 410 ${H}" role="img" aria-label="${esc(title)} per app">${ticks}${limLine}${bars}</svg></div>`;
    };

    const appCards = board.map((c) => {
      const a = APPS.find((x) => x.name === BENCH_APP_NOTES[c]);
      if (!a) return `<div class="app"><h3>${esc(names[c])}<span>${esc(versions[c] || "")}</span></h3><p>No public details about its internals.</p></div>`;
      return `<div class="app"><h3>${esc(names[c])}<span>${esc(versions[c] || "")}</span></h3>
        <dl class="kv">${a.kv.filter(([k]) => /Core|IP stack|License/.test(k)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <p>${esc(a.note)}</p>${srcLinks(a.src)}</div>`;
    }).join("");

    const sessions = sum.sessions.slice().sort().map((s) => `${fmtDate(s)} (${s.endsWith("-L") ? "lab" : "real server"})`).join(" · ");
    $("#bn-lede").textContent = `${nApps} client apps send the same VLESS + REALITY traffic through the same server on one Mac, on battery. The ranking is about cost: power, CPU, memory and wakeups. Overall leader so far: ${names[board[0]] || "none yet"}.`;
    $("#bn-body").innerHTML = `
      <div class="bn-meta"><span>Mac <b>${esc(model || "unknown")}</b></span><span>Sessions <b>${esc(sessions)}</b></span><span>${live ? "Live results" : "Results snapshot"}</span></div>
      <div class="bn-block"><h3>Leaderboard</h3>
        <p>Each app's rank (1 = best) in every reliable measure, averaged. Apps whose best-to-worst ranges overlap share a rank, so a gap that could be noise doesn't count. Failed tests are shown, not ranked.</p>
        <div class="table-wrap"><table><thead><tr><th class="num">#</th><th>App</th><th class="num">Avg rank</th><th class="num">Failed</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
        <details><summary class="note">Measure columns 1–${used.length}</summary><ol class="note" style="list-style:none;padding:0">${key}</ol></details></div>
      <div class="bn-block"><h3>Spread per app</h3>
        <p>Line = best to worst run, dot = median. Green apps share first place. Lower is better in every chart.</p>
        <div class="ranges">${PLOTS.map(plot).join("")}</div></div>
      <div class="bn-block"><h3>What's inside each app</h3>
        <p>From the apps' published code and App Store notes. On iPhone the tunnel runs in a Network Extension with a ~50 MiB memory limit, so a light footprint here matters more there.</p>
        <div class="apps">${appCards}</div></div>
      <p class="note">The Mac numbers stand in for iPhone ones: same apps and code, but no phone battery was measured.</p>`;
  }
};
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw || 1)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function fmtNum(v) { const a = Math.abs(v); return a >= 100 ? Math.round(v).toLocaleString("en") : a >= 10 ? +v.toFixed(1) + "" : a >= 1 ? +v.toFixed(2) + "" : +v.toFixed(3) + ""; }

showTab(location.hash.slice(1) || "setup");
