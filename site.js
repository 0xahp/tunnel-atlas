/* Tunnel Atlas: the Benchmark and Routes posts. The prose and figures are in the HTML (make-static.py); this switches between the choices in a figure
   and draws the chart. Each figure holds one choice at most, and that choice lives in the URL (?lab=iphone, ?view=chain, ?censor=2). */

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
const params = new URLSearchParams(location.search);
const setParam = (k, v, dflt) => { const u = new URL(location); if (v === dflt) u.searchParams.delete(k); else u.searchParams.set(k, v); history.replaceState(null, "", u); };
// only the pressed state and the visible choice change on a click, so focus stays on the button
const showPick = (box, cur) => {
  box.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === cur));
  box.querySelectorAll("[data-pick]").forEach((p) => p.classList.toggle("on", p.dataset.pick === cur));
};
const onPill = (box, fn) => $(".seg", box).addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) fn(b.dataset.v); });

/* ==================== Routes: one figure per situation ==================== */
const Routes = {
  init() {
    document.querySelectorAll(".m-path").forEach((box) => {
      const goal = box.dataset.goal, last = box.querySelectorAll("[data-pick]").length - 1;
      showPick(box, String(Math.min(+params.get(goal) || 0, last)));
      onPill(box, (v) => { setParam(goal, v, "0"); showPick(box, v); });
    });
  }
};

/* ==================== Benchmark ====================
   Reads bench/experiments.json. The Mac and iPhone labs, never pooled. */
const BENCH_NAMES = { anywhere: "Anywhere", sfm: "SFM", happ: "Happ", v2box: "V2Box", shadowrocket: "Shadowrocket", egern: "Egern", karing: "Karing", rabbithole: "Rabbit Hole",
  throne: "Throne", surge: "Surge", flclash: "FlClash", verge: "Clash Verge Rev", koala: "Koala Clash", clash: "Clash (Hako)", onexray: "OneXray",
  streisand: "Streisand", incy: "incy", clashplus: "Clash Plus", cli: "sing-box CLI", hiddify: "Hiddify", v2rayn: "v2rayN",
  susi: "susi connect", tunna: "Tunna", hyperorbit: "HyperOrbit", singbox: "sing-box (SFI)" };
// where the developers are based (22 Oct 2026: company records, store listings, commit time zones); left out = unknown
const BENCH_FLAGS = { cli: "CN", sfm: "CN", singbox: "CN", flclash: "CN", verge: "CN", v2rayn: "CN", karing: "CN", onexray: "CN", surge: "CN",
  shadowrocket: "CN", throne: "IR", hiddify: "IR", koala: "RU", happ: "RU", incy: "RU", anywhere: "JP" };
const BENCH_COUNTRIES = { CN: "China", IR: "Iran", RU: "Russia", JP: "Japan" };
// core read from the Go modules inside each installed Mac app (20 Oct); license from the project's GitHub page; blank = not sure
const BENCH_CORES = [
  ["sing-box", "Go; the SagerNet core", { sfm: ["libbox (gomobile)", "GPL-3.0"], singbox: ["libbox (gomobile), iPhone app", "GPL-3.0"], cli: ["the core itself", "GPL-3.0 + name clause"],
    karing: ["LibVpnCore", "GPL-3.0 + name clause", "mixed (as tested)"], hiddify: ["hiddify-core (sing-box 1.13.0)", "", "mixed (as tested)"] }],
  ["sing-box and Xray", "both cores built in", { throne: ["ThroneCore, a separate process", "GPL-3.0"], streisand: ["sing-box 1.14 + Xray"],
    v2rayn: ["two processes in series: sing-box 1.14.3 TUN → Xray 26.10.10", "GPL-3.0", "mixed (as tested)"] }],
  ["mihomo", "Go; the Clash Meta core", { flclash: ["", "GPL-3.0"], verge: ["", "GPL-3.0"], koala: ["", "GPL-3.0"], clash: ["mihomo 1.19.32"],
    rabbithole: [""], clashplus: [""] }],
  ["Xray", "Go; the XTLS core", { onexray: ["libXray", "GPL-3.0"], happ: ["libXray"], v2box: [""], incy: [""], susi: [""], tunna: [""], hyperorbit: [""] }],
  ["Own core", "no sing-box, Xray or mihomo inside", { anywhere: ["Swift", "GPL-3.0", "AnywhereIP (own, Swift)"], surge: [""], shadowrocket: [""],
    egern: ["", "", "own user-space stack (vendor's note, 2.15)"] }]];
