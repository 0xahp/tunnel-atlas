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
   Reads bench/experiments.json. Speed, efficiency (Stage 1 lab) and chain + rules, never pooled. */
const BENCH_NAMES = { anywhere: "Anywhere", sfm: "SFM", happ: "Happ", v2box: "V2Box", shadowrocket: "Shadowrocket", egern: "Egern", karing: "Karing", rabbithole: "Rabbit Hole",
  throne: "Throne", surge: "Surge", flclash: "FlClash", verge: "Clash Verge Rev", koala: "Koala Clash", clash: "Clash (Hako)", onexray: "OneXray",
  streisand: "Streisand", incy: "incy", clashplus: "Clash Plus", cli: "sing-box CLI", hiddify: "Hiddify" };
// core read from the Go modules inside each installed Mac app (20 Oct); license from the project's GitHub page; blank = not sure
const BENCH_CORES = [
  ["sing-box", "Go; the SagerNet core", { sfm: ["libbox (gomobile)", "GPL-3.0"], cli: ["the core itself", "GPL-3.0 + name clause"],
    karing: ["LibVpnCore", "GPL-3.0 + name clause", "mixed (as tested)"] }],
  ["sing-box and Xray", "both cores built in", { throne: ["ThroneCore, a separate process", "GPL-3.0"], streisand: ["sing-box 1.14 + Xray"] }],
  ["mihomo", "Go; the Clash Meta core", { flclash: ["", "GPL-3.0"], verge: ["", "GPL-3.0"], koala: ["", "GPL-3.0"], clash: ["mihomo 1.19.32"],
    rabbithole: [""], clashplus: [""] }],
  ["Xray", "Go; the XTLS core", { onexray: ["libXray", "GPL-3.0"], happ: ["libXray"], v2box: [""], incy: [""] }],
  ["Own core", "no sing-box, Xray or mihomo inside", { anywhere: ["Swift", "GPL-3.0", "AnywhereIP (own, Swift)"], surge: [""], shadowrocket: [""],
    egern: ["", "", "own user-space stack (vendor's note, 2.15)"] }]];
const BENCH_MACS = { "MacBookAir10,1": "MacBook Air M1", "iPhone12,3": "iPhone 11 Pro" };
// keep in sync with make-static.py and proxy-bench/results/RESULTS.md
const BENCH_IPHONE_NOTE = "iPhone check (16 Oct): on an iPhone 11 Pro (iOS 27, same chain + rules, 2 rounds, whole-phone power from the battery gauge over USB), "
  + "Anywhere 2.4 and Egern tied: 0.93 W vs 0.93–0.95 W at a steady 50 Mbit/s download (about 148–152 J per GB for the whole phone), "
  + "the same single-connection speed (70–75 Mbit/s) and page first-byte times within run-to-run noise. Idle draw was within noise of no VPN for both. "
  + "The Mac's ~4× gap in app energy per GB is in the app's own small share of power and doesn't show at the whole-device level.";
// keep in sync with make-static.py
const BENCH_LAB_METHOD = "One MacBook Air M1 (macOS 27.0.1), on battery, screen off, no app windows open. Each app ran in its TUN (whole-system VPN) mode "
  + "with the same Shadowsocks 2022 profile (2022-blake3-aes-128-gcm), pointed at a sing-box server on the same Mac; iperf3 3.22 sent traffic through the "
  + "app's tunnel to that server and back. No internet and no remote server are involved, so the numbers show each app's own overhead. A script switched "
  + "the apps on and off one at a time, in two rounds (the second in reverse order); each number is the median of the two. Speed: 5 s per test after a "
  + "2 s warm-up, over one and over four parallel connections. Efficiency: a steady 200 Mbit/s download for 20 s; energy is macOS's own estimate for "
  + "the app's tunnel process, CPU is that process's CPU time, both per GB moved, and memory is its footprint at the end of the test. Every test checked "
  + "that its bytes went through the app's tunnel; a test with any keyboard or trackpad input was thrown out and repeated. MTU is the tunnel's packet "
  + "size as macOS reported it: we asked for 4000 where we could; apps that stay at 1500 handle about 2.7× more packets per GB "
  + "(Happ's MTU setting has no effect on the Mac tunnel). Karing used its mixed stack; its four-connection download is from one round. Versions as "
  + "installed on 20 Oct 2026. The sing-box command line (no app, no GUI) is ranked with the apps: it shows what the core alone costs. "
  + "Score (out of 100) = 30% speed + 70% efficiency, each as a ratio to the best app: 100 × (average speed ÷ best average speed)^0.3 × "
  + "(best energy per GB ÷ energy per GB)^0.7. Efficiency weighs more because every app near the top is already far faster than any real internet "
  + "connection. Click a column header to sort by that column instead.";
