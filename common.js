/* Tunnel Atlas, every page: the theme menu (System by default; the page head applies a saved choice before first paint)
   and the post's contents list. Light and dark follow prefers-color-scheme in styles.css, so nothing here watches the system setting. */
// for work that reads layout at load: once the first frame is out, layout is already done, so the read forces nothing
const afterPaint = (fn) => requestAnimationFrame(() => setTimeout(fn));
const themeBtn = document.getElementById("theme-btn"), themeMenu = document.getElementById("theme-menu");
const showTheme = (v) => {
  themeMenu.querySelectorAll("button").forEach((b) => {
    const on = b.dataset.v === v;
    b.setAttribute("aria-pressed", on);
    if (on) themeBtn.setAttribute("aria-label", `Theme: ${b.textContent.trim()}`);
  });
};
const toggleThemeMenu = (open) => { themeMenu.hidden = !open; themeBtn.setAttribute("aria-expanded", open); };
showTheme(document.documentElement.dataset.theme || "auto");
themeBtn.addEventListener("click", () => toggleThemeMenu(themeMenu.hidden));
themeMenu.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const v = b.dataset.v, root = document.documentElement;
  if (v === "auto") delete root.dataset.theme; else root.dataset.theme = v;
  try { if (v === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", v); } catch (e) {}
  showTheme(v);
  toggleThemeMenu(false);
  themeBtn.focus();
});
addEventListener("click", (e) => { if (!e.target.closest("#theme")) toggleThemeMenu(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !themeMenu.hidden) { toggleThemeMenu(false); themeBtn.focus(); } });
document.getElementById("theme").addEventListener("focusout", (e) => { if (e.relatedTarget && !e.relatedTarget.closest("#theme")) toggleThemeMenu(false); });

/* mark the section being read: the last one whose top has passed a reading line. The line slides to the bottom over the last screen,
   because short final sections can never scroll up to it. A click keeps its section marked until the reader scrolls by hand. */
const tocLinks = [...document.querySelectorAll(".toc a")];
if (tocLinks.length) {
  const targets = tocLinks.map((a) => document.querySelector(a.hash));
  let clicked = false, queued = false;
  const mark = (el) => tocLinks.forEach((a, i) => { if (targets[i] === el) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
  const update = () => {
    queued = false;
    if (clicked) return;
    const h = innerHeight, left = document.documentElement.scrollHeight - h - scrollY, line = h * (0.3 + 0.7 * Math.max(0, 1 - left / h));
    mark(targets.filter((t) => t.getBoundingClientRect().top <= line).pop() || targets[0]);
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  tocLinks.forEach((a, i) => a.addEventListener("click", () => { clicked = true; mark(targets[i]); }));
  ["wheel", "touchmove", "keydown"].forEach((t) => addEventListener(t, () => { clicked = false; }, { passive: true }));
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  afterPaint(update);
}
