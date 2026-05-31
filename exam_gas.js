// ════════════════════════════════════════════════════════════════
//  Online Exam System & Academy Portal — Google Apps Script [v3.1]
//  by shaikh800 | mdshaikh.me
// ════════════════════════════════════════════════════════════════

const RESULTS_SHEET  = 'Results';
const STUDENTS_SHEET = 'Students';
const LOG_SHEET      = 'Log';
const USERS_SHEET    = 'Users';

// ── 🔐 Security Token ──
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
      // -- Student Authentication & Profile --
      case 'checkMobile':          result = checkMobile(body);          break;
      case 'register':             result = register(body);             break;
      case 'login':                result = login(body);                break;
      case 'requestProfileUpdate': result = requestProfileUpdate(body); break;
      case 'requestPasswordReset': result = requestPasswordReset(body); break;
      
      // -- Exams & Results --
      case 'submit':               result = submitResult(body);         break;
      case 'getResults':           result = getResults(body);           break;
      case 'getAllResults':        result = getAllResults(body);        break;
      case 'getStudentResults':    result = getStudentResults(body);    break;
      
      // -- Admin Controls --
      case 'adminGetStudents':           result = adminGetStudents(body);           break;
      case 'adminApproveProfile':        result = adminApproveProfile(body);        break;
      case 'adminRejectProfile':         result = adminRejectProfile(body);         break;
      case 'adminResetPassword':         result = adminResetPassword(body);         break;
      case 'adminDeleteStudent':         result = adminDeleteStudent(body);         break;
      case 'adminDeleteStudentResults':  result = adminDeleteStudentResults(body);  break;
      case 'clearData':                  result = clearData(body);                  break;
      case 'clearExamData':              result = clearExamData(body);              break;
      
      // Legacy (Kept for compatibility)
      case 'updateStudents':       result = updateStudents(body);       break;
      
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

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', message: 'Academy GAS is running v3.1 ✅', time: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
}

function requireAdminToken(body) {
  if (!body.token || body.token !== ADMIN_TOKEN) {
    return { authorized: false, error: { status: 'error', message: 'Unauthorized: invalid token' } };
  }
  return { authorized: true };
}

// ════════════════════════════════════════
//  STUDENT AUTHENTICATION & PROFILE
// ════════════════════════════════════════

function normalizeMobile(m) {
  const digits = String(m || '').replace(/\D/g, ''); 
  return digits.length === 10 ? '0' + digits : digits; 
}

function ensureUsersHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'Name', 'Mobile', 'Password', 'School', 'Class', 'PendingUpdate', 'ResetRequest', 'Time']);
    const hRange = sheet.getRange(1, 1, 1, 9);
    hRange.setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
  } else {
    // Legacy upgrade support (Fill missing headers)
    const headers = sheet.getRange(1, 1, 1, 9).getValues()[0];
    if (!headers[3]) sheet.getRange(1, 4).setValue('Password');
    if (!headers[4]) sheet.getRange(1, 5).setValue('School');
    if (!headers[5]) sheet.getRange(1, 6).setValue('Class');
    if (!headers[6]) sheet.getRange(1, 7).setValue('PendingUpdate');
    if (!headers[7]) sheet.getRange(1, 8).setValue('ResetRequest');
    if (!headers[8]) sheet.getRange(1, 9).setValue('Time');
  }
}

function checkMobile(body) {
  const mobile = normalizeMobile(body.mobile);
  if (!mobile) return { status: 'error', message: 'Mobile required' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  ensureUsersHeader(sheet);

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeMobile(data[i][2]) === mobile) {
      return {
        status: 'success',
        found: true,
        id: data[i][0],
        name: String(data[i][1]).trim(),
        school: String(data[i][4] || '').trim(),
        studentClass: String(data[i][5] || '').trim()
      };
    }
  }
  return { status: 'success', found: false };
}

function register(body) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { status: 'error', message: 'Server busy' }; }

  try {
    const mobile = normalizeMobile(body.mobile);
    const name = String(body.name || '').trim();
    const password = String(body.password || '').trim();
    const school = String(body.school || '').trim();
    const studentClass = String(body.studentClass || '').trim();
    const time = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

    if (!name || !mobile || !password) {
      return { status: 'error', message: 'নাম, মোবাইল এবং পাসওয়ার্ড আবশ্যক' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, USERS_SHEET);
    ensureUsersHeader(sheet);

    const data = sheet.getDataRange().getValues();
    let maxId = 100;

    for (let i = 1; i < data.length; i++) {
      const rowId = Number(data[i][0]);
      if (rowId > maxId) maxId = rowId;
      if (normalizeMobile(data[i][2]) === mobile) {
        return { status: 'error', message: 'এই নম্বরে ইতিমধ্যে অ্যাকাউন্ট রয়েছে!' };
      }
    }

    const newId = maxId + 1;
    // Columns: ID, Name, Mobile, Password, School, Class, PendingUpdate, ResetRequest, Time
    sheet.appendRow([newId, name, `'${mobile}`, password, school, studentClass, '', '', time]);
    logActivity('register', `${newId} | ${name} | ${mobile}`);
    
    return { status: 'success', id: newId, name, school, studentClass, message: 'Registration successful' };
  } finally {
    lock.releaseLock();
  }
}