// app energy at 200 Mbit/s on the Mac: [app, setup, mW, lab test?, the same app's one-hop mW (chain rows only)]; mW = J per GB × 25.
// Real path: 14–15 Oct (at 100 Mbit/s) and Aestate 27 Oct; lab: 20 and 25 Oct. make-static.py reads this too
const BENCH_ENERGY = {
  one: ["One protocol", "times Egern", [["Egern", "Reality one hop", 7.6], ["Anywhere", "Reality one hop", 23.7], ["Shadowrocket", "Reality one hop", 33.7],
    ["Aestate", "Reality one hop", 47.4], ["WireGuard app 1.0.16", "WireGuard", 170, 1], ["V2Box", "Shadowsocks", 188, 1], ["Happ", "Shadowsocks", 365, 1]],
    ["Lab tests used other protocols, so they compare only roughly with the real-path results.",
      "Aestate was measured on 27 Oct at about 185 Mbit/s; Egern read 9 mW in that same run, so Aestate used about 5.4× Egern's energy on the day."]],
  chain: ["Chain + rules", "times the one hop", [["Egern", "Reality chain", 23.3, 0, 7.6], ["Egern", "Hysteria2 chain", 78, 1], ["Shadowrocket", "Reality chain", 100.4, 0, 33.7],
    ["Anywhere", "Reality chain", 103.6, 0, 23.7]],
    ["Chain: the outer protocol to a first server, Shadowsocks inside it to a second, plus everyday routing rules.",
      "Egern's Hysteria2 chain is from a lab test on 25 Oct; Hysteria2 alone was not measured, so it has no split. In that lab Egern's Reality chain read 15 mW, so a real path may read higher.",
      "Anywhere's chain was measured on version 2.4, its one hop on 2.3. Aestate has no domain routing, so it has no chain."]]
};
// make-static.py reads this for data.html and the app pages
const BENCH_ENERGY_INTRO = "The app's own energy, as macOS estimates it for the app's processes, at a 200 Mbit/s download (J per GB × 25). "
  + "Real path = through real servers over the internet; the 14–15 Oct runs were at 100 Mbit/s, assuming the same energy per GB. Lab = a test server on the same Mac.";
// make-static.py reads this for data.html and the app pages
const BENCH_MTU_NOTE =["MTU changes results a lot.", "At the common 1500, an app handles about 2.7× more packets per GB than at 4000. "
  + "In our checks, raising the MTU from 1500 to 4000 lifted SFM's upload from 10.8 to about 14.3 Gbit/s (1.3×), and Karing's speed from 0.9 to 2.4 Gbit/s "
  + "(2.5×, with its stack also changed) while its CPU time per GB fell by about a fifth. On the Mac, the seven apps at 1500 or below are all among the nine slowest. "
  + "We set 4000 wherever an app allows it."];
// make-static.py reads this for data.html and the app pages
const BENCH_LAB_METHOD = [
  "MacBook Air M1, macOS 27.0.1 (susi connect, HyperOrbit and Tunna: macOS 26.7.1), on battery, screen off, no app windows open. Every app ran in TUN mode with the same Shadowsocks 2022 profile "
  + "(2022-blake3-aes-128-gcm) to a sing-box server on the same Mac; iperf3 3.22 drove the traffic. A script ran the apps one at a time over two rounds, "
  + "the second in reverse order. Speed: 5 s after a 2 s warm-up, over 1 and 4 connections. Efficiency: a steady 200 Mbit/s download for 20 s, with the "
  + "energy, CPU time and memory of the app's tunnel process. Each test confirmed its traffic went through the tunnel; any test with keyboard or trackpad "
  + "input was repeated. The sing-box command line is included as a baseline for the core alone. Versions as installed on 20–22 Oct 2026.",
  "MTU is as macOS reported it (4000 requested where possible). Score = 100 × (speed ÷ best speed)^0.3 × (best energy per GB ÷ energy per GB)^0.7: efficiency weighs more because the top apps are already far faster "
  + "than any internet connection.",
  "Exceptions: Karing used its mixed stack. Happ ignores its MTU setting on the Mac. Hiddify 5.0.0 (a development build) ran as root with its fixed MTU of 9000. "
  + "v2rayN chains two cores (sing-box, then Xray). Karing's 4-connection download and v2rayN's 1-connection upload are from one round. Tunna closes any connection idle for 10 s, which cut the test's own control connection, so we raised that limit to 300 s for its test."];
