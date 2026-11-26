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

/* ── In-page confirmations ──
   Native browser confirm boxes can be hard to read on some dark system themes.
   Keep consequential Academy actions inside the same accessible, themed dialog. */
function acadConfirm(options) {
  const o = typeof options === 'string' ? { message: options } : (options || {});
  return new Promise(resolve => {
    let modal = document.getElementById('acad-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'acad-confirm-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="acad-confirm-title" style="max-width:430px;">
          <div class="modal-hd">
            <h3 id="acad-confirm-title"><i id="acad-confirm-icon" class="fas fa-circle-exclamation" style="color:#b45309;"></i> Confirm action</h3>
            <button class="modal-close" type="button" aria-label="Close" data-acad-confirm-cancel><i class="fas fa-times"></i></button>
          </div>
          <p id="acad-confirm-message" style="margin:6px 0 22px;line-height:1.7;white-space:pre-line;color:var(--muted);"></p>
          <div class="row" style="justify-content:flex-end;">
            <button class="btn secondary" type="button" data-acad-confirm-cancel>Cancel</button>
            <button class="btn danger" type="button" id="acad-confirm-ok">Continue</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    if (typeof acadConfirm._finish === 'function') acadConfirm._finish(false);
    const title = modal.querySelector('#acad-confirm-title');
    const icon = modal.querySelector('#acad-confirm-icon');
    const message = modal.querySelector('#acad-confirm-message');
    const accept = modal.querySelector('#acad-confirm-ok');
    title.lastChild.textContent = ' ' + (o.title || 'Confirm action');
    icon.className = 'fas ' + (o.danger ? 'fa-triangle-exclamation' : 'fa-circle-exclamation');
    icon.style.color = o.danger ? '#dc2626' : '#b45309';
    message.textContent = o.message || 'Are you sure you want to continue?';
    accept.textContent = o.confirmLabel || (o.danger ? 'Delete' : 'Continue');
    accept.className = 'btn ' + (o.danger ? 'danger' : 'primary');

    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      modal.classList.remove('open');
      modal.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      if (acadConfirm._finish === finish) acadConfirm._finish = null;
      resolve(result);
    };
    const onClick = e => {
      if (e.target === modal || e.target.closest('[data-acad-confirm-cancel]')) finish(false);
      else if (e.target.closest('#acad-confirm-ok')) finish(true);
    };
    const onKey = e => { if (e.key === 'Escape') finish(false); };
    acadConfirm._finish = finish;
    modal.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    modal.classList.add('open');
    requestAnimationFrame(() => accept.focus());
  });
}

/* ── Teacher-written HTML → safe HTML ──
   Questions are rich text ($math$, <b>, <img>…). Anything that could run code is removed. */
function sanitizeHtml(html) {
  /* Keep TeX comparison symbols as text.  Without this, HTML parsing can read
     `x<y` inside `$...$` as an unfinished tag before MathJax gets it. */
  const maths = [];
  const source = String(html == null ? '' : html).replace(
    /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\.|[^$\n])+?\$/g,
    match => {
      const key = '@@ACAD_MATH_' + maths.length + '@@';
      maths.push(match.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      return key;
    }
  );
  const doc = new DOMParser().parseFromString('<div>' + source + '</div>', 'text/html');
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
  return root.innerHTML.replace(/@@ACAD_MATH_(\d+)@@/g, (_, i) => maths[Number(i)] || '');
}

/* ── MathJax (loaded only when a page needs it) ── */
window.MathJax = window.MathJax || {
  tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']], processEscapes: true },
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
