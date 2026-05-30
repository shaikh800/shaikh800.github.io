// ════════════════════════════════════════════════════════════════
//  Online Exam System — Google Apps Script  [FIXED v2.1]
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
const ADMIN_TOKEN = 'shaikh_fec_secure_2026';


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
      case 'getAllResults':  result = getAllResults(body);      break;  
      case 'updateStudents': result = updateStudents(body);    break;
      case 'clearData':      result = clearData(body);         break;
      case 'clearExamData':  result = clearExamData(body);     break;
      case 'checkMobile':    result = checkMobile(body);       break;
      case 'register':       result = registerStudent(body);   break;
      case 'getStudentResults': result = getStudentResults(body); break;  
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
// ════════════════════════════════════════
function requireAdminToken(body) {
  if (!body.token || body.token !== ADMIN_TOKEN) {
    return { authorized: false, error: { status: 'error', message: 'Unauthorized: invalid or missing token' } };
  }
  return { authorized: true };
}


// ════════════════════════════════════════
//  1. SUBMIT — পরীক্ষার result জমা
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

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === id && String(data[i][5]).trim() === examId) {
      sheet.getRange(i + 1, 5).setValue(score);
      sheet.getRange(i + 1, 7).setValue(details);
      sheet.getRange(i + 1, 8).setValue(time);
      return { status: 'success', message: 'Result updated (duplicate)' };
    }
  }

  const serial = sheet.getLastRow(); 
  sheet.appendRow([serial, id, name, topic, score, examId, details, time]);

  logActivity('submit', `${id} | ${name} | ${topic} | ${score}`);
  return { status: 'success', message: 'Result saved' };
}


// ════════════════════════════════════════
//  2. GET RESULTS — এক exam-এর result
// ════════════════════════════════════════
function getResults(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', results: [] };

  const topic  = String(body.topic  || '').trim();
  const examId = String(body.examId || '').trim();

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
    const rowExamId = String(data[i][0]).trim();
    const rowTopic  = String(data[i][1]).trim();
    if (rowExamId === examId && rowTopic === topic) {
      toDelete.push(i + 1);
    }
  }
  
  toDelete.forEach(r => sheet.deleteRow(r));

  const time = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  students.forEach(sid => {
    sheet.appendRow([examId, topic, String(sid).trim(), time]);
  });

  logActivity('updateStudents', `${examId} | ${students.length} students`);
  return { status: 'success', message: `${students.length} students synced` };
}


// ════════════════════════════════════════
//  5. CLEAR DATA — A to Z সব কিছু মুছো
// ════════════════════════════════════════
function clearData(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // সব sheet-এর নাম — Users সহ সব কিছু clear হবে
  const allSheets = [RESULTS_SHEET, STUDENTS_SHEET, 'Users', LOG_SHEET];
  let cleared = [];

  allSheets.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // Header (Row 1) রেখে বাকি সব data মুছে ফেলো
    if (lastRow > 1 && lastCol > 0) {
      sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    }
    cleared.push(sheetName);
  });

  // সবার শেষে Log-এ একটা entry রাখো
  logActivity('clearData', 'All data cleared safely ✅ Sheets: ' + cleared.join(', '));
  return { status: 'success', message: 'All data cleared from: ' + cleared.join(', ') };
}


// ════════════════════════════════════════
//  6. CLEAR EXAM DATA — একটি exam-এর result মুছো
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
    
    if (topic && examId && rowTopic === topic && rowExamId === examId) {
      toDelete.push(i + 1);
    } else if (!examId && topic && rowTopic === topic) {
      toDelete.push(i + 1);
    } else if (!topic && examId && rowExamId === examId) {
      toDelete.push(i + 1);
    }
  }

  toDelete.forEach(r => sheet.deleteRow(r));
  logActivity('clearExamData', `${topic || examId} | ${toDelete.length} rows deleted`);
  return { status: 'success', message: `${toDelete.length} results deleted` };
}


// ════════════════════════════════════════
//  9. CHECK MOBILE — নম্বর আছে কিনা চেক করো
// ════════════════════════════════════════
function checkMobile(body) {
  const mobile = String(body.mobile || '').trim();

  if (!mobile) {
    return { status: 'error', message: 'mobile দিতে হবে' };
  }

  if (!/^01[3-9]\d{8}$/.test(mobile)) {
    return { status: 'error', message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)' };
  }

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');

  if (!sheet || sheet.getLastRow() <= 1) {
    return { status: 'success', found: false };
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowMobile = normalizeMobile(data[i][2]);
    if (rowMobile === normalizeMobile(mobile)) {
      return {
        status: 'success',
        found:  true,
        id:     data[i][0],
        name:   String(data[i][1]).trim()
      };
    }
  }

  return { status: 'success', found: false };
}


// ════════════════════════════════════════
//  MOBILE NORMALIZE HELPER
//  Google Sheets leading zero বাদ দিয়ে number হিসেবে store করে।
//  এই function দুই দিকেই normalize করে compare করার জন্য।
// ════════════════════════════════════════
function normalizeMobile(m) {
  const digits = String(m || '').replace(/\D/g, ''); // শুধু সংখ্যা রাখো
  return digits.length === 10 ? '0' + digits : digits; // 10 digit হলে '0' যোগ করো
}


// ════════════════════════════════════════
//  7. REGISTER STUDENT
// ════════════════════════════════════════
function registerStudent(body) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
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

    // Mobile column (C) কে Text format করো — typed column হলে skip
    try { sheet.getRange('C:C').setNumberFormat('@STRING@'); } catch(e) {}

    const name   = String(body.name   || '').trim();
    const mobile = String(body.mobile || '').trim();
    const time   = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

    if (!name || !mobile) {
      return { status: 'error', message: 'Name এবং Mobile দুটোই দরকার' };
    }

    if (!/^01[3-9]\d{8}$/.test(mobile)) {
      return { status: 'error', message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)' };
    }

    const data  = sheet.getDataRange().getValues();
    let maxId   = 100;

    for (let i = 1; i < data.length; i++) {
      const rowId     = Number(data[i][0]);
      const rowMobile = normalizeMobile(data[i][2]); // ← normalize করে compare

      if (rowId > maxId) maxId = rowId;

      if (rowMobile === normalizeMobile(mobile)) { // ← দুই দিকেই normalize
        if (String(data[i][1]).trim() !== name) {
          sheet.getRange(i + 1, 2).setValue(name);
        }
        return { status: 'success', id: rowId, message: 'Already registered' };
      }
    }

    const newId = maxId + 1;
    sheet.appendRow([newId, name, String(mobile), time]); // mobile সবসময় text

    logActivity('register', `${newId} | ${name} | ${mobile}`);
    return { status: 'success', id: newId, message: 'New ID generated' };

  } finally {
    lock.releaseLock(); 
  }
}


// ════════════════════════════════════════
//  8. GET STUDENT RESULTS
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
