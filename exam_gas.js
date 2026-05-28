// ════════════════════════════════════════════════════════════════
//  Online Exam System — Google Apps Script  [FIXED v2.0]
//  by shaikh800 | mdshaikh.me
//
//  Deploy করার নিয়ম:
//  1. script.google.com → New Project → এই কোড paste করুন
//  2. Deploy → New deployment → Web app
//     Execute as: Me | Who has access: Anyone
//  3. URL কপি করে model_test.html ও exam_controller.html-এ দিন
//
//  ⚠️ IMPORTANT: ADMIN_TOKEN পরিবর্তন করুন deploy করার আগে!
// ════════════════════════════════════════════════════════════════

// ── Sheet Names ──
const RESULTS_SHEET  = 'Results';
const STUDENTS_SHEET = 'Students';
const LOG_SHEET      = 'Log';

// ── 🔐 Security Token ──
// এই token টি exam_controller.html-এ ADMIN_TOKEN হিসেবে দিতে হবে
// যেকোনো random string দিন, যেমন: 'fec_exam_2025_secure'
const ADMIN_TOKEN = 'CHANGE_THIS_SECRET_TOKEN';


// ════════════════════════════════════════
//  MAIN ENTRY POINT
// ════════════════════════════════════════
function doPost(e) {
  const res = ContentService.createTextOutput();
  res.setMimeType(ContentService.MimeType.JSON);

  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || '';
    let result;

    switch (action) {
      case 'submit':         result = submitResult(body);      break;
      case 'getResults':     result = getResults(body);        break;
      case 'getAllResults':  result = getAllResults(body);      break;  // FIX 5: token required
      case 'updateStudents': result = updateStudents(body);    break;
      case 'clearData':      result = clearData(body);         break;
      case 'clearExamData':  result = clearExamData(body);     break;
      case 'register':            result = registerStudent(body);       break;
      case 'getStudentResults':   result = getStudentResults(body);     break;  // student portal-এর জন্য (token লাগবে না)
      default:
        result = { status: 'error', message: 'Unknown action: ' + action };
    }

    res.setContent(JSON.stringify(result));
  } catch (err) {
    logError('doPost', err.message);
    res.setContent(JSON.stringify({ status: 'error', message: err.message }));
  }

  return res;
}

// GET — health check only
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', message: 'Exam GAS is running ✅', time: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
}


// ════════════════════════════════════════
//  🔐 AUTH HELPER
//  FIX 1: Destructive/sensitive actions এ token check
// ════════════════════════════════════════
function requireAdminToken(body) {
  if (!body.token || body.token !== ADMIN_TOKEN) {
    return { authorized: false, error: { status: 'error', message: 'Unauthorized: invalid or missing token' } };
  }
  return { authorized: true };
}


// ════════════════════════════════════════
//  1. SUBMIT — পরীক্ষার result জমা
//  Body: { action, id, name, score, topic, examId, details }
// ════════════════════════════════════════
function submitResult(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, RESULTS_SHEET);

  ensureResultsHeader(sheet);

  const id      = String(body.id    || '').trim();
  const name    = String(body.name  || '').trim();
  const score   = body.score !== undefined ? Number(body.score) : 0;
  const topic   = String(body.topic   || '').trim();
  const examId  = String(body.examId  || '').trim();
  const details = String(body.details || '').trim();
  const time    = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

  if (!id || !name || !topic) {
    return { status: 'error', message: 'id, name, topic — সবগুলো দরকার' };
  }

  const data = sheet.getDataRange().getValues();

  // Duplicate check — same id + same examId (উভয় match করতে হবে)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === id && String(data[i][5]).trim() === examId) {
      sheet.getRange(i + 1, 5).setValue(score);
      sheet.getRange(i + 1, 7).setValue(details);
      sheet.getRange(i + 1, 8).setValue(time);
      return { status: 'success', message: 'Result updated (duplicate)' };
    }
  }

  // FIX 4: সঠিক serial — data row count থেকে (header বাদে)
  const serial = sheet.getLastRow(); // header = row 1, পরেরটা থেকে count শুরু

  sheet.appendRow([serial, id, name, topic, score, examId, details, time]);

  logActivity('submit', `${id} | ${name} | ${topic} | ${score}`);
  return { status: 'success', message: 'Result saved' };
}


