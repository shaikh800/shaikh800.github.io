/* ══════════════════════════════════════════════════════════════
   SAFE SHARED-DATA WRITER  (civil_data.json)
   Several pages (Civil, Exam Controller, Exam System) all keep their
   own slice of civil_data.json:
       semesters + notices  -> civil.html
       exams                -> exam_controller.html / model_test.html
   They used to each rewrite the WHOLE file from whatever copy they had
   in memory, so one page could silently erase another page's data
   (this is how the semester resources and notices were lost).

   Rule now: every write goes through siteDataUpdate(), which
     1. reads the LATEST file from GitHub right before writing,
     2. lets the caller change only its own keys on that fresh copy,
     3. refuses to save if the read failed or if the change would wipe
        out more than one item of any list in a single save,
     4. retries automatically if someone else saved in the meantime.
   ══════════════════════════════════════════════════════════════ */
const SITE_DATA = {
  owner:  'shaikh800',
  repo:   'shaikh800.github.io',
  branch: 'main',
  file:   'civil_data.json'
};

function _sdApi(file) {
  return `https://api.github.com/repos/${SITE_DATA.owner}/${SITE_DATA.repo}/contents/${file || SITE_DATA.file}`;
}
function _sdDecode(b64) {
  return decodeURIComponent(escape(atob(String(b64).replace(/\s/g, ''))));
}
function _sdEncode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/* Make sure the three lists always exist, keep any other keys untouched. */
function siteDataNormalize(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('data file is not an object');
  if (!d.semesters || typeof d.semesters !== 'object' || Array.isArray(d.semesters)) d.semesters = {};
  if (!Array.isArray(d.notices)) d.notices = [];
  if (!Array.isArray(d.exams))   d.exams   = [];
  return d;
}

/* Item count per top-level key: a list counts its length, an object of lists
   (like semesters) counts all items inside. Used by the "no mass delete" guard. */
function _sdCounts(d) {
  const out = {};
  Object.keys(d || {}).forEach(k => {
    const v = d[k];
    if (Array.isArray(v)) out[k] = v.length;
    else if (v && typeof v === 'object') {
      let n = 0, any = false;
      Object.values(v).forEach(x => { if (Array.isArray(x)) { n += x.length; any = true; } });
      if (any) out[k] = n;
    }
  });
  return out;
}

/* Latest file straight from the GitHub API (never the cached CDN copy).
   Returns { data, sha }. Throws if it cannot be read -- callers must NOT
   fall back to an empty object. */
async function siteDataRead(token, file) {
  const res = await fetch(`${_sdApi(file)}?ref=${SITE_DATA.branch}&_=${Date.now()}`, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('GitHub read failed (' + res.status + ')');
  const j = await res.json();
  let text;
  if (j.content && j.encoding === 'base64') {
    text = _sdDecode(j.content);
  } else {                                    // very large file -> read through the blob API
    const b = await fetch(`https://api.github.com/repos/${SITE_DATA.owner}/${SITE_DATA.repo}/git/blobs/${j.sha}`,
      { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (!b.ok) throw new Error('GitHub blob read failed (' + b.status + ')');
    text = _sdDecode((await b.json()).content);
  }
  const parsed = JSON.parse(text);
  return { data: (!file || file === SITE_DATA.file) ? siteDataNormalize(parsed) : parsed, sha: j.sha };
}

/* Read -> mutate -> guard -> write, with retries.
   mutate(data) changes only the keys the caller owns.
   opts.allowShrink = ['exams'] lets that list drop by more than one item
   (used only by the explicit "clear all exams" button).
   opts.file = write a different data file (e.g. 'modeling_data.json').
   Returns { ok:true, data } or { ok:false, error }. Never throws. */
async function siteDataUpdate(token, mutate, message, opts) {
  opts = opts || {};
  if (!token) return { ok: false, error: 'No GitHub token' };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data: latest, sha } = await siteDataRead(token, opts.file);
      const before = _sdCounts(latest);
      const next = JSON.parse(JSON.stringify(latest));
      await mutate(next);
      if (!opts.file || opts.file === SITE_DATA.file) siteDataNormalize(next);
      const after = _sdCounts(next);

      for (const k of Object.keys(before)) {
        const allowed = (opts.allowShrink || []).indexOf(k) !== -1;
        if (!allowed && before[k] - (after[k] || 0) > 1) {
          return { ok: false, error: `Blocked: this save would remove ${before[k] - (after[k] || 0)} ${k} item(s) at once. Nothing was written.` };
        }
      }
      if (JSON.stringify(next) === JSON.stringify(latest)) return { ok: true, data: latest, unchanged: true };

      next.updated = new Date().toISOString();
      const put = await fetch(_sdApi(opts.file), {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
        body: JSON.stringify({
          message: message || 'Update data',
          content: _sdEncode(JSON.stringify(next, null, 2)),
          sha, branch: SITE_DATA.branch
        })
      });
      if (put.ok) return { ok: true, data: next };
      if ((put.status === 409 || put.status === 422) && attempt < 3) continue;   // someone saved first -> re-read and retry
      return { ok: false, error: 'GitHub write failed (' + put.status + ')' };
    } catch (e) {
      if (attempt === 3) return { ok: false, error: String(e && e.message || e) };
    }
  }
  return { ok: false, error: 'Could not save' };
}

/* Public (no token) read for visitors. Returns null on any failure. */
async function siteDataFetchPublic() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${SITE_DATA.owner}/${SITE_DATA.repo}/${SITE_DATA.branch}/${SITE_DATA.file}?_=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return siteDataNormalize(await r.json());
  } catch { return null; }
}
