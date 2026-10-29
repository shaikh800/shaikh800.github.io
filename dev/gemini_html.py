path = "research.html"
content = open(path, encoding='utf-8').read()

old = '''        <div id="geminiAdminTableWrap" style="display:none;">
          <div style="overflow-x:auto;">
            <table class="member-table gemini-table" id="geminiTable">
              <thead><tr id="geminiTableHead"></tr></thead>
              <tbody id="geminiTableBody"></tbody>
            </table>
          </div>
          <p class="drive-hint" style="margin-top:10px;">একটা সেলে ক্লিক করে সেই মাসে ওই সদস্য কত টাকা দিয়েছে লিখে দিও।</p>
        </div>

        <div id="geminiMemberView" style="display:none;">
          <div id="geminiDueBanner" style="display:none;align-items:center;gap:10px;padding:12px 16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius);margin-bottom:14px;">
            <i class="fas fa-triangle-exclamation" style="color:#ef4444;font-size:18px;"></i>
            <div><b>Due Payment:</b> <span class="due-amount">৳0</span> বাকি আছে — admin-কে জানিয়ে দিও।</div>
          </div>
          <table class="member-table">
            <thead><tr><th>Month</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody id="geminiMemberTableBody"></tbody>
          </table>
        </div>
      </div>'''

new = '''        <div id="geminiDueBanner" style="display:none;align-items:center;gap:10px;padding:12px 16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius);margin-bottom:14px;">
          <i class="fas fa-triangle-exclamation" style="color:#ef4444;font-size:18px;"></i>
          <div><b>Due Payment:</b> <span class="due-amount">৳0</span> বাকি আছে — admin-কে জানিয়ে দিও।</div>
        </div>

        <div id="geminiAdminTableWrap">
          <div style="overflow-x:auto;">
            <table class="member-table gemini-table" id="geminiTable">
              <thead><tr id="geminiTableHead"></tr></thead>
              <tbody id="geminiTableBody"></tbody>
            </table>
          </div>
          <p class="drive-hint" style="margin-top:10px;" id="geminiHint">Everyone can see who's paid. Click a cell to mark it (admin only).</p>
        </div>
      </div>'''

n = content.count(old)
assert n == 1, n
content = content.replace(old, new, 1)
open(path, 'w', encoding='utf-8').write(content)
print("html updated")
