/**
 * research-sync-worker
 * ─────────────────────────────────────────────────────────────────────────
 * Lets a signed-in MEMBER's browser make a few specific, limited writes to
 * the Research Hub's shared data file (research_data.json in the GitHub
 * repo) without ever handing that browser a GitHub token of its own. The
 * admin still writes directly from the browser (the GitHub token they paste
 * into Drive & Access) — this Worker exists only for the writes a *member*
 * needs to make themselves: saving their own profile, recording or removing
 * their own Drive upload, and sending an access request before they're even
 * a member yet.
 *
 * ADMIN WRITES (adminRead / adminWrite): the signed-in admin's browser can save
 * Civil resources, notices, exams, 3D works and research data through this Worker
 * too, so the admin never has to paste a GitHub token anywhere. The admin proves
 * who they are with the same session token the site already gets from the Google
 * Apps Script admin login; the Worker asks that script ("adminVerify") whether the
 * token is valid before touching anything. Only the files listed in ADMIN_FILES can
 * be written, and a save that would delete more than one item of any list at once
 * is refused.
 *
 * Every call here re-fetches the file fresh from GitHub and only changes the
 * one thing the request asked for, then writes it straight back — so two
 * people saving at the same time can't stomp on each other the way sending
 * a whole stale local copy of the file can.
 * ─────────────────────────────────────────────────────────────────────────
 * Secrets (set with `wrangler secret put <NAME>` — never written to a file
 * or committed anywhere):
 *   GITHUB_TOKEN  — a fine-grained GitHub PAT with Contents: Read & write,
 *                   scoped to ONLY the shaikh800/shaikh800.github.io repo.
 *   CLIENT_KEY    — a random string the site sends on every request, so a
 *                   stranger who stumbles on this URL by itself can't use
 *                   it. It ships inside the site's own JS (anyone can read
 *                   it there), so it's a speed bump against drive-by bots,
 *                   not real security — the member-email checks below are
 *                   the actual guard against someone writing data that
 *                   isn't theirs.
 */

const GITHUB_OWNER  = 'shaikh800';
const GITHUB_REPO   = 'shaikh800.github.io';
const GITHUB_FILE   = 'research_data.json';
const GITHUB_BRANCH = 'main';
const ALLOWED_ORIGINS = ['https://mdshaikh.me', 'https://shaikh800.github.io'];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Key',
    'Vary': 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function ghFetchFile(token, file) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file || GITHUB_FILE}?ref=${GITHUB_BRANCH}&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'research-sync-worker',
    },
  });
  if (!res.ok) throw new Error('github-read-failed:' + res.status);
  const j = await res.json();
  const content = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, '')))));
  return { content, sha: j.sha };
}