function login(body) {
  const mobile = normalizeMobile(body.mobile);
  const password = String(body.password || '').trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalizeMobile(data[i][2]) === mobile) {
      const storedPass = String(data[i][3] || '').trim();
      if (storedPass === password) {
        return { 
          status: 'success', 
          id: data[i][0], 
          name: data[i][1], 
          school: data[i][4], 
          studentClass: data[i][5] 
        };
      } else {
        return { status: 'error', message: 'পাসওয়ার্ড ভুল হয়েছে!' };
      }
    }
  }
  return { status: 'error', message: 'অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };
}

function requestProfileUpdate(body) {
  const id = String(body.id || '').trim();
  const updateData = JSON.stringify({
    name: body.name || '',
    school: body.school || '',
    studentClass: body.studentClass || ''
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === id) {
      sheet.getRange(i + 1, 7).setValue(updateData); // Col 7 = PendingUpdate
      return { status: 'success', message: 'Update request sent to admin' };
    }
  }
  return { status: 'error', message: 'User not found' };
}

function requestPasswordReset(body) {
  const mobile = normalizeMobile(body.mobile);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalizeMobile(data[i][2]) === mobile) {
      sheet.getRange(i + 1, 8).setValue('Requested'); // Col 8 = ResetRequest
      return { status: 'success', message: 'Password reset request sent to admin' };
    }
  }
  return { status: 'error', message: 'Mobile number not found' };
}

// ════════════════════════════════════════
//  ADMIN CONTROLS
// ════════════════════════════════════════

function adminGetStudents(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  ensureUsersHeader(sheet);
  
  const data = sheet.getDataRange().getValues();
  const students = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    students.push({
      id: data[i][0],
      name: data[i][1],
      mobile: data[i][2],
      school: data[i][4],
      studentClass: data[i][5],
      pendingUpdate: data[i][6] ? JSON.parse(data[i][6]) : null,
      resetRequest: data[i][7] === 'Requested'
    });
  }
  return { status: 'success', students };
}

function adminApproveProfile(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const id = String(body.id).trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === id) {
      const pendingRaw = data[i][6];
      if (pendingRaw) {
        const req = JSON.parse(pendingRaw);
        if (req.name) sheet.getRange(i + 1, 2).setValue(req.name);
        if (req.school) sheet.getRange(i + 1, 5).setValue(req.school);
        if (req.studentClass) sheet.getRange(i + 1, 6).setValue(req.studentClass);
        sheet.getRange(i + 1, 7).clearContent(); // Clear pending
        return { status: 'success', message: 'Profile approved' };
      }
    }
  }
  return { status: 'error', message: 'Request not found' };
}

function adminRejectProfile(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const id = String(body.id).trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === id) {
      sheet.getRange(i + 1, 7).clearContent();
      return { status: 'success', message: 'Profile request rejected' };
    }
  }
  return { status: 'error', message: 'User not found' };
}

function adminResetPassword(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const id = String(body.id).trim();
  const newPass = String(body.newPassword).trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === id) {
      sheet.getRange(i + 1, 4).setValue(newPass);
      sheet.getRange(i + 1, 8).clearContent(); // Clear ResetRequest
      return { status: 'success', message: 'Password updated' };
    }
  }
  return { status: 'error', message: 'User not found' };
}

function adminDeleteStudent(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const id = String(body.id).trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === id) {
      sheet.deleteRow(i + 1);
      
      // Optionally delete results for this student
      if (body.deleteResults) {
        const resSheet = ss.getSheetByName(RESULTS_SHEET);
        if (resSheet) {
          const rData = resSheet.getDataRange().getValues();
          for (let j = rData.length - 1; j >= 1; j--) {
            if (String(rData[j][1]).trim() === id) {
              resSheet.deleteRow(j + 1);
            }
          }
        }
      }
      return { status: 'success', message: 'Student deleted' };
    }
  }
  return { status: 'error', message: 'Student not found' };
}

// ════════════════════════════════════════
//  ADMIN: DELETE STUDENT RESULTS ONLY
// ════════════════════════════════════════