// make-static.py reads this for data.html and the app pages
const BENCH_IPHONE_METHOD = [
  "iPhone 11 Pro, iOS 27.0.1, on the USB cable at full charge, run overnight by an automated test with nobody touching it. A test app on the phone runs "
  + "a Shadowsocks 2022 server (2022-blake3-aes-128-gcm) that every VPN app points at, so no Wi-Fi or internet is involved. Three rounds, apps in a "
  + "different order each round. Speed: 5 s after a 2 s warm-up, over 1 and 4 connections. Efficiency: one download held at 200 Mbit/s for 120 s. "
  + "Idle: 10 min with the screen locked. Versions as installed on 21 Oct 2026.",
  "Power is the whole phone's, from its battery gauge; \"extra\" subtracts the same test without a VPN (0.68 W under load, 0.65 W idle). "
  + "Energy per GB uses the speed actually held (Happ reached only 130 Mbit/s, V2Box 180). CPU and memory are the tunnel process's own. "
  + "Idle power differences are mostly within noise (±0.07 W); wakeups show how often the tunnel woke the processor. Same score formula as the Mac lab.",
  "Exception: one Hiddify round failed partway, so its speed and 200 Mbit/s figures are from two rounds.",
  "sing-box (SFI) 1.14.7 was added on 22 Oct from one round, against no-VPN steps in the same session (0.83 W under load, 0.78 W idle). An Egern round in that session matched its earlier figures: speed within 2%, the same CPU, wakeups and memory, 0.06 W extra. Its profile sends apple.com traffic direct, so iOS could check the test app while the VPN was on."];
