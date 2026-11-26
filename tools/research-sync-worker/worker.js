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

// ── Gemini tracker: narrowly-scoped co-manager access ──────────────────────
// A co-manager is deliberately *not* a Research/Drive admin. Their Google
// account is checked by Google before they can change only Gemini payments and
// the subscription cycle. This prevents an email typed into the public gate
// from becoming an authority credential.
function geminiSnapshot(data) {
  return {
    geminiPayments: data.geminiPayments || {},
    geminiCycleStart: typeof data.geminiCycleStart === 'string' ? data.geminiCycleStart : '',
    geminiCycleEnd: typeof data.geminiCycleEnd === 'string' ? data.geminiCycleEnd : '',
    geminiMonthlyFee: Number(data.geminiMonthlyFee) || 0,
    geminiManagers: Array.isArray(data.geminiManagers) ? data.geminiManagers : [],
    updated: data.updated || new Date().toISOString(),
  };
}

function isGeminiManager(data, email) {
  email = String(email || '').toLowerCase();
  return (data.geminiManagers || []).some((manager) => String(manager || '').toLowerCase() === email);
}

async function googleEmailForToken(token) {
  if (!token || typeof token !== 'string') return '';
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return res.ok && data.email_verified && validEmail(data.email) ? data.email.toLowerCase() : '';
}