function adminDeleteStudentResults(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const id = String(body.id || '').trim();
  if (!id) return { status: 'error', message: 'Student ID আবশ্যক' };

  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const resSheet = ss.getSheetByName(RESULTS_SHEET);

  if (!resSheet || resSheet.getLastRow() <= 1) {
    return { status: 'success', message: '0 results deleted (sheet empty)', deleted: 0 };
  }

  const rData    = resSheet.getDataRange().getValues();
  const toDelete = [];

  // Bottom-up to avoid row-shift issues after each delete
  for (let j = rData.length - 1; j >= 1; j--) {
    if (String(rData[j][1]).trim() === id) {
      toDelete.push(j + 1); // 1-based
    }
  }

  toDelete.forEach(rowNum => resSheet.deleteRow(rowNum));
  logActivity('adminDeleteStudentResults', 'ID: ' + id + ' | ' + toDelete.length + ' rows deleted');

  return {
    status:  'success',
    message: toDelete.length + ' টি result মুছে ফেলা হয়েছে (account অক্ষত)',
    deleted: toDelete.length
  };
}

// ════════════════════════════════════════
//  EXAMS & RESULTS (Existing code preserved)
// ════════════════════════════════════════

function submitResult(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, RESULTS_SHEET);
  ensureResultsHeader(sheet);

  const id = String(body.id || '').trim();
  const name = String(body.name || '').trim();
  const score = body.score !== undefined ? Number(body.score) : 0;
  const topic = String(body.topic || '').trim();
  const examId = String(body.examId || '').trim();
  const details = String(body.details || '').trim();
  const time = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });

  if (!id || !name || !topic) return { status: 'error', message: 'Missing fields' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === id && String(data[i][5]).trim() === examId) {
      sheet.getRange(i + 1, 5).setValue(score);
      sheet.getRange(i + 1, 7).setValue(details);
      sheet.getRange(i + 1, 8).setValue(time);
      return { status: 'success', message: 'Result updated' };
    }
  }

  const serial = sheet.getLastRow(); 
  sheet.appendRow([serial, id, name, topic, score, examId, details, time]);
  return { status: 'success', message: 'Result saved' };
}

function getResults(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', results: [] };

  const topic = String(body.topic || '').trim();
  const examId = String(body.examId || '').trim();
  const data = sheet.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const match = (topic && String(data[i][3]).trim() === topic) || (examId && String(data[i][5]).trim() === examId);
    if (match) {
      results.push({ id: data[i][1], name: data[i][2], topic: data[i][3], score: data[i][4], examId: data[i][5], details: data[i][6], time: data[i][7] });
    }
  }
  return { status: 'success', results };
}

function getAllResults(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', results: [] };

  const data = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1]) results.push({ id: data[i][1], name: data[i][2], topic: data[i][3], score: data[i][4], examId: data[i][5], details: data[i][6], time: data[i][7] });
  }
  return { status: 'success', results };
}

function getStudentResults(body) {
  const studentId = String(body.studentId || '').trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', results: [] };

  const data = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === studentId) {
      results.push({ id: data[i][1], name: data[i][2], topic: data[i][3], score: data[i][4], examId: data[i][5], details: data[i][6], time: data[i][7] });
    }
  }
  return { status: 'success', results };
}

// ════════════════════════════════════════
//  CLEANUP & UTILS
// ════════════════════════════════════════

function clearData(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = [RESULTS_SHEET, STUDENTS_SHEET, LOG_SHEET]; // Does not touch USERS_SHEET

  allSheets.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  });
  return { status: 'success', message: 'Logs and Results cleared' };
}

function clearExamData(body) {
  const auth = requireAdminToken(body);
  if (!auth.authorized) return auth.error;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', message: 'Nothing to clear' };

  const examId = String(body.examId || '').trim();
  const data = sheet.getDataRange().getValues();
  const toDelete = [];

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][5]).trim() === examId) toDelete.push(i + 1);
  }
  toDelete.forEach(r => sheet.deleteRow(r));
  return { status: 'success', message: `${toDelete.length} results deleted` };
}

function updateStudents(body) {
  // Legacy function - keeping to avoid breaking old exam_controller immediately
  return { status: 'success', message: `Legacy endpoint bypassed.` };
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureResultsHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    const header = ['#', 'Student ID', 'Name', 'Topic', 'Score', 'Exam ID', 'Details', 'Submitted At'];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function logActivity(action, detail) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, LOG_SHEET);
    if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'Action', 'Detail']);
    sheet.appendRow([new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' }), action, detail]);
  } catch (e) {}
}

function logError(fn, msg) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, LOG_SHEET);
    if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'Action', 'Detail']);
    sheet.appendRow([new Date().toISOString(), '❌ ERROR in ' + fn, msg]);
  } catch (e) {}
}
