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
  if (id === "bench" && Bench.x) Bench.chart(); // redraw at the current width
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
    // phones: the same path top to bottom; the wire below a hop glows where it is encrypted
    const vflow = r.hops.map((h, k) => {
      const tun = k < n - 1 && r.enc.some(([a, b]) => a <= k && k < b);
      const legs = k < n - 1 ? [...r.enc.filter(([a]) => a === k).map(([, , l]) => `<span class="vtun">${esc(l)}</span>`), r.legs && r.legs[k] ? `<span>${esc(r.legs[k])}</span>` : ""].join("") : "";
      const seen = SEEN_KEYS.map(([key, lbl]) => { const v = h.seen[key], [s, note] = Array.isArray(v) ? v : [v, ""];
        return `<li><span class="dot ${s}" title="${SEEN_MARK[s]}"></span>${esc(lbl)}${note ? ` <em>${esc(note)}</em>` : ""}</li>`; }).join("");
      return `<li class="vhop ${h.zone}${tun ? " tun" : ""}${k === n - 1 ? " last" : ""}"><span class="vnode" aria-hidden="true"></span><div class="vbody">
        ${k === 0 || r.hops[k - 1].zone !== h.zone ? `<span class="vzone">${ZN[h.zone]}</span>` : ""}
        <span class="vtitle"><span class="hop-title">${esc(h.title)}</span><span class="hop-sub">${esc(h.sub)}</span></span>
        <ul class="vseen" aria-label="What this hop sees">${seen}</ul><p class="hop-desc">${esc(h.desc)}</p>${legs ? `<p class="vleg">${legs}</p>` : ""}</div></li>`;
    }).join("");
    $("#pk-flow").innerHTML = `
      <div class="flow-head"><h2>${esc(r.name)}</h2>
        <div class="flow-stats"><span>Censor sees <b>${esc(r.sees)}</b></span><span>Servers <b>${esc(r.extra)}</b></span><span>Delay <b>${esc(r.latency)}</b></span></div></div>
      <div class="flow-scroll screen"><div class="flow-grid" style="--hops:${n}">${grid}</div></div>
      <ol class="vflow screen">${vflow}</ol>
      <div class="flow-key"><span><i class="dot y"></i>sees it</span><span><i class="dot p"></i>partly</span><span><i class="dot n"></i>can't see it</span><span>Gold bar: encrypted span</span></div>
      <div class="flow-pc"><div><span class="ro-label">Good</span><ul>${r.pros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><span class="ro-label">Watch out</span><ul>${r.cons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><span class="ro-label">Used by</span><ul>${r.used.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      ${srcLinks(r.src.concat(r.hops.flatMap((h) => h.src || [])))}`;
  }
};

/* ==================== Client-app benchmark ====================
   Reads bench/experiments.json. The Mac and iPhone labs, never pooled. */
const BENCH_NAMES = { anywhere: "Anywhere", sfm: "SFM", happ: "Happ", v2box: "V2Box", shadowrocket: "Shadowrocket", egern: "Egern", karing: "Karing", rabbithole: "Rabbit Hole",
  throne: "Throne", surge: "Surge", flclash: "FlClash", verge: "Clash Verge Rev", koala: "Koala Clash", clash: "Clash (Hako)", onexray: "OneXray",
  streisand: "Streisand", incy: "incy", clashplus: "Clash Plus", cli: "sing-box CLI", hiddify: "Hiddify", v2rayn: "v2rayN" };
