/* ── NAV TOGGLE ─────────────────────────────────────────── */
const navToggle = document.querySelector(".nav-toggle");
const siteNav   = document.querySelector(".site-nav");

const mobileTabbar = document.querySelector(".mobile-tabbar");
if (mobileTabbar) document.body.classList.add("has-mobile-tabbar");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (e) => {
    if (!siteNav.classList.contains("is-open")) return;
    if (siteNav.contains(e.target) || navToggle.contains(e.target)) return;
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
}

/* ── ACTIVE NAV LINK ─────────────────────────────────────── */
const pagePath = window.location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".site-nav a[data-page]").forEach((link) => {
  const isCurrent = link.getAttribute("data-page") === pagePath;
  if (isCurrent) {
    link.classList.add("is-active");
    link.setAttribute("aria-current", "page");
  }
});

document.querySelectorAll(".mobile-tab").forEach((tab) => {
  const href = tab.getAttribute("href");
  if (href === pagePath || (href === "index.html" && pagePath === "index.html")) {
    tab.classList.add("active");
    tab.setAttribute("aria-current", "page");
  }
});

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
