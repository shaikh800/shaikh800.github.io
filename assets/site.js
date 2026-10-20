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