async function ghWriteFile(token, data, sha, file, message) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file || GITHUB_FILE}`;
  const body = {
    message: message || ('Research hub sync: ' + new Date().toISOString()),
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
    sha,
    branch: GITHUB_BRANCH,
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'research-sync-worker',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('github-write-failed:' + res.status);
  return res.json();
}

function isMember(data, email) {
  email = (email || '').toLowerCase();
  return (data.members || []).some((m) => (m.email || '').toLowerCase() === email);
}

function validEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function applyAction(data, action, payload) {
  data.members = data.members || [];
  data.uploads = data.uploads || [];
  data.pendingRequests = data.pendingRequests || [];

  switch (action) {
    case 'updateProfile': {
      const email = (payload.email || '').toLowerCase();
      if (!isMember(data, email)) throw new Error('not-a-member');
      const name = (payload.name || '').toString().trim().slice(0, 80);
      if (!name) throw new Error('missing-name');
      const whatsapp = (payload.whatsapp || '').toString().trim().slice(0, 40);
      const photo = typeof payload.photo === 'string' ? payload.photo.slice(0, 200000) : undefined;
      const m = data.members.find((x) => (x.email || '').toLowerCase() === email);
      m.name = name;
      m.whatsapp = whatsapp;
      m.initials = name.slice(0, 2).toUpperCase();
      if (photo) m.photo = photo;
      return data;
    }
    case 'addUpload': {
      const email = (payload.uploaderEmail || '').toLowerCase();
      if (!isMember(data, email)) throw new Error('not-a-member');
      if (!payload.id || !payload.title || !payload.link) throw new Error('missing-fields');
      data.uploads = data.uploads.filter((u) => u.id !== payload.id); // no dupes on a retry
      data.uploads.unshift({
        id: String(payload.id).slice(0, 100),
        title: String(payload.title).slice(0, 200),
        category: String(payload.category || 'Other').slice(0, 60),
        visibility: payload.visibility === 'public' ? 'public' : 'private',
        uploaderName: String(payload.uploaderName || '').slice(0, 100),
        uploaderEmail: email,
        link: String(payload.link).slice(0, 300),
        date: payload.date || new Date().toISOString(),
      });
      return data;
    }
    case 'removeUpload': {
      const email = (payload.email || '').toLowerCase();
      if (!isMember(data, email)) throw new Error('not-a-member');
      const upload = data.uploads.find((u) => u.id === payload.id);
      if (!upload) return data; // already gone -- nothing to do
      const me = data.members.find((m) => (m.email || '').toLowerCase() === email);
      const isOwner = (upload.uploaderEmail || '').toLowerCase() === email;
      const isAdmin = me && me.role === 'admin';
      if (!isOwner && !isAdmin) throw new Error('not-owner');
      data.uploads = data.uploads.filter((u) => u.id !== payload.id);
      return data;
    }
    case 'addPendingRequest': {
      const email = (payload.email || '').toLowerCase();
      if (!validEmail(email)) throw new Error('bad-email');
      if (isMember(data, email)) throw new Error('already-a-member');
      const name = String(payload.name || email.split('@')[0]).slice(0, 80);
      const existing = data.pendingRequests.find((r) => r.email === email);
      if (existing) { existing.name = name; existing.requestedAt = new Date().toISOString(); }
      else data.pendingRequests.push({ email, name, requestedAt: new Date().toISOString() });
      return data;
    }
    default:
      throw new Error('unknown-action');
  }
}

// ── ADMIN WRITES ───────────────────────────────────────────────────────────
// Files the admin may read/write here, and the shape each must keep.
const ADMIN_FILES = {
  'civil_data.json':    { semesters: 'object', notices: 'array', exams: 'array' },
  'modeling_data.json': { works: 'array' },
  'research_data.json': {},
};

async function verifyAdmin(env, tokens) {
  if (!env.GAS_URL) throw new Error('gas-not-configured');
  const list = (Array.isArray(tokens) ? tokens : []).filter((t) => typeof t === 'string' && t).slice(0, 3);
  for (const t of list) {
    try {
      const res = await fetch(env.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'adminVerify', token: t }),
        redirect: 'follow',
      });
      const j = await res.json();
      if (j && j.status === 'success' && j.valid === true) return true;
    } catch (e) { /* try the next token */ }
  }
  return false;
}

function checkShape(file, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('bad-data');
  const shape = ADMIN_FILES[file];
  Object.keys(shape).forEach((k) => {
    const want = shape[k];
    const v = data[k];
    const okType = want === 'array' ? Array.isArray(v) : (v && typeof v === 'object' && !Array.isArray(v));
    if (!okType) throw new Error('bad-data');
  });
}

// Item count per top-level key (a list = its length, an object of lists = all items in it).
function countItems(d) {
  const out = {};
  Object.keys(d || {}).forEach((k) => {
    const v = d[k];
    if (Array.isArray(v)) out[k] = v.length;
    else if (v && typeof v === 'object') {
      let n = 0, any = false;
      Object.values(v).forEach((x) => { if (Array.isArray(x)) { n += x.length; any = true; } });
      if (any) out[k] = n;
    }
  });
  return out;
}

async function handleAdmin(action, payload, env, origin) {
  const file = payload.file;
  if (!ADMIN_FILES[file]) return json({ ok: false, error: 'bad-file' }, 400, origin);
  if (!(await verifyAdmin(env, payload.adminTokens))) return json({ ok: false, error: 'not-admin' }, 401, origin);

  const latest = await ghFetchFile(env.GITHUB_TOKEN, file);

  if (action === 'adminRead') return json({ ok: true, data: latest.content, sha: latest.sha }, 200, origin);

  // adminWrite
  const data = payload.data;
  checkShape(file, data);
  if (payload.sha && payload.sha !== latest.sha) return json({ ok: false, error: 'conflict' }, 409, origin);

  const before = countItems(latest.content), after = countItems(data);
  const allow = Array.isArray(payload.allowShrink) ? payload.allowShrink : [];
  for (const k of Object.keys(before)) {
    if (allow.indexOf(k) === -1 && before[k] - (after[k] || 0) > 1) {
      return json({ ok: false, error: 'blocked', message: `Blocked: this save would remove ${before[k] - (after[k] || 0)} ${k} item(s) at once. Nothing was written.` }, 400, origin);
    }
  }
  data.updated = new Date().toISOString();
  const message = String(payload.message || 'Update data').slice(0, 100);
  await ghWriteFile(env.GITHUB_TOKEN, data, latest.sha, file, message);
  return json({ ok: true }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405, origin);

    if (!env.CLIENT_KEY || request.headers.get('X-Client-Key') !== env.CLIENT_KEY) {
      return json({ ok: false, error: 'unauthorized' }, 401, origin);
    }

    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'bad-json' }, 400, origin); }
    const { action, payload } = body || {};
    if (!action || typeof payload !== 'object' || !payload) {
      return json({ ok: false, error: 'bad-request' }, 400, origin);
    }

    try {
      if (action === 'adminRead' || action === 'adminWrite') return await handleAdmin(action, payload, env, origin);
      const { content, sha } = await ghFetchFile(env.GITHUB_TOKEN);
      const updated = applyAction(content, action, payload);
      updated.updated = new Date().toISOString();
      await ghWriteFile(env.GITHUB_TOKEN, updated, sha);
      return json({ ok: true }, 200, origin);
    } catch (e) {
      const msg = (e && e.message) || 'error';
      const knownClientErrors = [
        'not-a-member', 'missing-name', 'missing-fields', 'not-owner',
        'bad-email', 'already-a-member', 'unknown-action',
        'bad-file', 'bad-data', 'not-admin', 'conflict', 'gas-not-configured',
      ];
      return json({ ok: false, error: msg }, knownClientErrors.includes(msg) ? 400 : 502, origin);
    }
  },
};
