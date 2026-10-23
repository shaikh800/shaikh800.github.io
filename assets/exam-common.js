/* ══════════════════════════════════════════════════════════════
   ACADEMY — shared helpers for Student Portal, Exam page, Teacher Panel
   • talks to the Google Apps Script backend (exam_gas.js v4)
   • keeps the student / teacher login (signed token, 7 days)
   • makes teacher-written question HTML safe to display
   ══════════════════════════════════════════════════════════════ */
const ACAD_GAS_URL = 'https://script.google.com/macros/s/AKfycbyl1RaM9sL_kHY8_ZBGHKmPnvAbi8PFWw0f4yKezlGiDHQKouaIkdZx8poSrE4jy3jw/exec';

/* ── Sessions ── */
const ACAD_KEYS = { student: 'acad_student_session_v1', teacher: 'acad_teacher_session_v1' };
const acadSession = {
  get(role) {
    try {
      const o = JSON.parse(localStorage.getItem(ACAD_KEYS[role]) || 'null');
      if (o && o.token && Date.now() < (o.expiry || 0)) return o;
    } catch (e) {}
    return null;
  },
  set(role, data) { try { localStorage.setItem(ACAD_KEYS[role], JSON.stringify(data)); } catch (e) {} },
  clear(role) { try { localStorage.removeItem(ACAD_KEYS[role]); } catch (e) {} }
};

/* ── Network ── */
async function acadRaw(payload) {
  const res = await fetch(ACAD_GAS_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain' } });
  return res.json();
}
/* Student call — attaches the student's token. A dead session clears itself. */
async function studentCall(action, payload) {
  const s = acadSession.get('student');
  const out = await acadRaw(Object.assign({ action, token: s ? s.token : '' }, payload || {}));
  if (out && out.status === 'unauthorized') acadSession.clear('student');
  return out;
}
/* Admin session tokens held by this browser (the admin may be acting as a teacher). */
function acadAdminTokens() {
  return (typeof siteAdminTokens === 'function') ? siteAdminTokens() : [];
}
/* Teacher call — uses the teacher's own token, or the admin session if that's who is here. */
async function teacherCall(action, payload) {
  const t = acadSession.get('teacher');
  const tokens = t ? [t.token] : acadAdminTokens();
  if (!tokens.length) return { status: 'unauthorized', message: 'Please log in' };
  let last = null;
  for (const tok of tokens) {
    last = await acadRaw(Object.assign({ action, token: tok }, payload || {}));
    if (!last || last.status !== 'unauthorized') return last;
  }
  if (t) acadSession.clear('teacher');
  return last;
}

/* ── Small utils ── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
}
function fmtClock(sec) {
  sec = Math.max(0, sec | 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = n => (n < 10 ? '0' : '') + n;
  return (h ? h + ':' : '') + p(m) + ':' + p(s);
}
function acadToast(msg, kind) {
  let t = document.getElementById('acad-toast');
  if (!t) { t = document.createElement('div'); t.id = 'acad-toast'; document.body.appendChild(t); }
  t.className = 'acad-toast show ' + (kind || '');
  t.textContent = msg;
  clearTimeout(acadToast._t);
  acadToast._t = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ── Teacher-written HTML → safe HTML ──
   Questions are rich text ($math$, <b>, <img>…). Anything that could run code is removed. */
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString('<div>' + String(html == null ? '' : html) + '</div>', 'text/html');
  const root = doc.body.firstChild;
  root.querySelectorAll('script,iframe,object,embed,link,meta,style,base,form,frame,frameset,applet').forEach(n => n.remove());
  root.querySelectorAll('*').forEach(el => {
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase(), v = String(a.value).trim().toLowerCase();
      if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction') { el.removeAttribute(a.name); continue; }
      if ((n === 'href' || n === 'src' || n === 'xlink:href' || n === 'action') && /^(javascript|vbscript|data:text\/html)/.test(v.replace(/\s+/g, ''))) el.removeAttribute(a.name);
    }
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
  });
  return root.innerHTML;
}

/* ── MathJax (loaded only when a page needs it) ── */
window.MathJax = window.MathJax || {
  tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']] },
  svg: { fontCache: 'none' },
  options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'] }
};
function acadTypeset(el) {
  if (!el) return Promise.resolve();
  if (!/\$|\\\(|\\\[/.test(el.textContent || '')) return Promise.resolve();
  if (!window.__acadMJ) {
    window.__acadMJ = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
      s.async = true;
      s.onload = () => resolve(window.MathJax);
      s.onerror = () => { window.__acadMJ = null; reject(new Error('MathJax failed')); };
      document.head.appendChild(s);
    });
  }
  return window.__acadMJ.then(M => (M.startup && M.startup.promise ? M.startup.promise : Promise.resolve()).then(() => M.typesetPromise([el]))).catch(() => {});
}

/* Question → HTML (same shape the old exam page used: passage, statements, options) */
function renderQuestionBody(q, idx) {
  const stim = q.stim ? `<div class="q-stim">${sanitizeHtml(q.stim)}</div>` : '';
  const st = (q.stmts && q.stmts.length) ? `<div class="q-stmts">${q.stmts.map((x, i) => ['i', 'ii', 'iii'][i] + '. ' + sanitizeHtml(x)).join('<br>')}<br>নিচের কোনটি সঠিক?</div>` : '';
  return `<div class="q-text"><span class="q-no">${idx + 1}.</span> <span class="q-body">${sanitizeHtml(q.q)}</span></div>${stim}${st}`;
}
