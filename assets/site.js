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
    // A group's own label (Civil / 3D / Academy / Research) only toggles its
    // dropdown — it's handled by the NAV ACCORDION block below. If this loop
    // also closed the drawer on that same click, the whole sidebar would
    // vanish the instant someone tapped a group label (the dropdown opens
    // internally for a frame, then the drawer closes over it) — so it's
    // excluded here and only real navigation links close the drawer.
    if (link.closest(".nav-group-head")) return;
    link.addEventListener("click", () => setNavOpen(false));
  });
}

/* ── NAV ACCORDION (Civil / 3D / Academy / Research sub-menus) ──
   A group's own label (Civil, 3D, Academy, Research) only opens its
   dropdown — it never jumps straight into the first sub-item. Picking
   where to go is always a second, deliberate tap on one of the sub-links. */
function toggleNavGroup(group) {
  if (!group) return;
  const isOpen = group.classList.toggle("is-open");
  const caret = group.querySelector(".nav-caret");
  if (caret) caret.setAttribute("aria-expanded", String(isOpen));
}
document.querySelectorAll(".nav-caret").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleNavGroup(btn.closest(".nav-group"));
  });
});
document.querySelectorAll(".nav-group-head > .nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    toggleNavGroup(link.closest(".nav-group"));
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
    sections.forEach((sec) => {
      // Elements marked data-keep-hidden (e.g. a page's own hero that a newer,
      // page-specific tab system has permanently retired) should never be forced
      // back open by this generic fallback -- only an explicit matching hash may
      // reveal them.
      if (!target && sec.hasAttribute('data-keep-hidden')) return;
      sec.hidden = Boolean(target) && sec !== target;
    });
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


/* ── SHARED DRIVE FOLDER PICKER ─────────────────────────────────────
   Used by Civil / 3D / Research's "upload to Drive" flows so a signed-in
   uploader can browse their own Drive (via their own OAuth token) and
   either walk into an existing folder or create a new one, instead of
   blindly typing a path and hoping it matches what's already there.
   Self-contained: injects its own modal + styles once, namespaced
   (drv-pk-*) so it never collides with a page's own CSS. Usage:
     DrivePicker.open({ token, rootId, rootLabel, onChoose(path) })
   onChoose receives the chosen folder as a '/'-joined name path (e.g.
   "CE 501 / Books") — callers that already do findOrCreateFolder-by-
   name on a typed path can feed that string straight back in, so no
   folder IDs need to flow through existing upload code at all. ─────── */
const DrivePicker = (function () {
  let overlay = null;
  let state = null; // { token, stack: [{id,name}], onChoose }

  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  function ensureUI() {
    if (overlay) return;
    const style = document.createElement("style");
    style.textContent = `
.drv-pk-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px;}
.drv-pk-overlay.open{display:flex;}
.drv-pk-box{background:#fff;border-radius:16px;width:100%;max-width:480px;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:inherit;}
.drv-pk-head{padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.drv-pk-head h3{margin:0;font-size:15px;font-weight:700;color:#0f172a;}
.drv-pk-close{width:28px;height:28px;border-radius:8px;border:1px solid #e5e7eb;background:none;cursor:pointer;color:#64748b;flex:none;}
.drv-pk-close:hover{background:#f8fafc;}
.drv-pk-crumb{padding:10px 20px;font-size:12.5px;color:#64748b;border-bottom:1px solid #f1f5f9;display:flex;flex-wrap:wrap;gap:5px;align-items:center;}
.drv-pk-crumb a{color:#2563eb;cursor:pointer;text-decoration:none;}
.drv-pk-crumb a:hover{text-decoration:underline;}
.drv-pk-crumb span{color:#0f172a;font-weight:600;}
.drv-pk-list{flex:1;overflow-y:auto;padding:8px;min-height:160px;}
.drv-pk-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:13.5px;color:#334155;}
.drv-pk-row:hover{background:#f8fafc;}
.drv-pk-row i{color:#f5b942;width:16px;}
.drv-pk-empty,.drv-pk-loading{text-align:center;color:#94a3b8;font-size:13px;padding:34px 16px;line-height:1.5;}
.drv-pk-new{display:flex;gap:8px;padding:12px 20px;border-top:1px solid #f1f5f9;}
.drv-pk-new input{flex:1;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;min-width:0;}
.drv-pk-new button{padding:9px 14px;border-radius:8px;border:none;background:#f1f5f9;color:#334155;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;}
.drv-pk-new button:hover{background:#e2e8f0;}
.drv-pk-foot{padding:14px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:10px;}
.drv-pk-here{font-size:12px;color:#64748b;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.drv-pk-foot button.primary{padding:10px 18px;border-radius:9px;border:none;background:#2563eb;color:#fff;font-weight:700;font-size:13.5px;cursor:pointer;flex:none;}
.drv-pk-foot button.primary:hover{background:#1d4ed8;}
`;
    document.head.appendChild(style);

    overlay = document.createElement("div");
    overlay.className = "drv-pk-overlay";
    overlay.innerHTML = `
<div class="drv-pk-box">
  <div class="drv-pk-head"><h3><i class="fab fa-google-drive" style="color:#0f9d58;"></i> Choose a folder</h3><button type="button" class="drv-pk-close"><i class="fas fa-xmark"></i></button></div>
  <div class="drv-pk-crumb" id="drvPkCrumb"></div>
  <div class="drv-pk-list" id="drvPkList"></div>
  <div class="drv-pk-new"><input id="drvPkNewName" placeholder="New folder name…"><button type="button" id="drvPkNewBtn"><i class="fas fa-folder-plus"></i> Create</button></div>
  <div class="drv-pk-foot"><span class="drv-pk-here" id="drvPkHere"></span><button type="button" class="primary" id="drvPkChooseBtn"><i class="fas fa-check"></i> Use this folder</button></div>
</div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".drv-pk-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.getElementById("drvPkChooseBtn").addEventListener("click", () => {
      if (!state) return;
      const path = state.stack.map((s) => s.name).join("/");
      const cb = state.onChoose;
      close();
      if (cb) cb(path);
    });
    document.getElementById("drvPkNewBtn").addEventListener("click", createFolder);
    document.getElementById("drvPkNewName").addEventListener("keydown", (e) => { if (e.key === "Enter") createFolder(); });
  }

  function renderCrumb() {
    const el = document.getElementById("drvPkCrumb");
    el.innerHTML = state.stack.map((f, i) => {
      const last = i === state.stack.length - 1;
      return (i > 0 ? '<i class="fas fa-chevron-right" style="font-size:9px;"></i> ' : "") +
        (last ? `<span>${esc(f.name)}</span>` : `<a data-i="${i}">${esc(f.name)}</a>`);
    }).join(" ");
    el.querySelectorAll("a[data-i]").forEach((a) => a.addEventListener("click", () => {
      state.stack = state.stack.slice(0, parseInt(a.dataset.i, 10) + 1);
      load();
    }));
    document.getElementById("drvPkHere").textContent = "Uploading to: " + state.stack.map((s) => s.name).join(" / ");
  }

  async function load() {
    renderCrumb();
    const list = document.getElementById("drvPkList");
    list.innerHTML = '<div class="drv-pk-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading folders…</div>';
    const cur = state.stack[state.stack.length - 1];
    try {
      const q = encodeURIComponent(`'${cur.id}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&pageSize=200`, {
        headers: { Authorization: "Bearer " + state.token },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "drive-error");
      const folders = data.files || [];
      if (!folders.length) {
        list.innerHTML = '<div class="drv-pk-empty">No subfolders here yet — create one below, or just use this folder as-is.</div>';
        return;
      }
      list.innerHTML = folders.map((f) => `<div class="drv-pk-row" data-id="${esc(f.id)}" data-name="${esc(f.name)}"><i class="fas fa-folder"></i> ${esc(f.name)}</div>`).join("");
      list.querySelectorAll(".drv-pk-row").forEach((row) => row.addEventListener("click", () => {
        state.stack.push({ id: row.dataset.id, name: row.dataset.name });
        load();
      }));
    } catch (e) {
      list.innerHTML = `<div class="drv-pk-empty">Couldn't load folders — ${esc(e.message || "check your connection")}.</div>`;
    }
  }

  async function createFolder() {
    const input = document.getElementById("drvPkNewName");
    const name = input.value.trim();
    if (!name || !state) return;
    const btn = document.getElementById("drvPkNewBtn");
    btn.disabled = true;
    try {
      const cur = state.stack[state.stack.length - 1];
      const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
        method: "POST",
        headers: { Authorization: "Bearer " + state.token, "Content-Type": "application/json" },
        body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [cur.id] }),
      });
      const folder = await res.json();
      if (!folder.id) throw new Error((folder.error && folder.error.message) || "Could not create the folder.");
      input.value = "";
      state.stack.push({ id: folder.id, name: folder.name });
      load();
    } catch (e) {
      alert(e.message || "Could not create the folder.");
    } finally {
      btn.disabled = false;
    }
  }

  function open({ token, rootId, rootLabel, onChoose }) {
    if (!token || !rootId) { alert("Sign in with Google first."); return; }
    ensureUI();
    state = { token, stack: [{ id: rootId, name: rootLabel || "Drive" }], onChoose };
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    load();
  }
  function close() {
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = "";
    state = null;
  }

  return { open, close };
})();
