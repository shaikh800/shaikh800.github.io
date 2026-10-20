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

/* ── SECTION FOCUS MODE (sidebar sub-links open just that one section) ──
   When the page is reached via a hash that matches one of main.page's
   direct <section id="..."> children (the way every sidebar dropdown
   sub-link points), every other top-level section — including the page
   hero — is hidden, so only that section's content shows.
   Civil / 3D / Academy declare data-default-section on <main.page>, so
   they have no standalone "overview" page at all: a bare visit (no hash)
   jumps straight into that default section instead, and there's no back
   link, since there's no full page to go back to — only the sidebar's
   sub-links move between sections. Pages without that attribute (Notice,
   Research, Home) keep the old behaviour: show everything by default,
   and offer a back link once a hash focuses one section. ───────────── */
(function () {
  const main = document.querySelector("main.page");
  if (!main) return;
  const sections = Array.from(main.children).filter((el) => el.tagName === "SECTION");
  if (sections.length < 2) return;

  // Pages that opt in (civil/modeling/academy) set data-default-section on
  // <main.page>: with no hash, they jump straight into that section instead
  // of showing an overview/menu — there is no "main page" to land on, only
  // the sidebar's sub-links. Pages that don't opt in (notice/research/index)
  // keep the old behaviour — show everything unless a hash targets one.
  const defaultSection = main.dataset.defaultSection || null;

  let backBar = null;
  if (!defaultSection) {
    backBar = document.createElement("div");
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
  }

  function applySectionFocus() {
    let hash = (window.location.hash || "").slice(1);
    if (!hash && defaultSection) {
      hash = defaultSection;
      history.replaceState("", document.title, window.location.pathname + window.location.search + "#" + hash);
    }
    const target = hash && sections.find((sec) => sec.id === hash);
    sections.forEach((sec) => { sec.hidden = Boolean(target) && sec !== target; });
    if (backBar) backBar.hidden = !target;
    if (target) target.scrollIntoView({ block: "start" });
  }

  window.addEventListener("hashchange", applySectionFocus);
  applySectionFocus();
})();


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
