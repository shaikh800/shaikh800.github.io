path = "research.html"
content = open(path, encoding='utf-8').read()

old = '''    function renderGeminiTab() {
      const months = geminiMonthKeys();
      const cycleBox = document.getElementById('geminiCycleBox');
      const adminWrap = document.getElementById('geminiAdminTableWrap');
      const memberWrap = document.getElementById('geminiMemberView');
      if (!adminWrap || !memberWrap) return;

      if (cycleBox) {
        cycleBox.style.display = role === 'admin' ? 'block' : 'none';
        const sEl = document.getElementById('geminiCycleStartInput');
        const eEl = document.getElementById('geminiCycleEndInput');
        const fEl = document.getElementById('geminiFeeInput');
        if (sEl && !sEl.matches(':focus')) sEl.value = geminiCycleStart;
        if (eEl && !eEl.matches(':focus')) eEl.value = geminiCycleEnd;
        if (fEl && !fEl.matches(':focus')) fEl.value = geminiMonthlyFee || '';
      }

      if (role === 'admin') {
        adminWrap.style.display = 'block';
        memberWrap.style.display = 'none';
        const head = document.getElementById('geminiTableHead');
        head.innerHTML = `<th>Member</th>` + months.map(m => `<th>${esc(m.label)}</th>`).join('') + `<th>Total Due</th>`;
        const body = document.getElementById('geminiTableBody');
        body.innerHTML = members.map(m => {
          const email = (m.email || '').toLowerCase();
          const row = geminiPayments[email] || {};
          let totalDue = 0;
          const cells = months.map(mo => {
            const paid = row[mo.key] || 0;
            const due = Math.max(0, geminiMonthlyFee - paid);
            totalDue += due;
            const cls = geminiMonthlyFee > 0 ? (due <= 0 ? 'on' : (paid > 0 ? 'partial' : '')) : (paid > 0 ? 'on' : '');
            const label = paid > 0 ? `৳${paid}` : '—';
            return `<td style="text-align:center;"><span class="gem-amt ${cls} clickable" onclick="setGeminiAmount('${esc(email)}','${mo.key}')" title="${esc(mo.label)}">${label}</span></td>`;
          }).join('');
          return `<tr>
            <td><div class="member-who"><span class="chat-avatar" style="${m.role==='admin'?'':'background:#10b981;'}">${esc(m.initials||'?')}</span> ${esc(m.name)}</div></td>
            ${cells}
            <td style="text-align:center;font-weight:700;color:${totalDue>0?'#ef4444':'#0f9d58'};">৳${totalDue}</td>
          </tr>`;
        }).join('');
      } else {
        adminWrap.style.display = 'none';
        memberWrap.style.display = 'block';
        renderMemberGeminiView(months);
      }
    }
    function renderMemberGeminiView(months) {
      const email = ((currentUser && currentUser.email) || '').toLowerCase();
      const row = geminiPayments[email] || {};
      let totalDue = 0;
      const rowsHtml = months.map(mo => {
        const paid = row[mo.key] || 0;
        const due = Math.max(0, geminiMonthlyFee - paid);
        totalDue += due;
        const ok = geminiMonthlyFee > 0 ? due <= 0 : paid > 0;
        const paidLabel = geminiMonthlyFee > 0 ? `৳${paid} / ৳${geminiMonthlyFee}` : (paid > 0 ? `৳${paid}` : '—');
        return `<tr>
          <td>${esc(mo.label)}</td>
          <td style="text-align:center;">${paidLabel}</td>
          <td style="text-align:center;"><span class="gem-dot ${ok?'on':''}"><i class="fas ${ok?'fa-check':'fa-xmark'}"></i></span></td>
        </tr>`;
      }).join('');
      const listEl = document.getElementById('geminiMemberTableBody');
      if (listEl) listEl.innerHTML = rowsHtml;

      const dueBanner = document.getElementById('geminiDueBanner');
      const dueBadge  = document.getElementById('geminiDueBadge');
      if (geminiMonthlyFee > 0 && totalDue > 0) {
        if (dueBanner) { dueBanner.style.display = 'flex'; dueBanner.querySelector('.due-amount').textContent = `৳${totalDue}`; }
        if (dueBadge) { dueBadge.style.display = 'inline-flex'; dueBadge.textContent = '!'; }
      } else {
        if (dueBanner) dueBanner.style.display = 'none';
        if (dueBadge) dueBadge.style.display = 'none';
      }
    }'''