// ════════════════════════════════════════
//  2. GET RESULTS — এক exam-এর result
//  Body: { action, topic, examId }
//  (Public — student নিজের result দেখতে পারবে)
// ════════════════════════════════════════
function getResults(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', results: [] };

  const topic  = String(body.topic  || '').trim();
  const examId = String(body.examId || '').trim();

  // FIX 5: topic বা examId না দিলে empty return — সব dump হবে না
  if (!topic && !examId) {
    return { status: 'error', message: 'topic অথবা examId দিতে হবে' };
  }

  const data = sheet.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row       = data[i];
    const rowTopic  = String(row[3] || '').trim();
    const rowExamId = String(row[5] || '').trim();

    const match =
      (topic  && rowTopic  === topic)  ||
      (examId && rowExamId === examId);

    if (match) {
      results.push({
        id:      row[1],
        name:    row[2],
        topic:   row[3],
        score:   row[4],
        examId:  row[5],
        details: row[6],
        time:    row[7]
      });
    }
  }

  return { status: 'success', results };
}


// ════════════════════════════════════════
//  3. GET ALL RESULTS — সব exam-এর result
//  FIX 1+5: Admin token required
//  Body: { action, token }
// ════════════════════════════════════════
function getAllResults(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', results: [] };

  const data    = sheet.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue;
    results.push({
      id:      row[1],
      name:    row[2],
      topic:   row[3],
      score:   row[4],
      examId:  row[5],
      details: row[6],
      time:    row[7]
    });
  }

  return { status: 'success', results };
}


// ════════════════════════════════════════
//  4. UPDATE STUDENTS — candidate list sync
//  FIX 1: Admin token required
//  FIX 3: OR → AND (overly broad delete ঠিক করা)
//  Body: { action, token, examId, topic, students: ['101','102',...] }
// ════════════════════════════════════════
function updateStudents(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, STUDENTS_SHEET);

  const examId   = String(body.examId || '').trim();
  const topic    = String(body.topic  || '').trim();
  const students = Array.isArray(body.students) ? body.students : [];

  if (!examId) return { status: 'error', message: 'examId দিতে হবে' };

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ExamId', 'Topic', 'StudentId', 'Added']);
  }

  const data     = sheet.getDataRange().getValues();
  const toDelete = [];

  for (let i = data.length - 1; i >= 1; i--) {
    // FIX 3: OR → AND — দুটোই match করতে হবে, নাহলে অন্য exam-এর data মুছে যাবে
    const rowExamId = String(data[i][0]).trim();
    const rowTopic  = String(data[i][1]).trim();
    if (rowExamId === examId && rowTopic === topic) {
      toDelete.push(i + 1);
    }
  }
  // toDelete already descending order এ আছে (loop উপর থেকে নিচে গেছে)
  toDelete.forEach(r => sheet.deleteRow(r));

  const time = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  students.forEach(sid => {
    sheet.appendRow([examId, topic, String(sid).trim(), time]);
  });

  logActivity('updateStudents', `${examId} | ${students.length} students`);
  return { status: 'success', message: `${students.length} students synced` };
}


// ════════════════════════════════════════
//  5. CLEAR DATA — সব result মুছো
//  FIX 1: Admin token required
//  Body: { action, token }
// ════════════════════════════════════════
function clearData(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const rSheet = ss.getSheetByName(RESULTS_SHEET);
  if (rSheet) {
    rSheet.clearContents();
    ensureResultsHeader(rSheet);
  }

  const sSheet = ss.getSheetByName(STUDENTS_SHEET);
  if (sSheet) sSheet.clearContents();

  logActivity('clearData', 'All data cleared');
  return { status: 'success', message: 'All data cleared' };
}


// ════════════════════════════════════════
//  6. CLEAR EXAM DATA — একটি exam-এর result মুছো
//  FIX 1: Admin token required
//  Body: { action, token, topic, examId }
// ════════════════════════════════════════
function clearExamData(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', message: 'Nothing to clear' };

  const topic  = String(body.topic  || '').trim();
  const examId = String(body.examId || '').trim();

  if (!topic && !examId) {
    return { status: 'error', message: 'topic অথবা examId দিতে হবে' };
  }

  const data     = sheet.getDataRange().getValues();
  const toDelete = [];

  for (let i = data.length - 1; i >= 1; i--) {
    const rowTopic  = String(data[i][3] || '').trim();
    const rowExamId = String(data[i][5] || '').trim();
    if ((topic && rowTopic === topic) || (examId && rowExamId === examId)) {
      toDelete.push(i + 1);
    }
  }

  toDelete.forEach(r => sheet.deleteRow(r));
  logActivity('clearExamData', `${topic || examId} | ${toDelete.length} rows deleted`);
  return { status: 'success', message: `${toDelete.length} results deleted` };
}