async function handleGemini(action, payload, env, origin) {
  if (!env.DRIVE_SYNC_STATE) return json({ ok: false, error: 'live-state-not-configured' }, 503, origin);

  // Reads are lightweight and served from KV. A short lifetime also picks up
  // the rare manual edit made directly in GitHub without making every viewer
  // wait for a GitHub Pages deployment.
  if (action === 'geminiRead') {
    const cached = await env.DRIVE_SYNC_STATE.get('gemini:live-state', 'json');
    if (cached && cached.updated) return json({ ok: true, data: cached }, 200, origin);
    const latest = await ghFetchFile(env.GITHUB_TOKEN, GITHUB_FILE);
    const state = geminiSnapshot(latest.content);
    // Cloudflare KV enforces a 60-second minimum expiry. The browser still
    // polls every few seconds, so writes are reflected immediately while a
    // direct GitHub-only edit becomes visible within this short cache window.
    await env.DRIVE_SYNC_STATE.put('gemini:live-state', JSON.stringify(state), { expirationTtl: 60 });
    return json({ ok: true, data: state }, 200, origin);
  }

  const latest = await ghFetchFile(env.GITHUB_TOKEN, GITHUB_FILE);
  const isPrimaryAdmin = await verifyAdmin(env, payload.adminTokens);
  const googleEmail = isPrimaryAdmin ? '' : await googleEmailForToken(payload.googleToken);
  if (!isPrimaryAdmin && !isGeminiManager(latest.content, googleEmail)) {
    return json({ ok: false, error: 'not-gemini-manager' }, 403, origin);
  }

  const kind = String(payload.kind || '');
  if (kind === 'setPayment') {
    const email = String(payload.email || '').toLowerCase();
    const month = String(payload.month || '');
    const amount = Number(payload.amount);
    if (!isMember(latest.content, email) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(amount) || amount < 0 || amount > 1000000) {
      return json({ ok: false, error: 'bad-gemini-payment' }, 400, origin);
    }
    latest.content.geminiPayments = latest.content.geminiPayments || {};
    latest.content.geminiPayments[email] = latest.content.geminiPayments[email] || {};
    latest.content.geminiPayments[email][month] = amount;
  } else if (kind === 'setCycle') {
    const start = String(payload.start || '');
    const end = String(payload.end || '');
    const fee = Number(payload.fee) || 0;
    const monthOk = (value) => !value || /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
    if (!monthOk(start) || !monthOk(end) || !!start !== !!end || (start && start > end) || fee < 0 || fee > 1000000) {
      return json({ ok: false, error: 'bad-gemini-cycle' }, 400, origin);
    }
    latest.content.geminiCycleStart = start;
    latest.content.geminiCycleEnd = end;
    latest.content.geminiMonthlyFee = fee;
  } else {
    return json({ ok: false, error: 'unknown-gemini-action' }, 400, origin);
  }

  latest.content.updated = new Date().toISOString();
  await ghWriteFile(env.GITHUB_TOKEN, latest.content, latest.sha, GITHUB_FILE, `Update Gemini subscription: ${kind}`);
  const state = geminiSnapshot(latest.content);
  await env.DRIVE_SYNC_STATE.put('gemini:live-state', JSON.stringify(state), { expirationTtl: 60 });
  return json({ ok: true, data: state }, 200, origin);
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

// ── Semester Resources: 24/7 Google Drive mirror ───────────────────────────
// The service account is granted Editor only on DRIVE_ROOT_FOLDER_ID, never on
// the owner's full Drive. State is stored in the DRIVE_SYNC_STATE KV binding.
let driveAccessToken = null;
let driveAccessTokenExpiry = 0;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

function b64url(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64urlBytes(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function pemBytes(pem) {
  const b64 = String(pem || '').replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const raw = atob(b64);
  return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer;
}
async function getDriveAccessToken(env) {
  if (driveAccessToken && Date.now() < driveAccessTokenExpiry) return driveAccessToken;
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !env.DRIVE_ROOT_FOLDER_ID) throw new Error('drive-not-configured');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: DRIVE_SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3500 })}`;
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64urlBytes(new Uint8Array(sig))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const body = await res.json();
  if (!res.ok || !body.access_token) throw new Error('drive-auth-failed');
  driveAccessToken = body.access_token;
  driveAccessTokenExpiry = Date.now() + ((body.expires_in || 3600) - 60) * 1000;
  return driveAccessToken;
}
async function driveRequest(env, method, path, body) {
  const token = await getDriveAccessToken(env);
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error && data.error.message) || `drive-${res.status}`);
  return data;
}
function cleanSegments(folder, semester) {
  const parts = String(folder || '').split('/').map(s => s.trim()).filter(Boolean);
  while (parts.length && (/^my\s*drive$/i.test(parts[0]) || /^semester\s*resources$/i.test(parts[0]) || /^semester\s*\d+$/i.test(parts[0]))) parts.shift();
  return parts.length ? parts : ['General'];
}
async function findFolder(env, parentId, name) {
  const q = `name='${String(name).replace(/'/g, "\\'")}' and mimeType='${DRIVE_FOLDER_MIME}' and '${parentId}' in parents and trashed=false`;
  const data = await driveRequest(env, 'GET', `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`);
  return data.files && data.files[0];
}
async function ensureResourceFolder(env, semester, folder, cache = new Map()) {
  let parent = env.DRIVE_ROOT_FOLDER_ID;
  if (!parent) throw new Error('drive-root-not-configured');
  for (const name of [`Semester ${semester}`, ...cleanSegments(folder, semester)]) {
    const cacheKey = `${parent}:${name}`;
    let child = cache.get(cacheKey);
    if (!child) child = await findFolder(env, parent, name);
    if (!child) child = await driveRequest(env, 'POST', '/files', { name, mimeType: DRIVE_FOLDER_MIME, parents: [parent] });
    cache.set(cacheKey, child);
    parent = child.id;
  }
  return parent;
}
function driveId(item) {
  if (item && item.driveFileId) return item.driveFileId;
  const m = String(item && item.src || '').match(/\/file\/d\/([\w-]+)/);
  return m ? m[1] : '';
}
async function moveDriveFile(env, id, parentId) {
  const meta = await driveRequest(env, 'GET', `/files/${encodeURIComponent(id)}?fields=parents`);
  if ((meta.parents || []).includes(parentId)) return meta;
  const removeParents = (meta.parents || []).join(',');
  const q = `addParents=${encodeURIComponent(parentId)}${removeParents ? `&removeParents=${encodeURIComponent(removeParents)}` : ''}&fields=id,parents`;
  return driveRequest(env, 'PATCH', `/files/${encodeURIComponent(id)}?${q}`, {});
}
async function handleDriveAction(action, payload, env, origin) {
  if (!(await verifyAdmin(env, payload.adminTokens))) return json({ ok: false, error: 'not-admin' }, 401, origin);
  if (!env.DRIVE_SYNC_STATE) return json({ ok: false, error: 'drive-state-not-configured' }, 503, origin);
  if (action === 'driveSyncNow') {
    const data = await syncDriveMirror(env);
    return json({ ok: true, data }, 200, origin);
  }
  const latest = await ghFetchFile(env.GITHUB_TOKEN, 'civil_data.json');
  const data = latest.content;
  data.semesters = data.semesters || {};
  if (action === 'driveBootstrap') {
    const folderCache = new Map();
    for (let semester = 1; semester <= 8; semester++) {
      const list = data.semesters[String(semester)] || [];
      for (const entry of list) {
        const id = driveId(entry);
        if (!id) continue;
        const folderId = await ensureResourceFolder(env, semester, entry.folder, folderCache);
        await moveDriveFile(env, id, folderId);
        entry.driveFileId = id; entry.driveFolderId = folderId; entry.driveManaged = true;
        entry.folder = `Semester ${semester}/${cleanSegments(entry.folder, semester).join('/')}`;
      }
    }
    data.updated = new Date().toISOString();
    await ghWriteFile(env.GITHUB_TOKEN, data, latest.sha, 'civil_data.json', 'Organize Semester Resources in Drive');
    await env.DRIVE_SYNC_STATE.put('semester-resources-active', 'true');
    return json({ ok: true, data }, 200, origin);
  }
  const sem = String(payload.semester || '');
  const items = data.semesters[sem] || [];
  const deleteIds = action === 'driveDelete' ? [payload.id] : (action === 'driveDeleteBatch' ? payload.ids : null);
  if (deleteIds) {
    if (!Array.isArray(deleteIds) || !deleteIds.length) return json({ ok: false, error: 'resource-not-found' }, 404, origin);
    const selected = items.filter(item => deleteIds.includes(item.id));
    if (selected.length !== deleteIds.length) return json({ ok: false, error: 'resource-not-found' }, 404, origin);
    for (const entry of selected) {
      const id = driveId(entry);
      if (!id) return json({ ok: false, error: 'not-a-drive-resource' }, 400, origin);
      await driveRequest(env, 'PATCH', `/files/${encodeURIComponent(id)}`, { trashed: true });
    }
    const selectedIds = new Set(deleteIds);
    data.semesters[sem] = items.filter(item => !selectedIds.has(item.id));
  } else if (action === 'driveMove') {
    const item = items.find(x => x.id === payload.id);
    if (!item) return json({ ok: false, error: 'resource-not-found' }, 404, origin);
    const id = driveId(item);
    if (!id) return json({ ok: false, error: 'not-a-drive-resource' }, 400, origin);
    const targetSem = String(payload.targetSemester || sem);
    if (!/^[1-8]$/.test(targetSem)) return json({ ok: false, error: 'bad-semester' }, 400, origin);
    const targetFolder = cleanSegments(payload.targetFolder, targetSem).join('/');
    const folderId = await ensureResourceFolder(env, targetSem, targetFolder);
    await moveDriveFile(env, id, folderId);
    data.semesters[sem] = items.filter(x => x.id !== item.id);
    const moved = { ...item, driveFileId: id, driveFolderId: folderId, driveManaged: true, folder: `Semester ${targetSem}/${targetFolder}` };
    (data.semesters[targetSem] ||= []).push(moved);
  } else return json({ ok: false, error: 'unknown-drive-action' }, 400, origin);
  data.updated = new Date().toISOString();
  await ghWriteFile(env.GITHUB_TOKEN, data, latest.sha, 'civil_data.json', `Sync Semester Resources: ${action}`);
  return json({ ok: true, data }, 200, origin);
}

