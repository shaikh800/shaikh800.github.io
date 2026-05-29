/* ── NAV TOGGLE ─────────────────────────────────────────── */
const navToggle = document.querySelector(".nav-toggle");
const siteNav   = document.querySelector(".site-nav");

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
  if (link.getAttribute("data-page") === pagePath) link.classList.add("is-active");
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


    function toggleAcademyMenuMobile(event) {
      event.preventDefault();
      document.getElementById("academyDropdownMobile").classList.toggle("show-mobile");
    }

    // Click outside to hide mobile menu
    document.addEventListener("click", function(event) {
      const mobileMenu = document.getElementById("academyDropdownMobile");
      const academyBtn = document.querySelector(".mobile-tab[onclick*='toggleAcademyMenuMobile']");
      
      if (mobileMenu && mobileMenu.classList.contains("show-mobile")) {
        if (!mobileMenu.contains(event.target) && !academyBtn.contains(event.target)) {
          mobileMenu.classList.remove("show-mobile");
        }
      }
    });