// core read from the Go modules inside each installed Mac app (20 Oct); license from the project's GitHub page; blank = not sure
const BENCH_CORES = [
  ["sing-box", "Go; the SagerNet core", { sfm: ["libbox (gomobile)", "GPL-3.0"], cli: ["the core itself", "GPL-3.0 + name clause"],
    karing: ["LibVpnCore", "GPL-3.0 + name clause", "mixed (as tested)"], hiddify: ["hiddify-core (sing-box 1.13.0)", "", "mixed (as tested)"] }],
  ["sing-box and Xray", "both cores built in", { throne: ["ThroneCore, a separate process", "GPL-3.0"], streisand: ["sing-box 1.14 + Xray"],
    v2rayn: ["two processes in series: sing-box 1.14.3 TUN → Xray 26.10.10", "GPL-3.0", "mixed (as tested)"] }],
  ["mihomo", "Go; the Clash Meta core", { flclash: ["", "GPL-3.0"], verge: ["", "GPL-3.0"], koala: ["", "GPL-3.0"], clash: ["mihomo 1.19.32"],
    rabbithole: [""], clashplus: [""] }],
  ["Xray", "Go; the XTLS core", { onexray: ["libXray", "GPL-3.0"], happ: ["libXray"], v2box: [""], incy: [""] }],
  ["Own core", "no sing-box, Xray or mihomo inside", { anywhere: ["Swift", "GPL-3.0", "AnywhereIP (own, Swift)"], surge: [""], shadowrocket: [""],
    egern: ["", "", "own user-space stack (vendor's note, 2.15)"] }]];
const BENCH_MACS = { "MacBookAir10,1": "MacBook Air M1", "iPhone12,3": "iPhone 11 Pro" };
// keep in sync with make-static.py
const BENCH_CHAIN_NOTE = ["Real use costs more.", "These labs measure one proxy with no rules. In an earlier test through real servers, "
  + "two chained proxies with routing rules used about 3× the energy per GB of a single proxy (1.8–3.1× across the apps that kept the same version)."];
// keep in sync with make-static.py
const BENCH_MTU_NOTE = ["MTU changes results a lot.", "At the common 1500, an app handles about 2.7× more packets per GB than at 4000. "
  + "In our checks, raising the MTU from 1500 to 4000 lifted SFM's upload from 10.8 to about 14.3 Gbit/s (1.3×), and Karing's speed from 0.9 to 2.4 Gbit/s "
  + "(2.5×, with its stack also changed) while its CPU time per GB fell by about a fifth. On the Mac, the six apps stuck at 1500 are the six slowest. "
  + "We set 4000 wherever an app allows it."];
// keep in sync with make-static.py
const BENCH_LAB_METHOD = [
  "MacBook Air M1, macOS 27.0.1, on battery, screen off, no app windows open. Every app ran in TUN mode with the same Shadowsocks 2022 profile "
  + "(2022-blake3-aes-128-gcm) to a sing-box server on the same Mac; iperf3 3.22 drove the traffic. A script ran the apps one at a time over two rounds, "
  + "the second in reverse order. Speed: 5 s after a 2 s warm-up, over 1 and 4 connections. Efficiency: a steady 200 Mbit/s download for 20 s, with the "
  + "energy, CPU time and memory of the app's tunnel process. Each test confirmed its traffic went through the tunnel; any test with keyboard or trackpad "
  + "input was repeated. The sing-box command line is included as a baseline for the core alone. Versions as installed on 20–21 Oct 2026.",
  "MTU is as macOS reported it (4000 requested where possible). Score = 100 × (speed ÷ best speed)^0.3 × (best energy per GB ÷ energy per GB)^0.7: efficiency weighs more because the top apps are already far faster "
  + "than any internet connection.",
  "Exceptions: Karing used its mixed stack. Happ ignores its MTU setting on the Mac. Hiddify 5.0.0 (a development build) ran as root with its fixed MTU of 9000. "
  + "v2rayN chains two cores (sing-box, then Xray). Karing's 4-connection download and v2rayN's 1-connection upload are from one round."];
