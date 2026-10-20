/* ── NAV TOGGLE (mobile slide-in sidebar) ─────────────────── */
const navToggle = document.querySelector(".nav-toggle");
const siteNav   = document.querySelector(".site-nav");
const navScrim  = document.querySelector(".nav-scrim");

function setNavOpen(isOpen) {
  siteNav.classList.toggle("is-open", isOpen);
  if (navScrim) navScrim.classList.toggle("is-open", isOpen);
  document.body.classList.toggle("nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    setNavOpen(!siteNav.classList.contains("is-open"));
  });
  if (navScrim) navScrim.addEventListener("click", () => setNavOpen(false));
  document.addEventListener("click", (e) => {
    if (!siteNav.classList.contains("is-open")) return;
    if (siteNav.contains(e.target) || navToggle.contains(e.target)) return;
    setNavOpen(false);
  });
  document.querySelectorAll(".site-nav a").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(false));
  });
}

/* ── NAV ACCORDION (Civil / 3D / Academy / Research sub-menus) ─ */
document.querySelectorAll(".nav-caret").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const group = btn.closest(".nav-group");
    if (!group) return;
    const isOpen = group.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });
});

/* ── ACTIVE NAV LINK ─────────────────────────────────────── */
const pagePath = window.location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".site-nav a[data-page]").forEach((link) => {
  const isCurrent = link.getAttribute("data-page") === pagePath;
  if (isCurrent) {
    link.classList.add("is-active");
    link.setAttribute("aria-current", "page");
    const group = link.closest(".nav-group");
    if (group) {
      group.classList.add("is-open");
      const caret = group.querySelector(".nav-caret");
      if (caret) caret.setAttribute("aria-expanded", "true");
    }
  }
});

/* ── ACTIVE NAV SUB-LINK (matches the current page + hash) ── */
if (window.location.hash) {
  document.querySelectorAll(".nav-sub a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const [hrefPage, hrefHash] = href.split("#");
    const linkPage = hrefPage || pagePath;
    if (linkPage === pagePath && hrefHash && window.location.hash === "#" + hrefHash) {
      link.classList.add("is-active");
    }
  });
}


/* ── SECTION FOCUS MODE (sidebar sub-links open just that one section) ──
   When the page is reached via a hash that matches one of main.page's
   direct <section id="..."> children (the way every sidebar dropdown
   sub-link points), every other top-level section — including the page
   hero — is hidden, so only that section's content shows. A small back
   link lets you return to the full page. Visiting a page with no hash
   still shows the normal full overview, unchanged. ─────────────────── */
(function () {
  const main = document.querySelector("main.page");
  if (!main) return;
  const sections = Array.from(main.children).filter((el) => el.tagName === "SECTION");
  if (sections.length < 2) return;

  const backBar = document.createElement("div");
  backBar.className = "focus-backbar";
  backBar.hidden = true;
  backBar.innerHTML = '<a class="back-link" href="#"><i class="fas fa-arrow-left"></i> <span>Back to full page</span></a>';
  main.insertBefore(backBar, main.firstChild);
  backBar.querySelector("a").addEventListener("click", (e) => {
    e.preventDefault();
    history.pushState("", document.title, window.location.pathname + window.location.search);
    applySectionFocus();
    window.scrollTo(0, 0);
  });

  // Pages that opt in (civil/modeling/academy) mark their hero + menu with
  // data-focus-root: those are the only thing shown with no hash, and every
  // other section is hidden until it's the one you opened. Pages that don't
  // opt in (notice/research/index) keep the old behaviour — show everything
  // unless a specific section is targeted.
  const hasRoot = sections.some((sec) => sec.hasAttribute("data-focus-root"));

  function applySectionFocus() {
    const hash = (window.location.hash || "").slice(1);
    const target = hash && sections.find((sec) => sec.id === hash);
    sections.forEach((sec) => {
      if (hasRoot) {
        sec.hidden = sec.hasAttribute("data-focus-root") ? Boolean(target) : (!target || sec !== target);
      } else {
        sec.hidden = Boolean(target) && sec !== target;
      }
    });
    backBar.hidden = !target;
    if (target) target.scrollIntoView({ block: "start" });
  }

  window.addEventListener("hashchange", applySectionFocus);
  applySectionFocus();
})();

/* ── SCROLL REVEAL ───────────────────────────────────────── */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal, .reveal-grid").forEach((el) => {
  observer.observe(el);
});