// keep in sync with make-static.py
const BENCH_IPHONE_METHOD = "One iPhone 11 Pro (iOS 27.0.1), on the USB cable at full charge, run overnight by an automated test with nobody touching it. A small test app on the iPhone runs its own Shadowsocks 2022 server (2022-blake3-aes-128-gcm), and every VPN app's profile points at it, so the traffic goes app → VPN tunnel → server on the same phone, with no Wi-Fi or internet in the way. Speed: upload and download over 1 and 4 connections, 2 s warm-up then 5 s measured, median of 3 tries. At 200 Mbit/s: one download held at 200 Mbit/s for 120 s (first 15 s skipped). Power is the whole phone's, from its battery gauge; \"extra\" subtracts the same test with no VPN (0.68 W, median of 4 no-VPN runs spread over the night). Energy per GB = extra power ÷ the speed actually held: Happ held only 130 Mbit/s and V2Box 180. CPU and memory are the VPN app's own tunnel process, from the phone's process monitor. Idle: 10 min with the screen locked (first 60 s skipped). Idle extra power is mostly within noise (about ±0.07 W around the no-VPN 0.65 W); wakeups are how often the tunnel woke the processor, which adds up over a day. Score (out of 100), the same formula as the Mac lab: 100 × (average speed ÷ best average speed)^0.3 × (best extra energy per GB ÷ extra energy per GB)^0.7. 3 rounds, apps in a different order each round; one Hiddify round failed partway, so its speed and 200 Mbit/s numbers are from 2 rounds. Versions as installed on 21 Oct 2026. Click a column header to sort by that column instead.";
const BENCH_SETUPS = {
  L: ["Lab: speed + efficiency", "A lab test on the Mac itself, with no internet in the way: how fast each app can move data, and how much energy, CPU time and memory its tunnel needs for a steady 200 Mbit/s download. Ranked by a score of 30% speed and 70% efficiency; click any column header to sort by it."],
  I: ["Lab: on iPhone", "The same lab on an iPhone: a test server runs on the phone itself, so only the VPN app is in the way. How fast each app can move data, and how much extra power, CPU time and memory the phone needs for a steady 200 Mbit/s download, plus what the tunnel costs at idle. Ranked by a score of 30% speed and 70% efficiency. Click any column header to sort by it."],
  A: ["Chain + rules", "The everyday setup: the app chains two proxies, and rules decide which sites use the tunnel, which go straight out and which ads are blocked."]
};
// table columns per setup: [group, label, unit, case, metric, scale, higher is better, case also shown in the tooltip]
const IDLE_COLS = (c) => [["Idle", "Wakeups", "per s", c, "tunnel_wakeups_per_s", 1], ["Idle", "Avg power", "µW", c, "tunnel_power_w", 1e6]];
const LOAD_COLS = (g, c) => [[g, "Power", "mW", c, "tunnel_power_w", 1e3], [g, "Energy", "J per GB", c, "tunnel_energy_per_gb", 1], [g, "CPU", "%", c, "tunnel_cpu_pct", 1]];
const BENCH_COLS = {
  A: [...IDLE_COLS("idle"), ...LOAD_COLS("At 100 Mbit/s", "dl_100m"), ["Full speed", "Speed", "Mbit/s", "dl_max", "mbps", 1, true], ["Web pages", "First byte", "ms", "req50", "first_byte_ms", 1]],
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
const Bench = {
  exp: "L",
  sort: { i: 0, rev: false },   // lab table: column to sort by (best first), rev = worst first
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
    $("#bn-exp").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { this.exp = b.dataset.v; this.sort = { i: 0, rev: false }; this.render(); } });
    $("#bn-body").addEventListener("click", (e) => { const b = e.target.closest(".bn-sort"); if (!b) return;
      const i = +b.dataset.i; this.sort = { i, rev: this.sort.i === i ? !this.sort.rev : false }; this.render(); });
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
    const rk = !lb && !!x.apps;   // lab table: rank badge, one-line version · MTU · iPhone note, sortable headers
    // rows: leaderboard order, or best first by the sort column (the first one unless a header was clicked)
    const si = rk ? this.sort.i : 0, rev = rk && this.sort.rev;
    const [, , , ca0, me0, , hi0] = cols[si];
    const m0 = (a) => (stats(ca0, me0)[a] || { median: hi0 ? -Infinity : Infinity }).median;
    const apps = lb ? Object.keys(lb) : Object.keys(x.versions).sort((p, q) => (hi0 ? m0(q) - m0(p) : m0(p) - m0(q)) * (rev ? -1 : 1));
    const meta = (a) => { const i = (x.apps || {})[a] || {};
      return `${i.mtu ? ` · <span class="${i.mtu <= 1500 ? "m-low" : ""}" title="Tunnel packet size (MTU)">MTU ${i.mtu}</span>` : ""}${i.iphone ? ` · <span title="Also available on iPhone">iPhone</span>` : ""}`; };

    const cell = ([, , , ca, me, sc, hi, also], a) => {
      const s = stats(ca, me), v = s[a];
      if (!v) return `<td class="num na" title="No result">–</td>`;
      const beats = hi ? (d) => s[d].min > v.max : (d) => s[d].max < v.min;
      const best = !Object.keys(s).some((d) => d !== a && beats(d));
      const meds = Object.values(s).map((y) => y.median);
      const worst = Object.keys(s).length > 2 && v.median === (hi ? Math.min(...meds) : Math.max(...meds));
      const up = also && stats(also, me)[a];
      const tip = `${name(a)}: median ${fmtNum(v.median * sc)}${v.n > 1 ? `, range ${fmtNum(v.min * sc)}–${fmtNum(v.max * sc)} over ${v.n} rounds` : ""}${up ? `; upload ${fmtNum(up.median * sc)}` : ""}`;
      return `<td class="num${best ? " best" : worst ? " worst" : ""}" title="${esc(tip)}">${me === "score" ? `<b>${fmtNum(v.median * sc)}</b>` : fmtNum(v.median * sc)}</td>`;
    };
    // later single-app runs: shown under the app's row, outside the stats and the colours
    const rechecks = x.rechecks || [];
    const recheckRows = (a) => rechecks.filter((r) => r.app === a).map((r) => `<tr>${lb ? "<td></td>" : ""}
        <td class="who"><b>${esc(name(a))}</b><span class="note">${esc(r.version.replace(/\s*\(.*\)$/, ""))} · ${esc(date(r.session))}*</span></td>${lb ? "<td></td>" : ""}
        ${cols.map(([, , , ca, me, sc]) => { const v = r.values[`${ca}.${me}`];
          return v == null ? `<td class="num na" title="Not measured">–</td>` : `<td class="num">${fmtNum(v * sc)}</td>`; }).join("")}</tr>`).join("");
    const groups = [];
    cols.forEach(([g]) => { const last = groups[groups.length - 1]; if (last && last[0] === g) last[1]++; else groups.push([g, 1]); });
    const lead = lb ? 3 : rk ? 2 : 1;
    const table = `<div class="table-wrap"><table class="bn-table${rk ? " bn-compact" : ""}">
      <thead><tr><th colspan="${lead}"></th>${groups.map(([g, n]) => `<th class="grp" colspan="${n}">${esc(g)}</th>`).join("")}</tr>
        <tr>${lb || rk ? `<th class="num">#</th>` : ""}<th class="who">App</th>${lb ? `<th class="num">Score</th>` : ""}${cols.map(([, l, u, , , , hi], j) => rk
          ? `<th class="num" aria-sort="${j === si ? ((hi !== rev) ? "descending" : "ascending") : "none"}"><button type="button" class="bn-sort${j === si ? " on" : ""}" data-i="${j}" title="Sort by ${esc(l)}">${esc(l)}<span>${esc(u)} ${hi ? "↑" : "↓"}</span></button></th>`
          : `<th class="num">${esc(l)}<span>${esc(u)} ${hi ? "↑" : "↓"}</span></th>`).join("")}</tr></thead>
      <tbody>${apps.map((a, i) => `<tr${lb && i === 0 ? ' class="lead"' : ""}>${lb ? `<td class="num">${i + 1}</td>` : rk ? `<td class="num"><span class="rk ${i === 0 ? "r1" : i === apps.length - 1 ? "rlast" : "rmid"}">${i + 1}</span></td>` : ""}
        <td class="who"><b>${esc(name(a))}</b><span class="note">${esc(ver(a))}${meta(a)}</span></td>
        ${lb ? `<td class="num" title="Tie-aware score ${lb[a].score_tie.toFixed(2)}"><b>${lb[a].score.toFixed(2)}</b></td>` : ""}
        ${cols.map((c) => cell(c, a)).join("")}</tr>${recheckRows(a)}`).join("")}</tbody></table></div>`;

    const cc = this.data.chain_cost && this.data.chain_cost["dl_100m.tunnel_energy_per_gb"];
    const chain = this.exp === "A" && cc ? `<div class="bn-block"><h3>What the chain costs</h3>
        <p>App energy per GB at 100 Mbit/s, basic setup against chain + rules. The two ran on different days.</p>
        <div class="table-wrap"><table><thead><tr><th>App</th><th class="num">Basic (J)</th><th class="num">Chain + rules (J)</th><th class="num">Factor</th></tr></thead><tbody>
        ${Object.entries(cc).map(([a, v]) => `<tr><td><b>${esc(name(a))}</b>${v.same_version ? "" : ` <span class="note">updated in between (2.3 → 2.4)</span>`}</td>
          <td class="num">${fmtNum(v.one_hop)}</td><td class="num">${fmtNum(v.chain)}</td><td class="num">${v.factor.toFixed(1)}×</td></tr>`).join("")}
        </tbody></table></div>
        <p>Anywhere 2.4 runs about 20–27% of its tunnel work on the Mac's performance cores (2.3 used none). It needs less CPU time per GB
          (24 s vs 39 s on the chain), but each CPU-second costs about 3× the energy. On the chain, 2.3 measured 2.2 J/GB in a one-round check,
          so most of its jump comes from the update.</p></div>` : "";

    const appCards = BENCH_CORES.map(([core, what, list]) => {
      const rows = apps.filter((c) => list[c]).map((c) => {
        const [detail, lic, stack] = list[c];
        return `<li><b>${esc(name(c))}</b> <span class="v">${esc(ver(c))}</span>${detail ? `<span>${esc(detail)}</span>` : ""}
          ${stack ? `<span>IP stack: ${esc(stack)}</span>` : ""}${lic ? `<span class="lic">${esc(lic)}</span>` : ""}</li>`;
      }).join("");
      return rows ? `<div class="core"><h4>${esc(core)} <span>${esc(what)}</span></h4><ul>${rows}</ul></div>` : "";
    }).join("");

    $("#bn-body").innerHTML = `
      <div class="bn-block"><p class="bn-setup">${esc(BENCH_SETUPS[this.exp][1])}</p>
        <div class="bn-meta">${x.device ? `<span><b>${esc(BENCH_MACS[x.device] || x.device)}</b>, on the USB cable</span>` : `<span>Mac <b>${esc(BENCH_MACS[x.mac] || x.mac)}</b>, on battery</span>`}
          <span>${x.sessions.length > 1 ? "Runs" : "Run"} <b>${esc([...new Set(x.sessions.map(date))].join(", "))} 2026</b></span>
          <span>Rounds <b>${x.rounds}</b></span><span>Apps <b>${apps.length}</b></span></div></div>
      ${this.exp === "L" || this.exp === "I" ? `<div class="bn-block"><h3>Speed against efficiency</h3>
        ${benchScatter(Object.fromEntries(Object.entries(stats("speed", "gbps_avg")).map(([a, v]) => [a, v.median])),
          Object.fromEntries(Object.entries(stats("down_200", this.exp === "I" ? "phone_energy_per_gb" : "tunnel_energy_per_gb")).map(([a, v]) => [a, v.median])), name,
          ...(this.exp === "I" ? [[0.1, 10], [3, 100], "Extra phone energy at 200 Mbit/s"] : []))}
        <p class="note">Top right is best: fast and light on the battery. The gray lines join points with the same score, so an app's place in the
          ranking is how far up-right of them it sits. Hover a dot for its numbers.</p></div>` : ""}
      <div class="bn-block"><h3>${lb ? "Leaderboard and every measure" : "Every measure"}</h3>
        ${table}
        <p>Each number is the app's median over all rounds; hover it for the range. ↓ lower is better, ↑ higher is better.
          <span class="key best">Green</span> = best, or tied with the best (their ranges overlap). <span class="key worst">Red</span> = worst.
          ${lb ? "Score = 35% efficiency under traffic + 35% efficiency at idle + 30% performance; each part is the app's average place, so lower is better." : ""}
          ${this.exp === "I" ? "Power is the whole phone's, from its battery gauge." : "App power and energy are macOS's own per-process estimates for the tunnel process."}${x.note ? ` ${esc(x.note)}` : ""}</p>
        ${rechecks.map((r) => `<p class="note">* ${esc(r.note)}</p>`).join("")}
        ${this.exp === "A" ? `<p class="bn-callout"><b>${esc(BENCH_IPHONE_NOTE.split(": ")[0])}</b>${esc(BENCH_IPHONE_NOTE.charAt(BENCH_IPHONE_NOTE.indexOf(": ") + 2).toUpperCase() + BENCH_IPHONE_NOTE.slice(BENCH_IPHONE_NOTE.indexOf(": ") + 3))}</p>` : ""}</div>
      ${this.exp === "L" || this.exp === "I" ? `<div class="bn-block"><h3>How we tested</h3><p class="note">${esc(this.exp === "I" ? BENCH_IPHONE_METHOD : BENCH_LAB_METHOD)}</p></div>` : ""}
      ${chain}
      ${appCards && this.exp !== "I" ? `<div class="bn-block"><h3>What's inside each app</h3>
        <p>Grouped by the core that moves the traffic, read from the code inside each installed Mac app. License from the project's
          public code page; no license shown means closed source or not sure. IP stack only where we know it.</p>
        <div class="cores">${appCards}</div></div>` : ""}
      <p class="note bn-foot">Footnote: this is not a professional lab test, just a personal, nerdy-interest one: one Mac on Wi-Fi, a few days,
        a handful of rounds. On a phone over cellular the results may differ.</p>`;
  }
};
// lab chart: speed (up) against energy per GB (right = less), both log scales. The score's equal-score lines are straight here.
function benchScatter(sp, en, name, [s0, s1] = [0.2, 30], [e0, e1] = [0.2, 30], xLabel = "Energy at 200 Mbit/s") {
  const apps = Object.keys(sp).filter((a) => en[a]), W = 680, H = 400, L = 52, R = 16, T = 14, B = 46;
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
  // labels: best score first; try right, left, above, below, then the corners; skip if nothing fits (the tooltip and table still name it)
  const boxes = apps.map((a) => [X(en[a]) - 7, Y(sp[a]) - 7, 14, 14]);
  const hit = (b) => b[0] < L || b[0] + b[2] > W - R || b[1] < T || b[1] + b[3] > H - B
    || boxes.some((c) => b[0] < c[0] + c[2] && c[0] < b[0] + b[2] && b[1] < c[1] + c[3] && c[1] < b[1] + b[3]);
  let dots = "", labels = "";
  apps.sort((p, q) => score(q) - score(p)).forEach((a) => {
    const cx = X(en[a]), cy = Y(sp[a]), w = name(a).length * 6.4 + 2, tip = `${name(a)}: ${fmtNum(sp[a])} Gbit/s average, ${fmtNum(en[a])} J per GB, score ${fmtNum(score(a))}`;
    dots += `<g class="pt"><title>${esc(tip)}</title><circle class="hit" cx="${cx}" cy="${cy}" r="12"/><circle class="dot" cx="${cx}" cy="${cy}" r="5"/></g>`;
    const at = [[cx + 9, cy - 7, "start"], [cx - 9 - w, cy - 7, "end"], [cx - w / 2, cy - 22, "middle"], [cx - w / 2, cy + 8, "middle"],
      [cx + 7, cy - 19, "start"], [cx + 7, cy + 5, "start"], [cx - 7 - w, cy - 19, "end"], [cx - 7 - w, cy + 5, "end"]]
      .map(([bx, by, an]) => [[bx, by, w, 14], an]).find(([b]) => !hit(b));
    if (!at) return;
    const [[bx, by], an] = at; boxes.push(at[0]);
    labels += `<text class="lbl" x="${an === "start" ? bx : an === "end" ? bx + w : bx + w / 2}" y="${by + 11}" text-anchor="${an}">${esc(name(a))}</text>`;
  });
  return `<div class="bn-chart-wrap"><svg class="bn-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average speed against energy per GB for each app; the table below has every value.">
    ${g}<text class="ax-t" x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(xLabel)}, J per GB (log) · less →</text>
    <text class="ax-t" transform="translate(13 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Average speed, Gbit/s (log) · faster ↑</text>
    ${dots}${labels}</svg></div>`;
}
function fmtNum(v) { const a = Math.abs(v); return a >= 100 ? Math.round(v).toLocaleString("en") : a >= 10 ? +v.toFixed(1) + "" : a >= 1 ? +v.toFixed(2) + "" : +v.toFixed(3) + ""; }

showTab(location.hash.slice(1) || "bench");