// keep in sync with make-static.py
const BENCH_IPHONE_METHOD = [
  "iPhone 11 Pro, iOS 27.0.1, on the USB cable at full charge, run overnight by an automated test with nobody touching it. A test app on the phone runs "
  + "a Shadowsocks 2022 server (2022-blake3-aes-128-gcm) that every VPN app points at, so no Wi-Fi or internet is involved. Three rounds, apps in a "
  + "different order each round. Speed: 5 s after a 2 s warm-up, over 1 and 4 connections. Efficiency: one download held at 200 Mbit/s for 120 s. "
  + "Idle: 10 min with the screen locked. Versions as installed on 21 Oct 2026.",
  "Power is the whole phone's, from its battery gauge; \"extra\" subtracts the same test without a VPN (0.68 W under load, 0.65 W idle). "
  + "Energy per GB uses the speed actually held (Happ reached only 130 Mbit/s, V2Box 180). CPU and memory are the tunnel process's own. "
  + "Idle power differences are mostly within noise (±0.07 W); wakeups show how often the tunnel woke the processor. Same score formula as the Mac lab.",
  "Exception: one Hiddify round failed partway, so its speed and 200 Mbit/s figures are from two rounds."];
const BENCH_SETUPS = {
  L: ["Mac lab", "Each app tunnels traffic to a test server on the same Mac, so no network is in the way and the numbers show the app's own cost. Ranked by speed (30%) and energy efficiency (70%); pick a measure to rank by it."],
  I: ["iPhone lab", "The same test on an iPhone: the server runs inside a test app on the phone, so only the VPN app is in the way. Ranked by speed (30%) and energy efficiency (70%); pick a measure to rank by it."]
};
// table columns per setup: [group, label, unit, case, metric, scale, higher is better, case also shown in the tooltip]
const BENCH_COLS = {
  L: [["", "Score", "of 100", "lab", "score", 1, true],
    ["Speed", "Average", "Gbit/s", "speed", "gbps_avg", 1, true], ["Speed", "1 conn.", "down, Gbit/s", "down_1", "gbps", 1, true, "up_1"],
    ["Speed", "4 conn.", "down, Gbit/s", "down_4", "gbps", 1, true, "up_4"],
    ["At 200 Mbit/s", "Energy", "J per GB", "down_200", "tunnel_energy_per_gb", 1], ["At 200 Mbit/s", "CPU", "s per GB", "down_200", "tunnel_cpu_per_gb", 1],
    ["At 200 Mbit/s", "Memory", "MB", "down_200", "tunnel_footprint_mb", 1]],
  I: [["", "Score", "of 100", "lab", "score", 1, true],
    ["Speed", "Average", "Gbit/s", "speed", "gbps_avg", 1, true], ["Speed", "1 conn.", "down, Gbit/s", "down_1", "gbps", 1, true, "up_1"],
    ["Speed", "4 conn.", "down, Gbit/s", "down_4", "gbps", 1, true, "up_4"],
    ["At 200 Mbit/s", "Extra power", "mW", "down_200", "phone_extra_w", 1e3], ["At 200 Mbit/s", "Energy", "J per GB", "down_200", "phone_energy_per_gb", 1],
    ["At 200 Mbit/s", "CPU", "s per GB", "down_200", "tunnel_cpu_per_gb", 1], ["At 200 Mbit/s", "Memory", "MB", "down_200", "tunnel_footprint_mb", 1],
    ["Idle", "Extra power", "mW", "idle", "phone_extra_w", 1e3], ["Idle", "Wakeups", "per s", "idle", "tunnel_wakeups_per_s", 1]]
};
const benchName = (a) => BENCH_NAMES[a] || a;
// measure keys over the ranking
const benchKey = ([g, l]) => l === "Average" ? "Speed" : g === "Speed" ? `Speed, ${l}` : g === "Idle" ? `Idle ${l.toLowerCase()}` : l;
const Bench = {
  exp: "L",
  sort: 0,   // measure to rank by, best first
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
    $("#bn-exp").innerHTML = Object.entries(BENCH_SETUPS).map(([id, [t]]) => `<button type="button" role="radio" data-v="${id}">${esc(t)}, ${Object.keys(this.data.experiments.find((e) => e.id === id).versions).length} apps</button>`).join("");
    $("#bn-exp").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { this.exp = b.dataset.v; this.sort = 0; this.render(); } });
    const body = $("#bn-body");
    body.addEventListener("click", (e) => {
      const b = e.target.closest(".meas button");
      if (b) { this.sort = +b.dataset.i; this.ranked(); return; }
      const p = e.target.closest(".pt");
      if (p) this.pick(p.dataset.app);
    });
    // the chart readout follows the pointer over dots and ranking rows, and keyboard focus
    const follow = (e) => { const t = e.target.closest("[data-app]"); if (t && t.dataset.app !== this.cur) this.pick(t.dataset.app); };
    body.addEventListener("mouseover", follow);
    body.addEventListener("focusin", follow);
    addEventListener("resize", () => { const c = $("#bn-chart"); if (c && !$("#bench").hidden && c.clientWidth !== this.cw) this.chart(); });
    this.render();
  },
  stats(ca, me) { return (this.x.metrics.find((m) => m.case === ca && m.metric === me) || {}).stats || {}; },
  ver(a) { return this.x.versions[a].replace(/\s*\(.*\)$/, ""); },
  meta(a) {
    const i = (this.x.apps || {})[a] || {};
    return `<span>${esc(this.ver(a))}</span>${i.mtu ? `<span class="${i.mtu <= 1500 ? "m-low" : ""}" title="Tunnel packet size (MTU)">MTU ${i.mtu}</span>` : ""}${i.iphone ? `<span title="Also available on iPhone">iPhone</span>` : ""}`;
  },
  // "best" = best or tied with the best (ranges overlap), "worst" = worst median
  flag([, , , ca, me, , hi], a) {
    const s = this.stats(ca, me), v = s[a];
    if (!v) return "";
    const beats = hi ? (d) => s[d].min > v.max : (d) => s[d].max < v.min;
    if (!Object.keys(s).some((d) => d !== a && beats(d))) return "best";
    const meds = Object.values(s).map((y) => y.median);
    return Object.keys(s).length > 2 && v.median === (hi ? Math.min(...meds) : Math.max(...meds)) ? "worst" : "";
  },
  render() {
    $("#bn-exp").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.v === this.exp));
    const x = this.x = this.data.experiments.find((e) => e.id === this.exp), I = this.exp === "I";
    const date = (s) => { const m = s.match(/^\d{4}(\d\d)(\d\d)/); return m ? `${+m[2]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m[1] - 1]}` : s; };
    const score = this.stats("lab", "score"), byScore = Object.keys(x.versions).sort((p, q) => (score[q] || { median: -1 }).median - (score[p] || { median: -1 }).median);
    this.cur = byScore[0];
    const appCards = I ? "" : BENCH_CORES.map(([core, what, list]) => {
      const rows = byScore.filter((c) => list[c]).map((c) => {
        const [detail, lic, stack] = list[c];
        return `<li><b>${esc(benchName(c))}</b> <span class="v">${esc(this.ver(c))}</span>${detail ? `<span>${esc(detail)}</span>` : ""}
          ${stack ? `<span>IP stack: ${esc(stack)}</span>` : ""}${lic ? `<span class="lic">${esc(lic)}</span>` : ""}</li>`;
      }).join("");
      return rows ? `<div class="core"><h4>${esc(core)} <span>${esc(what)}</span></h4><ul>${rows}</ul></div>` : "";
    }).join("");
    const powerNote = I ? "Power is the whole phone's, minus the same test without a VPN." : "Energy and CPU are macOS's own figures for the app's tunnel process.";

    $("#bn-body").innerHTML = `
      <div class="bn-block"><p class="bn-setup">${esc(BENCH_SETUPS[this.exp][1])}</p>
        <dl class="bn-meta">
          <div><dt>Device</dt><dd>${esc(BENCH_MACS[x.device || x.mac] || x.device || x.mac)}</dd></div>
          <div><dt>Power</dt><dd>${x.device ? "USB cable" : "Battery"}</dd></div>
          <div><dt>${x.sessions.length > 1 ? "Runs" : "Run"}</dt><dd>${esc([...new Set(x.sessions.map(date))].join(", "))} 2026</dd></div>
          <div><dt>Rounds</dt><dd>${x.rounds}</dd></div>
          <div><dt>Apps</dt><dd>${byScore.length}</dd></div></dl></div>
      <div class="bn-duo">
        <section class="screen bn-rank-screen" aria-labelledby="bn-rank-h"><div class="screen-head"><h3 id="bn-rank-h">Ranking</h3></div>
          <div class="meas" role="radiogroup" aria-label="Rank by"></div><p class="screen-note" id="bn-rank-note"></p>
          <ol class="ranked" id="bn-rank"></ol></section>
        <section class="screen bn-chart-screen" aria-labelledby="bn-chart-h"><div class="screen-head"><h3 id="bn-chart-h">Speed against efficiency</h3></div>
          <div id="bn-chart"></div><p class="bn-readout" id="bn-readout" aria-live="polite"></p>
          <p class="note">Top right is best. Dashed lines connect equal scores. Hover or tap a dot to read its numbers.</p></section>
      </div>
      <p class="note">Values are medians over all rounds; hover one for its range. Tap an app in the ranking for all its numbers.
        <span class="key best">Green</span> = best or tied with the best (ranges overlap). ${powerNote}</p>
      <div class="bn-callouts">${[BENCH_CHAIN_NOTE, BENCH_MTU_NOTE].map(([h, t]) => `<p class="bn-callout"><b>${esc(h)}</b> ${esc(t)}</p>`).join("")}</div>
      <div class="bn-block"><h3>How we tested</h3>${(I ? BENCH_IPHONE_METHOD : BENCH_LAB_METHOD).map((t) => `<p class="note">${esc(t)}</p>`).join("")}</div>
      ${appCards ? `<div class="bn-block"><h3>What's inside each app</h3>
        <p>Grouped by the core that carries the traffic, as found in each installed Mac app. Licenses are from each project's public
          repository; none shown means closed source or unknown.</p>
        <div class="cores">${appCards}</div></div>` : ""}
      <p class="note bn-foot">Independent, non-commercial testing on one Mac and one iPhone, October 2026. Results depend on the device, the OS and
        the app version; a real network adds its own costs.</p>`;
    this.ranked();
    this.chart();
  },
  // the ranking, best first by the chosen measure
  ranked() {
    const cols = BENCH_COLS[this.exp], si = this.sort, col = cols[si], [, , unit, ca0, me0, sc0, hi0] = col;
    const s = this.stats(ca0, me0);
    const m0 = (a) => (s[a] || { median: hi0 ? -Infinity : Infinity }).median;
    const apps = Object.keys(this.x.versions).sort((p, q) => hi0 ? m0(q) - m0(p) : m0(p) - m0(q));
    // bar length: the value as a share of the largest one, so a lower value always draws a shorter bar
    const top = Math.max(...Object.values(s).map((y) => y.max));
    const frac = (v) => v / top, pct = (f) => (100 * f).toFixed(2);
    const range = (c, a) => { const [, , u, ca, me, sc] = c, v = this.stats(ca, me)[a];
      return v && v.n > 1 ? `median ${fmtNum(v.median * sc)}, range ${fmtNum(v.min * sc)}–${fmtNum(v.max * sc)} ${u} over ${v.n} rounds` : ""; };

    $(".meas").innerHTML = cols.map((c, j) => `<button type="button" role="radio" aria-checked="${j === si}" data-i="${j}">${esc(benchKey(c))}</button>`).join("");
    $("#bn-rank-note").textContent = `${unit[0].toUpperCase() + unit.slice(1)}, ${hi0 ? "higher" : "lower"} is better. `
      + "Bar length is the value; the thin bracket is the range over rounds.";
    const ol = $("#bn-rank");
    ol.classList.remove("drawn");
    ol.innerHTML = apps.map((a, i) => {
      const v = s[a], f = v && this.flag(col, a);
      const bar = v ? `<i class="fill" style="--w:${frac(v.median).toFixed(4)}"></i>${v.n > 1 ? `<i class="rng" style="left:${pct(Math.min(frac(v.min), frac(v.max)))}%;width:${pct(Math.abs(frac(v.max) - frac(v.min)))}%"></i>` : ""}` : "";
      const all = cols.map((c) => { const [, , u, ca, me, sc] = c, w = this.stats(ca, me)[a];
        return `<div class="${this.flag(c, a)}"><dt>${esc(benchKey(c))} <span>${esc(u)}</span></dt><dd title="${esc(range(c, a))}">${w ? fmtNum(w.median * sc) : "–"}</dd></div>`; }).join("");
      return `<li style="--i:${i}"><details class="rr" data-app="${a}"><summary>
        <span class="rr-n">${i + 1}</span><span class="rr-name"><b>${esc(benchName(a))}</b><span class="rr-meta">${this.meta(a)}</span></span>
        <span class="rr-v ${f || ""}" title="${esc(range(col, a))}">${v ? fmtNum(v.median * sc0) : "–"}</span>
        <span class="rr-bar" aria-hidden="true">${bar}</span></summary>
        <dl class="rr-all">${all}</dl></details></li>`;
    }).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => ol.classList.add("drawn")));
  },
  // the scatter, redrawn at the width of its screen so text stays readable on a phone
  chart() {
    const box = $("#bn-chart"), I = this.exp === "I";
    const med = (st) => Object.fromEntries(Object.entries(st).map(([a, v]) => [a, v.median]));
    this.sp = med(this.stats("speed", "gbps_avg"));
    this.en = med(this.stats("down_200", I ? "phone_energy_per_gb" : "tunnel_energy_per_gb"));
    this.cw = box.clientWidth;
    box.innerHTML = benchScatter(this.sp, this.en, benchName, Math.max(300, this.cw), ...(I ? [[0.1, 10], [3, 100], "Extra phone energy at 200 Mbit/s"] : []));
    this.pick(this.cur);
  },
  // the readout under the chart: one app's numbers, its dot ringed
  pick(a) {
    if (this.sp[a] == null || this.en[a] == null) return;
    this.cur = a;
    document.querySelectorAll("#bn-chart .pt, #bn-rank .rr").forEach((p) => p.classList.toggle("on", p.dataset.app === a));
    const sc = this.stats("lab", "score")[a];
    $("#bn-readout").innerHTML = `<b>${esc(benchName(a))}</b><span>${fmtNum(this.sp[a])} Gbit/s average</span><span>${fmtNum(this.en[a])} J per GB</span>${sc ? `<span>score ${fmtNum(sc.median)}</span>` : ""}`;
  }
};
// lab chart: speed (up) against energy per GB (right = less), both log scales. The score's equal-score lines are straight here.
function benchScatter(sp, en, name, W, [s0, s1] = [0.2, 30], [e0, e1] = [0.2, 30], xLabel = "Energy at 200 Mbit/s") {
  const H = Math.round(W * (W < 420 ? 1.08 : W < 640 ? 0.85 : W < 900 ? 0.62 : 0.4)), L = 46, R = 12, T = 12, B = 44;
  const apps = Object.keys(sp).filter((a) => en[a]);
  const lg = Math.log10, X = (e) => L + (lg(e1) - lg(e)) / (lg(e1) - lg(e0)) * (W - L - R), Y = (s) => T + (lg(s1) - lg(s)) / (lg(s1) - lg(s0)) * (H - T - B);
  const spMax = Math.max(...apps.map((a) => sp[a])), enMin = Math.min(...apps.map((a) => en[a]));
  const score = (a) => 100 * (sp[a] / spMax) ** 0.3 * (enMin / en[a]) ** 0.7;
  const tk = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100], ex = tk.filter((v) => v >= e0 && v < e1), sx = tk.filter((v) => v >= s0 && v < s1);
  let g = ex.map((v) => `<line class="gr" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}"/><text class="ax" x="${X(v)}" y="${H - B + 16}" text-anchor="middle">${v}</text>`).join("")
    + sx.map((v) => `<line class="gr" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 7}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join("");
  // equal-score lines: speed = spMax * (S/100 / (enMin/e)^0.7)^(1/0.3)
  [10, 25, 50, 75].forEach((S) => {
    const s = (e) => spMax * ((S / 100) / (enMin / e) ** 0.7) ** (1 / 0.3), pts = [];
    for (let k = 0; k <= 60; k++) { const e = 10 ** (lg(e0) + k / 60 * (lg(e1) - lg(e0))), v = s(e); if (v >= s0 && v <= s1) pts.push([X(e), Y(v)]); }
    if (pts.length < 2) return;
    const [top, low] = pts[0][1] < pts[pts.length - 1][1] ? [pts[0], pts[pts.length - 1]] : [pts[pts.length - 1], pts[0]];
    // label at the top end, or at the lower end when the top end is against the speed axis
    const t = top[0] - 4 > L + 50 ? `x="${top[0] - 4}" y="${top[1] + 12}" text-anchor="end"` : `x="${low[0] + 4}" y="${low[1] - 4}" text-anchor="start"`;
    g += `<polyline class="iso" points="${pts.map((q) => q.join(",")).join(" ")}"/><text class="iso-t" ${t}>score ${S}</text>`;
  });
  // labels: best score first; try right, left, above, below, then the corners; skip if nothing fits (the readout and ranking still name it)
  const boxes = apps.map((a) => [X(en[a]) - 7, Y(sp[a]) - 7, 14, 14]);
  const hit = (b) => b[0] < L || b[0] + b[2] > W - R || b[1] < T || b[1] + b[3] > H - B
    || boxes.some((c) => b[0] < c[0] + c[2] && c[0] < b[0] + b[2] && b[1] < c[1] + c[3] && c[1] < b[1] + b[3]);
  let dots = "", labels = "";
  apps.sort((p, q) => score(q) - score(p)).forEach((a) => {
    const cx = X(en[a]), cy = Y(sp[a]), w = name(a).length * 6.6 + 2;
    dots += `<g class="pt" data-app="${esc(a)}"><circle class="hit" cx="${cx}" cy="${cy}" r="12"/><circle class="ring" cx="${cx}" cy="${cy}" r="11"/><circle class="dot" cx="${cx}" cy="${cy}" r="5"/></g>`;
    const at = [[cx + 9, cy - 7, "start"], [cx - 9 - w, cy - 7, "end"], [cx - w / 2, cy - 22, "middle"], [cx - w / 2, cy + 8, "middle"],
      [cx + 7, cy - 19, "start"], [cx + 7, cy + 5, "start"], [cx - 7 - w, cy - 19, "end"], [cx - 7 - w, cy + 5, "end"],
      // farther out, joined to the dot by a short line
      ...[22, 34].flatMap((d) => [[cx + 7, cy - 7 - d, "start"], [cx + 7, cy - 7 + d, "start"], [cx - 7 - w, cy - 7 - d, "end"], [cx - 7 - w, cy - 7 + d, "end"]])]
      .map(([bx, by, an]) => [[bx, by, w, 14], an]).find(([b]) => !hit(b));
    if (!at) return;
    const [[bx, by], an] = at; boxes.push(at[0]);
    if (Math.abs(by + 7 - cy) > 15) labels += `<line class="gr lead" x1="${cx}" y1="${cy + (by > cy ? 5 : -5)}" x2="${an === "start" ? bx : bx + w}" y2="${by + (by > cy ? 2 : 12)}"/>`;
    labels += `<text class="lbl" x="${an === "start" ? bx : an === "end" ? bx + w : bx + w / 2}" y="${by + 11}" text-anchor="${an}">${esc(name(a))}</text>`;
  });
  return `<svg class="bn-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average speed against energy per GB for each app; the ranking has every value.">
    ${g}<text class="ax-t" x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(xLabel)}, J per GB${W < 560 ? "" : " (log), less is better"}</text>
    <text class="ax-t" transform="translate(13 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Average speed, Gbit/s${W < 560 ? "" : " (log), faster is up"}</text>
    ${labels}${dots}</svg>`;
}
function fmtNum(v) { const a = Math.abs(v); return a >= 100 ? Math.round(v).toLocaleString("en") : a >= 10 ? +v.toFixed(1) + "" : a >= 1 ? +v.toFixed(2) + "" : +v.toFixed(3) + ""; }

showTab(location.hash.slice(1) || "bench");