async function listDriveChildren(env, parentId) {
  const out = []; let pageToken = '';
  do {
    const data = await driveRequest(env, 'GET', `/files?q=${encodeURIComponent(`'${parentId}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name,mimeType,parents,permissions(type,role))&pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    out.push(...(data.files || [])); pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function syncDriveMirror(env) {
  if (!env.DRIVE_SYNC_STATE || await env.DRIVE_SYNC_STATE.get('semester-resources-active') !== 'true') return;
  const found = [];
  async function walk(parent, semester, segments) {
    for (const f of await listDriveChildren(env, parent)) {
      if (f.mimeType === DRIVE_FOLDER_MIME) {
        const match = !semester && f.name.match(/^semester\s*([1-8])$/i);
        await walk(f.id, match ? match[1] : semester, match ? [] : (semester ? [...segments, f.name] : segments));
      } else if (semester && (f.mimeType === 'application/pdf' || String(f.mimeType).startsWith('image/'))) {
        found.push({ file: f, semester, folder: `Semester ${semester}/${segments.length ? segments.join('/') : 'General'}`, folderId: parent });
      }
    }
  }
  await walk(env.DRIVE_ROOT_FOLDER_ID, '', []);
  const latest = await ghFetchFile(env.GITHUB_TOKEN, 'civil_data.json');
  const data = latest.content; data.semesters = data.semesters || {};
  const before = JSON.stringify(data);
  const byDriveId = new Map();
  Object.values(data.semesters).flat().forEach(item => { const id = driveId(item); if (id) byDriveId.set(id, item); });
  const foundIds = new Set(found.map(x => x.file.id));
  for (let n = 1; n <= 8; n++) data.semesters[n] = (data.semesters[n] || []).filter(item => !item.driveManaged || foundIds.has(driveId(item)));
  for (const hit of found) {
    const old = byDriveId.get(hit.file.id);
    const title = hit.file.name.replace(/\.[^.]+$/, '');
    const item = old || { id: `drv_${hit.file.id}`, desc: '', hidden: false };
    item.title = title; item.type = hit.file.mimeType.startsWith('image/') ? 'image' : 'pdf';
    item.src = `https://drive.google.com/file/d/${hit.file.id}/preview?usp=sharing`;
    item.folder = hit.folder; item.driveFileId = hit.file.id; item.driveFolderId = hit.folderId; item.driveManaged = true;
    for (let n = 1; n <= 8; n++) data.semesters[n] = (data.semesters[n] || []).filter(x => x !== item);
    (data.semesters[hit.semester] ||= []).push(item);
  }
  if (JSON.stringify(data) !== before) {
    data.updated = new Date().toISOString();
    await ghWriteFile(env.GITHUB_TOKEN, data, latest.sha, 'civil_data.json', 'Mirror Semester Resources from Drive');
  }
  return data;
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
      if (action === 'driveDelete' || action === 'driveDeleteBatch' || action === 'driveMove' || action === 'driveBootstrap' || action === 'driveSyncNow') return await handleDriveAction(action, payload, env, origin);
      if (action === 'geminiRead' || action === 'geminiUpdate') return await handleGemini(action, payload, env, origin);
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
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncDriveMirror(env).catch(err => console.error('Drive mirror failed:', err && err.message)));
  },
};