new = '''    function renderGeminiTab() {
      const months = geminiMonthKeys();
      const cycleBox = document.getElementById('geminiCycleBox');
      const adminWrap = document.getElementById('geminiAdminTableWrap');
      if (!adminWrap) return;
      const canEdit = role === 'admin';

      if (cycleBox) {
        cycleBox.style.display = canEdit ? 'block' : 'none';
        const sEl = document.getElementById('geminiCycleStartInput');
        const eEl = document.getElementById('geminiCycleEndInput');
        const fEl = document.getElementById('geminiFeeInput');
        if (sEl && !sEl.matches(':focus')) sEl.value = geminiCycleStart;
        if (eEl && !eEl.matches(':focus')) eEl.value = geminiCycleEnd;
        if (fEl && !fEl.matches(':focus')) fEl.value = geminiMonthlyFee || '';
      }

      // Everyone with access sees the full table — admin or member — so no
      // one has to guess who's paid; only admin can tap a cell to edit it.
      const hint = document.getElementById('geminiHint');
      if (hint) hint.textContent = canEdit
        ? "একটা সেলে ক্লিক করে সেই মাসে ওই সদস্য কত টাকা দিয়েছে লিখে দিও।"
        : "Everyone can see who's paid each month — only the admin can edit amounts.";

      const head = document.getElementById('geminiTableHead');
      head.innerHTML = `<th>Member</th>` + months.map(m => `<th>${esc(m.label)}</th>`).join('') + `<th>Total Due</th>`;
      const body = document.getElementById('geminiTableBody');
      let myTotalDue = 0;
      const myEmail = ((currentUser && currentUser.email) || '').toLowerCase();
      body.innerHTML = members.map(m => {
        const email = (m.email || '').toLowerCase();
        const row = geminiPayments[email] || {};
        let totalDue = 0;
        const cells = months.map(mo => {
          const paid = row[mo.key] || 0;
          const due = Math.max(0, geminiMonthlyFee - paid);
          totalDue += due;
          const cls = geminiMonthlyFee > 0 ? (due <= 0 ? 'on' : (paid > 0 ? 'partial' : '')) : (paid > 0 ? 'on' : '');
          const label = paid > 0 ? `৳${paid}` : '—';
          const clickAttr = canEdit ? ` onclick="setGeminiAmount('${esc(email)}','${mo.key}')"` : '';
          return `<td style="text-align:center;"><span class="gem-amt ${cls}${canEdit ? ' clickable' : ''}"${clickAttr} title="${esc(mo.label)}">${label}</span></td>`;
        }).join('');
        if (email === myEmail) myTotalDue = totalDue;
        return `<tr>
          <td><div class="member-who"><span class="chat-avatar" style="${m.role==='admin'?'':'background:#10b981;'}">${esc(m.initials||'?')}</span> ${esc(m.name)}</div></td>
          ${cells}
          <td style="text-align:center;font-weight:700;color:${totalDue>0?'#ef4444':'#0f9d58'};">৳${totalDue}</td>
        </tr>`;
      }).join('');

      const dueBanner = document.getElementById('geminiDueBanner');
      const dueBadge  = document.getElementById('geminiDueBadge');
      if (geminiMonthlyFee > 0 && myTotalDue > 0) {
        if (dueBanner) { dueBanner.style.display = 'flex'; dueBanner.querySelector('.due-amount').textContent = `৳${myTotalDue}`; }
        if (dueBadge) { dueBadge.style.display = 'inline-flex'; dueBadge.textContent = '!'; }
      } else {
        if (dueBanner) dueBanner.style.display = 'none';
        if (dueBadge) dueBadge.style.display = 'none';
      }
    }'''

n = content.count(old)
assert n == 1, n
content = content.replace(old, new, 1)
open(path, 'w', encoding='utf-8').write(content)
print("renderGeminiTab rewritten")
