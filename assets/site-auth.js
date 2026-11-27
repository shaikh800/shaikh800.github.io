/* ══════════════════════════════════════════════════════════════
   SHARED ADMIN SESSION
   One owner password, checked on the server (Google Apps Script),
   shared by Civil, Research and the Academy Admin Panel.
   Log in once in a tab and every page in that tab recognises you.
   ══════════════════════════════════════════════════════════════ */
const SITE_GAS_URL = 'https://script.google.com/macros/s/AKfycbyl1RaM9sL_kHY8_ZBGHKmPnvAbi8PFWw0f4yKezlGiDHQKouaIkdZx8poSrE4jy3jw/exec';
const SITE_ADMIN_TOKEN_KEY  = 'shaikh_admin_token_v1';
const SITE_ADMIN_EXPIRY_KEY = 'shaikh_admin_expiry_v1';

function siteIsAdmin() {
  const token  = localStorage.getItem(SITE_ADMIN_TOKEN_KEY);
  const expiry = localStorage.getItem(SITE_ADMIN_EXPIRY_KEY);
  return !!(token && expiry && Date.now() < parseInt(expiry, 10));
}

/* Returns { ok:true } or { ok:false, message } — never throws */
async function siteAdminLogin(password) {
  try {
    const res = await fetch(SITE_GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'adminLogin', password }),
      headers: { 'Content-Type': 'text/plain' }
    });
    const data = await res.json();
    if (data.status === 'success' && data.token) {
      localStorage.setItem(SITE_ADMIN_TOKEN_KEY, data.token);
      localStorage.setItem(SITE_ADMIN_EXPIRY_KEY, String(data.expiry));
      return { ok: true };
    }
    return { ok: false, message: data.message || 'Incorrect password.' };
  } catch (e) {
    return { ok: false, message: 'Could not reach the server.' };
  }
}

function siteAdminLogout() {
  localStorage.removeItem(SITE_ADMIN_TOKEN_KEY);
  localStorage.removeItem(SITE_ADMIN_EXPIRY_KEY);
  // admin_panel.html's own gate mirrors this same token into sessionStorage
  // too (so civil.html etc. recognise a login made there). Clearing only
  // localStorage left that sessionStorage copy behind, so "Logout" here
  // looked like it worked (admin buttons disappeared) but a later visit to
  // admin_panel.html auto-logged back in from the leftover session copy,
  // with no password asked. Clear both so Logout actually logs out.
  try {
    sessionStorage.removeItem(SITE_ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(SITE_ADMIN_EXPIRY_KEY);
  } catch (e) {}
}


/* ══════════════════════════════════════════════════════════════
   FOOTER LOCK  (Civil, 3D, Notice, Research)
   - logged out : lock icon -> admin login, and after login the admin is
                  sent BACK to the page they came from
   - logged in  : shows "Admin ✓"; the same unlocked lock logs out
   ══════════════════════════════════════════════════════════════ */
const SITE_RETURN_PAGES = ['index.html', 'civil.html', 'modeling.html', 'notice.html', 'research.html', 'academy.html', 'teacher_panel.html'];

/* Only plain page names of this site are accepted -- never an outside URL. */
function siteSafeReturn(name) {
  if (!name) return null;
  name = String(name).split(/[?#]/)[0];
  return SITE_RETURN_PAGES.indexOf(name) !== -1 ? name : null;
}

function siteAdminFooterInit() {
  const link = document.querySelector('.footer-admin-link');
  if (!link || link.dataset.ready) return;
  link.dataset.ready = '1';
  const here = siteSafeReturn(location.pathname.split('/').pop() || 'index.html') || 'index.html';
  const q = 'admin_panel.html?from=' + encodeURIComponent(here);

  if (!siteIsAdmin()) {
    link.href = q + '&login=1';
    link.title = 'Admin login';
    return;
  }

  // Keep the footer deliberately simple across the entire site: there is no
  // Academy-panel shortcut here. The same lock is the single session control:
  // locked opens the admin login; unlocked logs the admin out.
  link.href = '#admin-logout';
  link.title = 'Log out of admin';
  link.setAttribute('aria-label', 'Log out of admin');
  const icon = link.querySelector('i');
  if (icon) icon.className = 'fas fa-lock-open';
  link.addEventListener('click', event => {
    event.preventDefault();
    siteAdminLogout();
    location.reload();
  });

  const group = document.createElement('span');
  group.className = 'footer-admin-group';
  link.parentNode.insertBefore(group, link);
  const state = document.createElement('span');
  state.className = 'footer-admin-state';
  state.textContent = 'Admin ✓';
  group.appendChild(state);
  group.appendChild(link);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', siteAdminFooterInit);
else siteAdminFooterInit();