// ════════════════════════════════════════
//  7. REGISTER STUDENT (Auto 3-digit ID)
//  FIX 2: LockService দিয়ে race condition ঠিক করা
//  Body: { action, name, mobile }
// ════════════════════════════════════════
function registerStudent(body) {
  // FIX 2: Script-level lock — concurrent registration এ same ID পাবে না
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10 second পর্যন্ত অপেক্ষা করবে
  } catch (e) {
    return { status: 'error', message: 'Server busy, আবার চেষ্টা করুন' };
  }

  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, 'Users');

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['ID', 'Name', 'Mobile', 'Time']);
      const hRange = sheet.getRange(1, 1, 1, 4);
      hRange.setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
    }

    const name   = String(body.name   || '').trim();
    const mobile = String(body.mobile || '').trim();
    const time   = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

    if (!name || !mobile) {
      return { status: 'error', message: 'Name এবং Mobile দুটোই দরকার' };
    }

    // Mobile number validation (Bangladesh — 11 digit)
    if (!/^01[3-9]\d{8}$/.test(mobile)) {
      return { status: 'error', message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)' };
    }

    const data  = sheet.getDataRange().getValues();
    let maxId   = 100;

    for (let i = 1; i < data.length; i++) {
      const rowId     = Number(data[i][0]);
      const rowMobile = String(data[i][2]).trim();

      if (rowId > maxId) maxId = rowId;

      if (rowMobile === mobile) {
        // আগে থেকে registered — name update করে পুরনো ID ফেরত দাও
        if (String(data[i][1]).trim() !== name) {
          sheet.getRange(i + 1, 2).setValue(name);
        }
        return { status: 'success', id: rowId, message: 'Already registered' };
      }
    }

    const newId = maxId + 1;
    sheet.appendRow([newId, name, mobile, time]);

    logActivity('register', `${newId} | ${name} | ${mobile}`);
    return { status: 'success', id: newId, message: 'New ID generated' };

  } finally {
    lock.releaseLock(); // lock সবসময় release করতে হবে
  }
}


// ════════════════════════════════════════
//  8. GET STUDENT RESULTS — একজন student-এর সব result
//  Student Portal-এর জন্য — token লাগবে না
//  Body: { action, studentId }
// ════════════════════════════════════════
function getStudentResults(body) {
  const studentId = String(body.studentId || '').trim();
  if (!studentId) return { status: 'error', message: 'studentId দিতে হবে' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', results: [] };

  const data    = sheet.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[1] || '').trim() === studentId) {
      results.push({
        id:      row[1],
        name:    row[2],
        topic:   row[3],
        score:   row[4],
        examId:  row[5],
        details: row[6],
        time:    row[7]
      });
    }
  }

  return { status: 'success', results };
}


// ════════════════════════════════════════
//  HELPER FUNCTIONS
// ════════════════════════════════════════

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureResultsHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    const header = ['#', 'Student ID', 'Name', 'Topic', 'Score', 'Exam ID', 'Details', 'Submitted At'];
    sheet.appendRow(header);

    const hRange = sheet.getRange(1, 1, 1, header.length);
    hRange.setBackground('#0f172a');
    hRange.setFontColor('#ffffff');
    hRange.setFontWeight('bold');
    hRange.setFontSize(11);

    sheet.setColumnWidth(1, 40);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 200);
    sheet.setColumnWidth(5, 70);
    sheet.setColumnWidth(6, 130);
    sheet.setColumnWidth(7, 350);
    sheet.setColumnWidth(8, 160);
    sheet.setFrozenRows(1);
  }
}

function logActivity(action, detail) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, LOG_SHEET);
    if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'Action', 'Detail']);
    sheet.appendRow([new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' }), action, detail]);
  } catch (e) {}
}

function logError(fn, msg) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, LOG_SHEET);
    if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'Action', 'Detail']);
    sheet.appendRow([new Date().toISOString(), '❌ ERROR in ' + fn, msg]);
  } catch (e) {}
}


// ════════════════════════════════════════
//  TEST FUNCTIONS (browser থেকে manually run করুন)
// ════════════════════════════════════════

function testSubmit() {
  const result = submitResult({
    action: 'submit',
    id: '101',
    name: 'Test Student',
    score: 25,
    topic: 'Model Test 1',
    examId: 'ex_test123',
    details: 'Q3 ভুল, Q7 এড়ানো'
  });
  Logger.log(JSON.stringify(result));
}

function testGetResults() {
  const result = getResults({ topic: 'Model Test 1' });
  Logger.log(JSON.stringify(result));
}

function testGetAll() {
  // token ছাড়া কাজ করবে না
  const result = getAllResults({ token: ADMIN_TOKEN });
  Logger.log(JSON.stringify(result));
}

function testClear() {
  // token ছাড়া কাজ করবে না
  const result = clearData({ token: ADMIN_TOKEN });
  Logger.log(JSON.stringify(result));
}

function testRegister() {
  const result = registerStudent({ name: 'Shaikh Alam', mobile: '01700000000' });
  Logger.log(JSON.stringify(result));
}
