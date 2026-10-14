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
  const token  = sessionStorage.getItem(SITE_ADMIN_TOKEN_KEY);
  const expiry = sessionStorage.getItem(SITE_ADMIN_EXPIRY_KEY);
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
      sessionStorage.setItem(SITE_ADMIN_TOKEN_KEY, data.token);
      sessionStorage.setItem(SITE_ADMIN_EXPIRY_KEY, String(data.expiry));
      return { ok: true };
    }
    return { ok: false, message: data.message || 'Incorrect password.' };
  } catch (e) {
    return { ok: false, message: 'Could not reach the server.' };
  }
}

function siteAdminLogout() {
  sessionStorage.removeItem(SITE_ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(SITE_ADMIN_EXPIRY_KEY);
}