const benchName = (a) => BENCH_NAMES[a] || a;
// the app's page: apps/<name in lower case, dashes>.html, written by make-static.py (same rule there)
const benchSlug = (a) => benchName(a).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const LABS = { L: ["Mac lab", "mac", "tunnel_energy_per_gb", "J per GB"], I: ["iPhone lab", "iphone", "phone_energy_per_gb", "extra J per GB"] };
const Bench = {
  lab: params.get("lab") === "iphone" ? "I" : "L",
  view: params.get("view") === "chain" ? "chain" : "one",
  async init() {
    const en = $("#m-energy"), rank = $("#m-rank"), box = $("#m-chart");
    showPick(en, this.view); showPick(rank, this.lab);
    onPill(en, (v) => { this.view = v; setParam("view", v, "one"); showPick(en, v); });
    onPill(rank, (v) => { this.lab = v; setParam("lab", LABS[v][1], "mac"); showPick(rank, v); if (this.data) this.render(); });
    try {
      const r = await fetch("bench/experiments.json");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.data = await r.json();
    } catch (e) {
      box.innerHTML = `<div class="empty"><p>The chart did not load (${esc(e.message)}). Reload the page, or read the results on the <a href="data.html">numbers page</a>.</p></div>`;
      return;
    }
    // the popup: tap or focus a dot, hover with a mouse; Esc or a tap elsewhere closes it
    box.addEventListener("click", (e) => { const p = e.target.closest(".pt"); if (p) { this.pop(p.dataset.app); e.stopPropagation(); } });
    box.addEventListener("focusin", (e) => { const p = e.target.closest(".pt"); if (p) this.pop(p.dataset.app); });
    box.addEventListener("focusout", () => this.pop(null));
    box.addEventListener("pointerover", (e) => { const p = e.target.closest(".pt"); if (p && e.pointerType === "mouse") this.pop(p.dataset.app); });
    box.addEventListener("pointerout", (e) => { if (e.target.closest(".pt") && e.pointerType === "mouse") this.pop(null); });
    // one tab stop for the whole chart; arrow keys walk the dots, best score first
    box.addEventListener("keydown", (e) => {
      const p = e.target.closest(".pt");
      if (!p) return;
      const pts = [...box.querySelectorAll(".pt")], i = pts.indexOf(p), j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: pts.length - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      const next = pts[(j + pts.length) % pts.length];
      p.setAttribute("tabindex", "-1"); next.setAttribute("tabindex", "0"); next.focus();
    });
    addEventListener("click", () => this.pop(null));
    addEventListener("keydown", (e) => { if (e.key === "Escape") this.pop(null); });
    addEventListener("resize", () => { if (box.clientWidth !== this.cw) this.chart(); });
    this.render();
  },
  stats(ca, me) { return (this.x.metrics.find((m) => m.case === ca && m.metric === me) || {}).stats || {}; },
  render() {
    const [title, , enKey, enUnit] = LABS[this.lab];
    this.x = this.data.experiments.find((e) => e.id === this.lab);
    const med = (st) => Object.fromEntries(Object.entries(st).map(([a, v]) => [a, v.median]));
    this.sc = med(this.stats("lab", "score")); this.sp = med(this.stats("speed", "gbps_avg")); this.en = med(this.stats("down_200", enKey)); this.enUnit = enUnit;
    $("#m-chart-title").textContent = `${title}: speed against energy`;
    this.chart();
  },
  chart() {
    const box = $("#m-chart");
    this.cw = box.clientWidth;
    box.innerHTML = benchScatter(this.sp, this.en, this.sc, benchName, Math.max(300, this.cw), ...(this.lab === "I" ? [[0.1, 10], [3, 100], "Extra phone energy"] : [undefined, undefined, undefined]), this.enUnit)
      + `<div class="bn-pop" id="bn-pop" aria-hidden="true" hidden></div>`;
    this.open = null;
  },
  pop(a) {
    this.open = a;
    const box = $("#m-chart"), p = $("#bn-pop");
    if (!p) return;
    box.querySelectorAll(".pt").forEach((g) => g.classList.toggle("on", g.dataset.app === a));
    const dot = a && box.querySelector(`.pt[data-app="${a}"] .dot`);
    if (!dot) { p.hidden = true; return; }
    p.innerHTML = `<b>${esc(benchName(a))}</b><span>Score ${Math.round(this.sc[a])}</span><span>${fmtNum(this.sp[a])} Gbit/s</span><span>${fmtNum(this.en[a])} ${esc(this.enUnit)}</span>`;
    p.hidden = false;
    // right of the dot if it fits, else left; kept inside the chart
    const b = box.getBoundingClientRect(), d = dot.getBoundingClientRect(), x = d.left - b.left + d.width / 2, y = d.top - b.top + d.height / 2;
    const pw = p.offsetWidth, ph = p.offsetHeight, left = x + 14 + pw <= b.width ? x + 14 : x - 14 - pw;
    p.style.left = Math.max(0, Math.min(left, b.width - pw)) + "px";
    p.style.top = Math.max(0, Math.min(y - ph / 2, b.height - ph)) + "px";
  }
};
// speed (up) against energy per GB (right = less), both log scales; a darker dot = a higher score
function benchScatter(sp, en, sc, name, W, [s0, s1] = [0.2, 30], [e0, e1] = [0.2, 30], xLabel = "Energy at 200 Mbit/s", unit = "J per GB") {
  const H = Math.round(W * (W < 420 ? 1.08 : W < 640 ? 0.85 : 0.5)), L = 46, R = 12, T = 12, B = 44;
  const apps = Object.keys(sp).filter((a) => en[a]);
  const lg = Math.log10, X = (e) => L + (lg(e1) - lg(e)) / (lg(e1) - lg(e0)) * (W - L - R), Y = (s) => T + (lg(s1) - lg(s)) / (lg(s1) - lg(s0)) * (H - T - B);
  const score = (a) => sc[a] || 0, band = (a) => score(a) >= 75 ? "b1" : score(a) >= 50 ? "b2" : score(a) >= 25 ? "b3" : "b4";
  const tk = [0.1, 0.3, 1, 3, 10, 30, 100], ex = tk.filter((v) => v >= e0 && v < e1), sx = tk.filter((v) => v >= s0 && v < s1);
  let g = ex.map((v) => `<line class="gr" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}"/><text class="ax" x="${X(v)}" y="${H - B + 16}" text-anchor="middle">${v}</text>`).join("")
    + sx.map((v) => `<line class="gr" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 7}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join("");
  // labels for the top 5 only: try right, left, above, below, then the corners; skip if nothing fits (the popup and ranking still name it)
  const boxes = apps.map((a) => [X(en[a]) - 7, Y(sp[a]) - 7, 14, 14]);
  const hit = (b) => b[0] < L || b[0] + b[2] > W - R || b[1] < T || b[1] + b[3] > H - B
    || boxes.some((c) => b[0] < c[0] + c[2] && c[0] < b[0] + b[2] && b[1] < c[1] + c[3] && c[1] < b[1] + b[3]);
  let dots = "", labels = "";
  apps.sort((p, q) => score(q) - score(p)).forEach((a, i) => {
    const cx = X(en[a]), cy = Y(sp[a]), w = name(a).length * 6.6 + 2;
    dots += `<g class="pt ${band(a)}" data-app="${esc(a)}" tabindex="${i ? -1 : 0}" role="img" aria-label="${esc(name(a))}: score ${Math.round(score(a))}, ${fmtNum(sp[a])} Gbit/s, ${fmtNum(en[a])} ${esc(unit)}"><circle class="hit" cx="${cx}" cy="${cy}" r="12"/><circle class="ring" cx="${cx}" cy="${cy}" r="11"/><circle class="dot" cx="${cx}" cy="${cy}" r="5"/></g>`;
    const at = [[cx + 9, cy - 7, "start"], [cx - 9 - w, cy - 7, "end"], [cx - w / 2, cy - 22, "middle"], [cx - w / 2, cy + 8, "middle"],
      [cx + 7, cy - 19, "start"], [cx + 7, cy + 5, "start"], [cx - 7 - w, cy - 19, "end"], [cx - 7 - w, cy + 5, "end"],
      // farther out, joined to the dot by a short line
      ...[22, 34].flatMap((d) => [[cx + 7, cy - 7 - d, "start"], [cx + 7, cy - 7 + d, "start"], [cx - 7 - w, cy - 7 - d, "end"], [cx - 7 - w, cy - 7 + d, "end"]])]
      .map(([bx, by, an]) => [[bx, by, w, 14], an]).find(([b]) => i < 5 && !hit(b));
    if (!at) return;
    const [[bx, by], an] = at; boxes.push(at[0]);
    if (Math.abs(by + 7 - cy) > 15) labels += `<line class="gr lead" x1="${cx}" y1="${cy + (by > cy ? 5 : -5)}" x2="${an === "start" ? bx : bx + w}" y2="${by + (by > cy ? 2 : 12)}"/>`;
    labels += `<text class="lbl" x="${an === "start" ? bx : an === "end" ? bx + w : bx + w / 2}" y="${by + 11}" text-anchor="${an}">${esc(name(a))}</text>`;
  });
  return `<svg class="bn-chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="Average speed against energy per GB for each app; the numbers page has every value.">
    ${g}<text class="ax-t" x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(xLabel)}, ${esc(unit)}${W < 560 ? "" : " (log), less is better"}</text>
    <text class="ax-t" transform="translate(13 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Average speed, Gbit/s${W < 560 ? "" : " (log), faster is up"}</text>
    ${labels}${dots}</svg>`;
}
function fmtNum(v) { const a = Math.abs(v); return a >= 100 ? Math.round(v).toLocaleString("en") : a >= 10 ? +v.toFixed(1) + "" : +v.toFixed(2) + ""; }


if (document.body.dataset.page === "setup") Routes.init();
if (document.body.dataset.page === "bench") Bench.init();
