// ════════════════════════════════════════════════════════════════
//  Online Exam System & Academy Portal — Google Apps Script [v4.0]
//  by shaikh800 | mdshaikh.me
// ════════════════════════════════════════════════════════════════

const RESULTS_SHEET  = 'Results';
const STUDENTS_SHEET = 'Students';
const LOG_SHEET      = 'Log';
const USERS_SHEET    = 'Users';

// ── 🔐 Admin Auth — password GAS Script Properties-এ থাকে (admin_password key)
//    Hardcoded token সম্পূর্ণ সরানো হয়েছে।

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
      
      // -- Admin Auth (session-based) --
      case 'adminLogin':                 result = adminLogin(body);                 break;
      case 'adminVerify':                result = adminVerifySession(body);         break;

      // -- Admin Controls --
      case 'adminGetStudents':           result = adminGetStudents(body);           break;
      case 'adminApproveProfile':        result = adminApproveProfile(body);        break;
      case 'adminRejectProfile':         result = adminRejectProfile(body);         break;
      case 'adminResetPassword':         result = adminResetPassword(body);         break;
      case 'adminDeleteStudent':         result = adminDeleteStudent(body);         break;
      case 'adminDeleteStudentResults':  result = adminDeleteStudentResults(body);  break;
      case 'clearData':                  result = clearData(body);                  break;
      case 'clearExamData':              result = clearExamData(body);              break;
      
      // -- v4: teachers --
      case 'teacherRegister':      result = teacherRegister(body);      break;
      case 'teacherLogin':         result = teacherLogin(body);         break;
      case 'teacherRequestReset':  result = teacherRequestReset(body);  break;
      case 'teacherMe':            result = teacherMe(body);            break;
      case 'adminListTeachers':    result = adminListTeachers(body);    break;
      case 'adminTeacherOp':       result = adminTeacherOp(body);       break;
      case 'adminImportExams':     result = adminImportExams(body);     break;

      // -- v4: student <-> teacher --
      case 'listTeachers':         result = listTeachers(body);         break;
      case 'applyTeacher':         result = applyTeacher(body);         break;
      case 'leaveTeacher':         result = leaveTeacher(body);         break;
      case 'teacherStudents':      result = teacherStudents(body);      break;
      case 'teacherLink':          result = teacherLink(body);          break;

      // -- v4: exams --
      case 'teacherExams':         result = teacherExams(body);         break;
      case 'teacherExamGet':       result = teacherExamGet(body);       break;
      case 'teacherExamSave':      result = teacherExamSave(body);      break;
      case 'teacherExamLive':      result = teacherExamLive(body);      break;
      case 'teacherExamDelete':    result = teacherExamDelete(body);    break;
      case 'teacherDeleteResult':  result = teacherDeleteResult(body);  break;
      case 'studentExams':         result = studentExams(body);         break;
      case 'examInfo':             result = examInfo(body);             break;
      case 'examStart':            result = examStart(body);            break;
      case 'examSave':             result = examSave(body);             break;
      case 'examSubmit':           result = examSubmit(body);           break;
      case 'examReview':           result = examReview(body);           break;
      case 'examRanking':          result = examRanking(body);          break;
      case 'myResults':            result = myResults(body);            break;

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
    JSON.stringify({ status: 'ok', message: 'Academy GAS is running v4.0 ✅', time: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════
//  ADMIN AUTH — SESSION BASED
// ════════════════════════════════════════

/**
 * Admin login — password Script Properties-এ থাকে (admin_password key)।
 * সফল হলে 4 ঘণ্টার session token return করে।
 */
function adminLogin(body) {
  const pw        = body.password || '';
  const correctPw = PropertiesService.getScriptProperties().getProperty('admin_password');

  if (!correctPw || pw !== correctPw) {
    return { status: 'error', message: 'ভুল পাসওয়ার্ড' };
  }

  const token  = Utilities.getUuid();
  const expiry = Date.now() + (4 * 60 * 60 * 1000);  // 4 ঘণ্টা

  PropertiesService.getScriptProperties().setProperty('admin_session_token',  token);
  PropertiesService.getScriptProperties().setProperty('admin_session_expiry', String(expiry));

  return { status: 'success', token: token, expiry: expiry };
}

/**
 * Session token জীবিত আছে কিনা check করে।
 */
function adminVerifySession(body) {
  return { status: 'success', valid: verifyAdmin(body) };
}

/**
 * সব admin action-এর আগে এই function দিয়ে token verify হয়।
 * Token ভুল বা মেয়াদ শেষ হলে false return করে।
 */
function verifyAdmin(body) {
  const token = body.token || '';
  if (!token) return false;

  const stored = PropertiesService.getScriptProperties().getProperty('admin_session_token');
  const expiry = PropertiesService.getScriptProperties().getProperty('admin_session_expiry');

  return (stored === token) && (Date.now() < parseInt(expiry || '0'));
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
    
    const tk = signToken_({ r: 's', id: String(newId) });
    return { status: 'success', id: newId, name, school, studentClass, token: tk.token, expiry: tk.expiry, message: 'Registration successful' };
  } finally {
    lock.releaseLock();
  }
}

function login(body) {
  const mobile = normalizeMobile(body.mobile);
  const password = String(body.password || '').trim();
  const tkey = 's_' + mobile;
  if (throttled_(tkey)) return { status: 'error', message: 'বেশি ভুল চেষ্টা হয়েছে — ১০ মিনিট পর আবার চেষ্টা করুন' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalizeMobile(data[i][2]) === mobile) {
      const storedPass = String(data[i][3] || '').trim();
      if (storedPass === password) {
        throttleClear_(tkey);
        const tk = signToken_({ r: 's', id: String(data[i][0]) });
        return {
          status: 'success',
          id: data[i][0],
          name: data[i][1],
          school: data[i][4],
          studentClass: data[i][5],
          token: tk.token,
          expiry: tk.expiry
        };
      } else {
        throttleFail_(tkey);
        return { status: 'error', message: 'পাসওয়ার্ড ভুল হয়েছে!' };
      }
    }
  }
  return { status: 'error', message: 'অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };
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
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

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
      password: data[i][3],
      school: data[i][4],
      studentClass: data[i][5],
      pendingUpdate: data[i][6] ? JSON.parse(data[i][6]) : null,
      resetRequest: data[i][7] === 'Requested'
    });
  }
  return { status: 'success', students };
}

function adminApproveProfile(body) {
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

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
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

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
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

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
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

  const id = String(body.id).trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === id) {
      sheet.deleteRow(i + 1);

      // v4: remove this student's teacher links and unfinished attempts
      try {
        const ls = linksSheet_(); const lr = rows_(ls);
        for (let k = lr.length - 1; k >= 0; k--) if (String(lr[k][0]) === id) ls.deleteRow(k + 2);
        const at = attemptsSheet_(); const ar = rows_(at);
        for (let k = ar.length - 1; k >= 0; k--) if (String(ar[k][1]) === id) at.deleteRow(k + 2);
      } catch (e) {}
      
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
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

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
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) return { status: 'success', results: [] };

  const data = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1]) results.push({ id: data[i][1], name: data[i][2], topic: data[i][3], score: data[i][4], examId: data[i][5], details: data[i][6], time: data[i][7], teacherId: data[i][8] || '', total: data[i][10] || '' });
  }
  return { status: 'success', results };
}

function getStudentResults(body) {
  const a = actor_(body);
  if (!a) return UNAUTH_;
  const studentId = a.role === 'student' ? a.id : String(body.studentId || '').trim();
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
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

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
  if (!verifyAdmin(body)) return { status: 'unauthorized', message: 'Unauthorized' };

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

// ════════════════════════════════════════════════════════════════
//  v4 — TEACHERS · STUDENT↔TEACHER LINKS · SERVER-SIDE EXAMS
//
//  Roles
//    admin    = the site owner (also acts as a teacher with id "admin")
//    teacher  = signs up → admin approves → builds exams, approves students
//    student  = signs up → applies to teachers → teacher approves
//
//  Exams live on the server: students never receive the correct answers
//  until they have submitted. Scoring, ranking and the A-Z review are all
//  computed here.
// ════════════════════════════════════════════════════════════════

const TEACHERS_SHEET = 'Teachers';
const LINKS_SHEET    = 'Links';
const EXAMS_SHEET    = 'Exams';
const EXAMQ_SHEET    = 'ExamQ';
const ATTEMPTS_SHEET = 'Attempts';

const TEACHER_HEADER = ['ID', 'Name', 'Mobile', 'PassHash', 'Subject', 'Institution', 'Status', 'Time', 'ResetRequest'];
const LINK_HEADER    = ['StudentID', 'TeacherID', 'Status', 'Time'];
const EXAM_HEADER    = ['ExamID', 'TeacherID', 'Title', 'Code', 'DurationMin', 'Live', 'AllowMode', 'AllowedIds', 'QCount', 'Created', 'Updated', 'Meta'];
const EXAMQ_HEADER   = ['ExamID', 'Chunk', 'Json'];
const ATTEMPT_HEADER = ['ExamID', 'StudentID', 'StartedAt', 'Status', 'AnswersJson', 'SavedAt'];

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // student / teacher login lasts 7 days
const SUBMIT_GRACE_MS = 2 * 60 * 1000;            // network slack after the timer hits zero
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ── Sheets ───────────────────────────────────────────────────────
function v4Sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  let created = false;
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.getRange(1, 1, 1, header.length).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
    sh.setFrozenRows(1);
    created = true;
  }
  return { sh: sh, created: created };
}
function rows_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
}
function teachersSheet_() { return v4Sheet_(TEACHERS_SHEET, TEACHER_HEADER).sh; }
function examsSheet_()    { return v4Sheet_(EXAMS_SHEET, EXAM_HEADER).sh; }
function examQSheet_()    { return v4Sheet_(EXAMQ_SHEET, EXAMQ_HEADER).sh; }
function attemptsSheet_() { return v4Sheet_(ATTEMPTS_SHEET, ATTEMPT_HEADER).sh; }
function linksSheet_() {
  const r = v4Sheet_(LINKS_SHEET, LINK_HEADER);
  if (r.created) {
    // One-time migration: every student that existed before v4 belongs to the admin.
    const users = getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(), USERS_SHEET);
    const data = rows_(users);
    const now = Date.now();
    const out = [];
    data.forEach(function (u) { if (u[0]) out.push([String(u[0]), 'admin', 'approved', now]); });
    if (out.length) r.sh.getRange(2, 1, out.length, 4).setValues(out);
  }
  return r.sh;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { status: 'error', message: 'Server busy — try again' }; }
  try { return fn(); } finally { lock.releaseLock(); }
}

// ── Signed session tokens (stateless — work on every device) ──────
function secret_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('session_secret');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('session_secret', s); }
  return s;
}
function signToken_(obj) {
  obj.exp = Date.now() + SESSION_TTL_MS;
  const p = Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(obj)).getBytes());
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p, secret_()));
  return { token: p + '.' + sig, expiry: obj.exp };
}
function readToken_(tok) {
  if (!tok || typeof tok !== 'string') return null;
  const parts = tok.split('.');
  if (parts.length !== 2) return null;
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret_()));
  if (sig !== parts[1]) return null;
  try {
    const obj = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!obj.exp || Date.now() > obj.exp) return null;
    return obj;
  } catch (e) { return null; }
}

// ── Login throttling (5 wrong passwords → 10 minute pause) ───────
function throttled_(key) {
  return parseInt(CacheService.getScriptCache().get('thr_' + key) || '0', 10) >= 5;
}
function throttleFail_(key) {
  const c = CacheService.getScriptCache();
  c.put('thr_' + key, String(parseInt(c.get('thr_' + key) || '0', 10) + 1), 600);
}
function throttleClear_(key) { CacheService.getScriptCache().remove('thr_' + key); }

// ── Password hashing for teachers ─────────────────────────────────
function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function hashPw_(pw, salt) {
  salt = salt || Utilities.getUuid().slice(0, 8);
  return salt + '$' + hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw));
}
function checkPw_(pw, stored) {
  stored = String(stored || '');
  const i = stored.indexOf('$');
  if (i < 1) return false;
  return hashPw_(pw, stored.slice(0, i)) === stored;
}

// ── Who is calling? ──────────────────────────────────────────────
function adminName_() {
  return PropertiesService.getScriptProperties().getProperty('admin_display_name') || 'Md. Shaikh Alam';
}
function findTeacher_(id) {
  const data = rows_(teachersSheet_());
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return { row: i + 2, v: data[i] };
  }
  return null;
}
let TNAMES_ = null;                       // per-request memo (each doPost is a fresh run)
function teacherName_(id) {
  if (String(id) === 'admin') return adminName_();
  if (!TNAMES_) { TNAMES_ = {}; rows_(teachersSheet_()).forEach(function (r) { TNAMES_[String(r[0])] = String(r[1]); }); }
  return TNAMES_[String(id)] || 'Unknown';
}
function findStudent_(id) {
  const data = rows_(getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(), USERS_SHEET));
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(id).trim()) {
      return { row: i + 2, id: data[i][0], name: String(data[i][1]), mobile: normalizeMobile(data[i][2]), school: String(data[i][4] || ''), cls: String(data[i][5] || '') };
    }
  }
  return null;
}
// → { role:'admin'|'teacher'|'student', id, name } or null
function actor_(body) {
  if (verifyAdmin(body)) return { role: 'admin', id: 'admin', name: adminName_() };
  const p = readToken_(body.token);
  if (!p) return null;
  if (p.r === 't') {
    const t = findTeacher_(p.id);
    if (!t || String(t.v[6]) !== 'approved') return null;
    return { role: 'teacher', id: String(t.v[0]), name: String(t.v[1]) };
  }
  if (p.r === 's') {
    const s = findStudent_(p.id);
    if (!s) return null;
    return { role: 'student', id: String(s.id), name: s.name };
  }
  return null;
}
function needTeacher_(body) {            // admin or approved teacher
  const a = actor_(body);
  return (a && (a.role === 'admin' || a.role === 'teacher')) ? a : null;
}
function needStudent_(body) {
  const a = actor_(body);
  return (a && a.role === 'student') ? a : null;
}
const UNAUTH_ = { status: 'unauthorized', message: 'Session expired — please log in again' };

// ════════════════════════════════════════
//  TEACHER ACCOUNTS
// ════════════════════════════════════════
function teacherRegister(body) {
  const name = String(body.name || '').trim();
  const mobile = normalizeMobile(body.mobile);
  const password = String(body.password || '');
  const subject = String(body.subject || '').trim();
  const institution = String(body.institution || '').trim();
  if (!name || !mobile || !password) return { status: 'error', message: 'নাম, মোবাইল ও পাসওয়ার্ড আবশ্যক' };
  if (password.length < 4) return { status: 'error', message: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে' };
  return withLock_(function () {
    const sh = teachersSheet_();
    const data = rows_(sh);
    let maxN = 0;
    for (let i = 0; i < data.length; i++) {
      if (normalizeMobile(data[i][2]) === mobile) return { status: 'error', message: 'এই নম্বরে ইতিমধ্যে শিক্ষক অ্যাকাউন্ট আছে' };
      const n = parseInt(String(data[i][0]).replace(/\D/g, ''), 10);
      if (n > maxN) maxN = n;
    }
    const id = 'T' + (maxN + 1);
    sh.appendRow([id, name, "'" + mobile, hashPw_(password), subject, institution, 'pending', Date.now(), '']);
    logActivity('teacherRegister', id + ' | ' + name + ' | ' + mobile);
    return { status: 'success', id: id, message: 'আবেদন জমা হয়েছে — অ্যাডমিন অনুমোদন করলে লগইন করতে পারবেন' };
  });
}

function teacherLogin(body) {
  const mobile = normalizeMobile(body.mobile);
  const password = String(body.password || '');
  const tkey = 't_' + mobile;
  if (throttled_(tkey)) return { status: 'error', message: 'বেশি ভুল চেষ্টা হয়েছে — ১০ মিনিট পর আবার চেষ্টা করুন' };
  const data = rows_(teachersSheet_());
  for (let i = 0; i < data.length; i++) {
    if (normalizeMobile(data[i][2]) !== mobile) continue;
    if (!checkPw_(password, data[i][3])) { throttleFail_(tkey); return { status: 'error', message: 'পাসওয়ার্ড ভুল হয়েছে!' }; }
    throttleClear_(tkey);
    const st = String(data[i][6]);
    if (st === 'pending')   return { status: 'pending', message: 'আপনার অ্যাকাউন্ট এখনও অ্যাডমিনের অনুমোদনের অপেক্ষায় আছে' };
    if (st === 'rejected')  return { status: 'error', message: 'আপনার আবেদন গ্রহণ করা হয়নি' };
    if (st !== 'approved')  return { status: 'error', message: 'অ্যাকাউন্টটি বর্তমানে বন্ধ আছে' };
    const t = signToken_({ r: 't', id: String(data[i][0]) });
    return { status: 'success', token: t.token, expiry: t.expiry, teacher: teacherPublic_(data[i]) };
  }
  return { status: 'error', message: 'এই নম্বরে শিক্ষক অ্যাকাউন্ট নেই' };
}
function teacherPublic_(r) {
  return { id: String(r[0]), name: String(r[1]), mobile: normalizeMobile(r[2]), subject: String(r[4] || ''), institution: String(r[5] || ''), status: String(r[6]) };
}
function teacherRequestReset(body) {
  const mobile = normalizeMobile(body.mobile);
  const sh = teachersSheet_();
  const data = rows_(sh);
  for (let i = 0; i < data.length; i++) {
    if (normalizeMobile(data[i][2]) === mobile) { sh.getRange(i + 2, 9).setValue('Requested'); return { status: 'success', message: 'রিসেট অনুরোধ অ্যাডমিনকে পাঠানো হয়েছে' }; }
  }
  return { status: 'error', message: 'এই নম্বরে শিক্ষক অ্যাকাউন্ট নেই' };
}
function teacherMe(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  if (a.role === 'admin') return { status: 'success', role: 'admin', teacher: { id: 'admin', name: adminName_(), subject: '', institution: '', status: 'approved' } };
  return { status: 'success', role: 'teacher', teacher: teacherPublic_(findTeacher_(a.id).v) };
}

// ── Admin: manage teachers ───────────────────────────────────────
function adminListTeachers(body) {
  if (!verifyAdmin(body)) return UNAUTH_;
  const data = rows_(teachersSheet_());
  const links = rows_(linksSheet_());
  const exams = rows_(examsSheet_());
  const out = data.map(function (r) {
    const id = String(r[0]);
    return Object.assign(teacherPublic_(r), {
      resetRequest: String(r[8]) === 'Requested',
      time: Number(r[7]) || 0,
      students: links.filter(function (l) { return String(l[1]) === id && String(l[2]) === 'approved'; }).length,
      pendingStudents: links.filter(function (l) { return String(l[1]) === id && String(l[2]) === 'pending'; }).length,
      exams: exams.filter(function (e) { return String(e[1]) === id; }).length
    });
  });
  return { status: 'success', teachers: out, adminName: adminName_() };
}
function adminTeacherOp(body) {
  if (!verifyAdmin(body)) return UNAUTH_;
  const id = String(body.id || '');
  const op = String(body.op || '');
  return withLock_(function () {
    const sh = teachersSheet_();
    const t = findTeacher_(id);
    if (!t) return { status: 'error', message: 'Teacher not found' };
    if (op === 'approve')  { sh.getRange(t.row, 7).setValue('approved'); return { status: 'success', message: 'Approved' }; }
    if (op === 'reject')   { sh.getRange(t.row, 7).setValue('rejected'); return { status: 'success', message: 'Rejected' }; }
    if (op === 'suspend')  { sh.getRange(t.row, 7).setValue('suspended'); return { status: 'success', message: 'Suspended' }; }
    if (op === 'resetPassword') {
      const np = String(body.newPassword || '');
      if (np.length < 4) return { status: 'error', message: 'কমপক্ষে ৪ অক্ষর' };
      sh.getRange(t.row, 4).setValue(hashPw_(np));
      sh.getRange(t.row, 9).clearContent();
      return { status: 'success', message: 'Password updated' };
    }
    if (op === 'delete') {
      sh.deleteRow(t.row);
      // Their students go back to nobody; their exams stay but become admin's so nothing is lost.
      const ex = examsSheet_(); const er = rows_(ex);
      for (let i = 0; i < er.length; i++) if (String(er[i][1]) === id) ex.getRange(i + 2, 2).setValue('admin');
      const ls = linksSheet_(); const lr = rows_(ls);
      for (let j = lr.length - 1; j >= 0; j--) if (String(lr[j][1]) === id) ls.deleteRow(j + 2);
      return { status: 'success', message: 'Deleted (exams moved to admin)' };
    }
    return { status: 'error', message: 'Unknown op' };
  });
}

// ════════════════════════════════════════
//  STUDENT ↔ TEACHER LINKS
// ════════════════════════════════════════
function allLinks_() {
  return rows_(linksSheet_()).map(function (r, i) {
    return { row: i + 2, studentId: String(r[0]), teacherId: String(r[1]), status: String(r[2]), time: Number(r[3]) || 0 };
  });
}
function findLink_(studentId, teacherId) {
  const all = allLinks_();
  for (let i = 0; i < all.length; i++) if (all[i].studentId === String(studentId) && all[i].teacherId === String(teacherId)) return all[i];
  return null;
}
function isApproved_(studentId, teacherId) {
  const l = findLink_(studentId, teacherId);
  return !!(l && l.status === 'approved');
}

// Students see a list of approved teachers (no phone numbers)
function listTeachers(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  const links = allLinks_().filter(function (l) { return l.studentId === a.id; });
  const stat = {};
  links.forEach(function (l) { stat[l.teacherId] = l.status; });
  const list = [{ id: 'admin', name: adminName_(), subject: PropertiesService.getScriptProperties().getProperty('admin_subject') || '', institution: '', link: stat['admin'] || '' }];
  rows_(teachersSheet_()).forEach(function (r) {
    if (String(r[6]) === 'approved') list.push({ id: String(r[0]), name: String(r[1]), subject: String(r[4] || ''), institution: String(r[5] || ''), link: stat[String(r[0])] || '' });
  });
  return { status: 'success', teachers: list };
}
function applyTeacher(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  const tid = String(body.teacherId || '');
  if (tid !== 'admin') {
    const t = findTeacher_(tid);
    if (!t || String(t.v[6]) !== 'approved') return { status: 'error', message: 'Teacher not found' };
  }
  return withLock_(function () {
    const sh = linksSheet_();
    const l = findLink_(a.id, tid);
    if (l) {
      if (l.status === 'approved') return { status: 'error', message: 'আপনি ইতিমধ্যে এই শিক্ষকের স্টুডেন্ট' };
      if (l.status === 'pending')  return { status: 'error', message: 'আবেদন ইতিমধ্যে পাঠানো হয়েছে — অপেক্ষা করুন' };
      sh.getRange(l.row, 3, 1, 2).setValues([['pending', Date.now()]]);   // rejected → apply again
    } else {
      sh.appendRow([a.id, tid, 'pending', Date.now()]);
    }
    return { status: 'success', message: 'আবেদন পাঠানো হয়েছে' };
  });
}
function leaveTeacher(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  return withLock_(function () {
    const l = findLink_(a.id, String(body.teacherId || ''));
    if (l) linksSheet_().deleteRow(l.row);
    return { status: 'success' };
  });
}

// Teacher: my students
function teacherStudents(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  const all = a.role === 'admin' && body.scope === 'all';
  const users = {};
  rows_(getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(), USERS_SHEET)).forEach(function (u) {
    if (u[0]) users[String(u[0])] = { name: String(u[1]), mobile: normalizeMobile(u[2]), school: String(u[4] || ''), cls: String(u[5] || '') };
  });
  const out = [];
  allLinks_().forEach(function (l) {
    if (!all && l.teacherId !== a.id) return;
    const u = users[l.studentId];
    if (!u) return;
    out.push({ studentId: l.studentId, teacherId: l.teacherId, teacherName: all ? teacherName_(l.teacherId) : undefined, status: l.status, time: l.time, name: u.name, mobile: u.mobile, school: u.school, studentClass: u.cls });
  });
  return { status: 'success', students: out };
}
function teacherLink(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  const tid = (a.role === 'admin' && body.teacherId) ? String(body.teacherId) : a.id;
  const sid = String(body.studentId || '');
  const op = String(body.op || '');
  return withLock_(function () {
    const sh = linksSheet_();
    const l = findLink_(sid, tid);
    if (!l) return { status: 'error', message: 'Not found' };
    if (op === 'approve') { sh.getRange(l.row, 3, 1, 2).setValues([['approved', Date.now()]]); return { status: 'success' }; }
    if (op === 'reject')  { sh.getRange(l.row, 3, 1, 2).setValues([['rejected', Date.now()]]); return { status: 'success' }; }
    if (op === 'remove')  { sh.deleteRow(l.row); return { status: 'success' }; }
    return { status: 'error', message: 'Unknown op' };
  });
}

// ════════════════════════════════════════
//  EXAMS
// ════════════════════════════════════════
function examFromRow_(r, row) {
  let allowed = [];
  try { allowed = JSON.parse(r[7] || '[]'); } catch (e) {}
  let meta = {};
  try { meta = JSON.parse(r[11] || '{}'); } catch (e) {}
  return {
    row: row, id: String(r[0]), teacherId: String(r[1] || 'admin'), title: String(r[2]), code: String(r[3]).toUpperCase(),
    durationMin: Number(r[4]) || 30, live: String(r[5]).toUpperCase() === 'TRUE', allowMode: String(r[6] || 'approved'),
    allowedIds: allowed.map(String), qCount: Number(r[8]) || 0, created: Number(r[9]) || 0, updated: Number(r[10]) || 0, meta: meta
  };
}
function allExams_() {
  return rows_(examsSheet_()).map(function (r, i) { return examFromRow_(r, i + 2); }).filter(function (e) { return e.id; });
}
function getExam_(id) {
  const all = allExams_();
  for (let i = 0; i < all.length; i++) if (all[i].id === String(id)) return all[i];
  return null;
}
function getExamByCode_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  const all = allExams_();
  for (let i = 0; i < all.length; i++) if (all[i].code === code) return all[i];
  return null;
}
function newCode_(existing) {
  for (let t = 0; t < 50; t++) {
    let c = '';
    for (let i = 0; i < 6; i++) c += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    if (existing.indexOf(c) === -1) return c;
  }
  return 'X' + Date.now().toString(36).toUpperCase().slice(-5);
}
function newExamId_() { return 'ex_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function saveQuestions_(examId, qs) {
  const sh = examQSheet_();
  const data = rows_(sh);
  for (let i = data.length - 1; i >= 0; i--) if (String(data[i][0]) === String(examId)) sh.deleteRow(i + 2);
  const json = JSON.stringify(qs);
  const out = [];
  for (let i = 0, n = 0; i < json.length || n === 0; i += 40000, n++) out.push([String(examId), n, json.substr(i, 40000)]);
  sh.getRange(sh.getLastRow() + 1, 1, out.length, 3).setValues(out);
  CacheService.getScriptCache().remove('q_' + examId);
}
function loadQuestions_(examId) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('q_' + examId);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const parts = rows_(examQSheet_()).filter(function (r) { return String(r[0]) === String(examId); })
    .sort(function (a, b) { return Number(a[1]) - Number(b[1]); });
  if (!parts.length) return [];
  const json = parts.map(function (r) { return String(r[2]); }).join('');
  try {
    const qs = JSON.parse(json);
    if (json.length < 90000) cache.put('q_' + examId, json, 21600);
    return qs;
  } catch (e) { return []; }
}
function cleanQuestions_(list) {
  if (!Array.isArray(list) || !list.length) return { error: 'কমপক্ষে ১টি প্রশ্ন দিন' };
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const q = list[i] || {};
    const text = String(q.q || '').trim();
    const opts = (q.opts || []).map(function (o) { return String(o == null ? '' : o).trim(); });
    const ans = parseInt(q.ans, 10);
    if (!text) return { error: 'প্রশ্ন ' + (i + 1) + ': প্রশ্নের লেখা নেই' };
    if (opts.length < 2 || opts.some(function (o) { return !o; })) return { error: 'প্রশ্ন ' + (i + 1) + ': সব অপশন পূরণ করুন' };
    if (!(ans >= 0 && ans < opts.length)) return { error: 'প্রশ্ন ' + (i + 1) + ': সঠিক উত্তর বাছাই করুন' };
    const item = { q: text, opts: opts, ans: ans };
    if (q.stim) item.stim = String(q.stim);
    if (Array.isArray(q.stmts) && q.stmts.length) item.stmts = q.stmts.map(String);
    if (q.exp) item.exp = String(q.exp);
    out.push(item);
  }
  return { questions: out };
}
function examMetaOut_(e, extra) {
  return Object.assign({ id: e.id, title: e.title, code: e.code, durationMin: e.durationMin, live: e.live, allowMode: e.allowMode,
    allowedIds: e.allowedIds, qCount: e.qCount, teacherId: e.teacherId, teacherName: teacherName_(e.teacherId), created: e.created, updated: e.updated }, extra || {});
}

// ── Teacher: exam CRUD ───────────────────────────────────────────
function teacherExams(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  const all = a.role === 'admin' && body.scope === 'all';
  const resCount = {};
  resultRows_().forEach(function (r) { resCount[r.examId] = (resCount[r.examId] || 0) + 1; });
  const out = allExams_().filter(function (e) { return all || e.teacherId === a.id; })
    .sort(function (x, y) { return y.created - x.created; })
    .map(function (e) { return examMetaOut_(e, { participants: resCount[e.id] || 0 }); });
  return { status: 'success', exams: out };
}
function ownExam_(a, examId) {
  const e = getExam_(examId);
  if (!e) return { err: { status: 'error', message: 'Exam not found' } };
  if (a.role !== 'admin' && e.teacherId !== a.id) return { err: { status: 'error', message: 'এটি আপনার পরীক্ষা নয়' } };
  return { exam: e };
}
function teacherExamGet(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  const o = ownExam_(a, body.examId);
  if (o.err) return o.err;
  return { status: 'success', exam: examMetaOut_(o.exam), questions: loadQuestions_(o.exam.id) };
}
function teacherExamSave(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  const x = body.exam || {};
  const title = String(x.title || '').trim();
  const dur = parseInt(x.durationMin, 10);
  if (!title) return { status: 'error', message: 'পরীক্ষার নাম দিন' };
  if (!(dur >= 1 && dur <= 600)) return { status: 'error', message: 'সময় ১–৬০০ মিনিটের মধ্যে দিন' };
  const cq = cleanQuestions_(x.questions);
  if (cq.error) return { status: 'error', message: cq.error };
  const mode = x.allowMode === 'selected' ? 'selected' : 'approved';
  const allowed = mode === 'selected' ? (x.allowedIds || []).map(String) : [];
  if (mode === 'selected' && !allowed.length) return { status: 'error', message: 'অন্তত একজন স্টুডেন্ট বাছাই করুন (অথবা "সব অনুমোদিত স্টুডেন্ট" দিন)' };

  return withLock_(function () {
    const sh = examsSheet_();
    const now = Date.now();
    if (x.id) {
      const o = ownExam_(a, x.id);
      if (o.err) return o.err;
      const e = o.exam;
      const resultsExist = resultRows_().some(function (r) { return r.examId === e.id; });
      if (resultsExist && !body.force) {
        const old = loadQuestions_(e.id);
        if (JSON.stringify(old.map(function (q) { return [q.opts.length, q.ans]; })) !== JSON.stringify(cq.questions.map(function (q) { return [q.opts.length, q.ans]; }))) {
          return { status: 'error', code: 'has-results', message: 'এই পরীক্ষায় ইতিমধ্যে ফলাফল আছে। প্রশ্ন/উত্তর বদলালে পুরনো ফলাফল মিলবে না।' };
        }
      }
      sh.getRange(e.row, 3, 1, 1).setValue(title);
      sh.getRange(e.row, 5).setValue(dur);
      sh.getRange(e.row, 7, 1, 2).setValues([[mode, JSON.stringify(allowed)]]);
      sh.getRange(e.row, 9).setValue(cq.questions.length);
      sh.getRange(e.row, 11).setValue(now);
      saveQuestions_(e.id, cq.questions);
      return { status: 'success', exam: examMetaOut_(getExam_(e.id)) };
    }
    const codes = allExams_().map(function (e) { return e.code; });
    const id = newExamId_();
    const code = newCode_(codes);
    const owner = (a.role === 'admin' && body.teacherId) ? String(body.teacherId) : a.id;
    sh.appendRow([id, owner, title, code, dur, x.live ? 'TRUE' : 'FALSE', mode, JSON.stringify(allowed), cq.questions.length, now, now, '{}']);
    saveQuestions_(id, cq.questions);
    return { status: 'success', exam: examMetaOut_(getExam_(id)) };
  });
}
function teacherExamLive(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  const o = ownExam_(a, body.examId);
  if (o.err) return o.err;
  examsSheet_().getRange(o.exam.row, 6).setValue(body.live ? 'TRUE' : 'FALSE');
  return { status: 'success', live: !!body.live };
}
function teacherExamDelete(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  const o = ownExam_(a, body.examId);
  if (o.err) return o.err;
  return withLock_(function () {
    const id = o.exam.id;
    examsSheet_().deleteRow(o.exam.row);
    [[examQSheet_(), 0], [attemptsSheet_(), 0]].forEach(function (p) {
      const d = rows_(p[0]);
      for (let i = d.length - 1; i >= 0; i--) if (String(d[i][p[1]]) === id) p[0].deleteRow(i + 2);
    });
    const rs = getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(), RESULTS_SHEET);
    const d = rows_(rs);
    for (let i = d.length - 1; i >= 0; i--) if (String(d[i][5]) === id) rs.deleteRow(i + 2);
    CacheService.getScriptCache().remove('q_' + id);
    return { status: 'success' };
  });
}
// Admin: copy exams that lived in civil_data.json into the server (keeps their ids so old results still match)
function adminImportExams(body) {
  if (!verifyAdmin(body)) return UNAUTH_;
  const list = body.exams || [];
  return withLock_(function () {
    const sh = examsSheet_();
    const have = {};
    allExams_().forEach(function (e) { have[e.id] = true; });
    const codes = allExams_().map(function (e) { return e.code; });
    let added = 0, skipped = 0;
    list.forEach(function (it) {
      const id = String(it.id || '');
      const d = it.examData || {};
      if (!id || have[id]) { skipped++; return; }
      const cq = cleanQuestions_(d.questions);
      if (cq.error) { skipped++; return; }
      const dur = parseInt(String(d.duration || '30').match(/\d+/) || ['30'], 10) || 30;
      const allowed = (d.allowedIds || []).map(String);
      const code = newCode_(codes); codes.push(code);
      const now = Date.now();
      sh.appendRow([id, 'admin', String(d.title || 'Exam'), code, dur, it.live === false ? 'FALSE' : 'TRUE', allowed.length ? 'selected' : 'approved', JSON.stringify(allowed), cq.questions.length, Date.parse(it.date) || now, now, '{}']);
      saveQuestions_(id, cq.questions);
      added++;
    });
    return { status: 'success', added: added, skipped: skipped };
  });
}

// ── Attempts & results ───────────────────────────────────────────
function resultRows_() {
  const sh = getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(), RESULTS_SHEET);
  ensureResultsHeader(sh);
  return rows_(sh).map(function (r, i) {
    return { row: i + 2, id: String(r[1]), name: String(r[2]), topic: String(r[3]), score: Number(r[4]) || 0, examId: String(r[5]), details: String(r[6] || ''),
      time: String(r[7] || ''), teacherId: String(r[8] || ''), answers: String(r[9] || ''), total: Number(r[10]) || 0, timeSec: Number(r[11]) || 0 };
  }).filter(function (r) { return r.id; });
}
function ensureResultsCols_() {
  const sh = getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(), RESULTS_SHEET);
  ensureResultsHeader(sh);
  const extra = ['TeacherID', 'AnswersJson', 'Total', 'TimeSec'];
  const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 12)).getValues()[0];
  for (let i = 0; i < extra.length; i++) {
    if (!head[8 + i]) sh.getRange(1, 9 + i).setValue(extra[i]).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
  }
  return sh;
}
function findAttempt_(examId, studentId) {
  const d = rows_(attemptsSheet_());
  for (let i = 0; i < d.length; i++) {
    if (String(d[i][0]) === String(examId) && String(d[i][1]) === String(studentId)) {
      return { row: i + 2, examId: String(d[i][0]), studentId: String(d[i][1]), startedAt: Number(d[i][2]), status: String(d[i][3]), answers: String(d[i][4] || ''), savedAt: Number(d[i][5]) || 0 };
    }
  }
  return null;
}
function parseAnswers_(s, n) {
  let a = [];
  try { a = JSON.parse(s || '[]'); } catch (e) {}
  const out = [];
  for (let i = 0; i < n; i++) { const v = parseInt(a[i], 10); out.push(isNaN(v) ? -1 : v); }
  return out;
}
function mistakeText_(qs, ans) {
  const bad = [];
  qs.forEach(function (q, i) {
    if (ans[i] === -1) bad.push('Q' + (i + 1) + ' (Skipped)');
    else if (ans[i] !== q.ans) bad.push('Q' + (i + 1) + ' (Given: ' + (q.opts[ans[i]] || 'N/A') + ' | Correct: ' + (q.opts[q.ans] || 'N/A') + ')');
  });
  return bad.join(', ') || 'Perfect Score';
}
// Score the answers, write the result row, close the attempt. Idempotent.
function finalizeAttempt_(exam, student, answers, att, endedAt) {
  const sh = ensureResultsCols_();
  const existing = resultRows_().filter(function (r) { return r.examId === exam.id && r.id === String(student.id); })[0];
  if (existing) return existing;
  const qs = loadQuestions_(exam.id);
  const ans = parseAnswers_(JSON.stringify(answers || []), qs.length);
  let score = 0;
  qs.forEach(function (q, i) { if (ans[i] === q.ans) score++; });
  const started = att ? att.startedAt : endedAt;
  const timeSec = Math.max(0, Math.round((Math.min(endedAt, started + exam.durationMin * 60000) - started) / 1000));
  const time = new Date(endedAt).toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  const serial = sh.getLastRow();
  sh.appendRow([serial, String(student.id), student.name, exam.title, score, exam.id, mistakeText_(qs, ans), time, exam.teacherId, JSON.stringify(ans), qs.length, timeSec]);
  const at = attemptsSheet_();
  if (att) at.getRange(att.row, 4).setValue('submitted');
  return resultRows_().filter(function (r) { return r.examId === exam.id && r.id === String(student.id); })[0];
}
// Time ran out but the student never pressed Submit → grade what was auto-saved.
function finalizeExpired_(exam) {
  const d = rows_(attemptsSheet_());
  const now = Date.now();
  for (let i = 0; i < d.length; i++) {
    if (String(d[i][0]) !== exam.id || String(d[i][3]) !== 'started') continue;
    const started = Number(d[i][2]);
    if (now > started + exam.durationMin * 60000 + SUBMIT_GRACE_MS) {
      const stu = findStudent_(d[i][1]);
      if (!stu) continue;
      let saved = []; try { saved = JSON.parse(d[i][4] || '[]'); } catch (e) {}
      finalizeAttempt_(exam, stu, saved, { row: i + 2, startedAt: started }, started + exam.durationMin * 60000);
    }
  }
}
function rankedResults_(examId) {
  const list = resultRows_().filter(function (r) { return r.examId === String(examId); });
  list.sort(function (a, b) { return (b.score - a.score) || (a.timeSec - b.timeSec) || (a.row - b.row); });
  let rank = 0, prev = null;
  list.forEach(function (r, i) {
    if (!prev || prev.score !== r.score || prev.timeSec !== r.timeSec) rank = i + 1;
    r.rank = rank; prev = r;
  });
  return list;
}
function stripQ_(q) {
  const o = { q: q.q, opts: q.opts };
  if (q.stim) o.stim = q.stim;
  if (q.stmts) o.stmts = q.stmts;
  return o;
}
function remainingSec_(exam, att) {
  return Math.max(0, Math.floor((att.startedAt + exam.durationMin * 60000 - Date.now()) / 1000));
}

// ── Student: see exams / start / save / submit ───────────────────
function studentExams(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  const approvedBy = {};
  allLinks_().forEach(function (l) { if (l.studentId === a.id && l.status === 'approved') approvedBy[l.teacherId] = true; });
  const done = {}; resultRows_().forEach(function (r) { if (r.id === a.id) done[r.examId] = r; });
  const started = {}; rows_(attemptsSheet_()).forEach(function (r) { if (String(r[1]) === a.id && String(r[3]) === 'started') started[String(r[0])] = Number(r[2]); });
  const out = [];
  allExams_().forEach(function (e) {
    if (!approvedBy[e.teacherId]) return;
    if (e.allowMode === 'selected' && e.allowedIds.indexOf(a.id) === -1) return;
    if (!e.live && !done[e.id]) return;
    let st = done[e.id] ? 'done' : 'new';
    if (st === 'new' && started[e.id] && Date.now() < started[e.id] + e.durationMin * 60000 + SUBMIT_GRACE_MS) st = 'in-progress';
    out.push({ id: e.id, title: e.title, durationMin: e.durationMin, qCount: e.qCount, teacherName: teacherName_(e.teacherId), live: e.live, status: st,
      score: done[e.id] ? done[e.id].score : null, total: done[e.id] ? done[e.id].total : null });
  });
  return { status: 'success', exams: out };
}
// Shared checks: may this student sit this exam right now? → error object, or null if fine
function examGate_(a, e) {
  const already = resultRows_().filter(function (r) { return r.examId === e.id && r.id === a.id; })[0];
  if (already) return { status: 'error', code: 'already-done', examId: e.id, message: 'আপনি এই পরীক্ষা ইতিমধ্যে দিয়েছেন' };
  if (!e.live) return { status: 'error', code: 'closed', message: 'এই পরীক্ষা এখন বন্ধ আছে' };
  if (!isApproved_(a.id, e.teacherId)) {
    return { status: 'error', code: 'not-approved', teacher: { id: e.teacherId, name: teacherName_(e.teacherId) },
      message: teacherName_(e.teacherId) + ' এর স্টুডেন্ট হিসেবে আপনি এখনও অনুমোদিত নন' };
  }
  if (e.allowMode === 'selected' && e.allowedIds.indexOf(a.id) === -1) return { status: 'error', code: 'not-allowed', message: 'এই পরীক্ষায় আপনাকে অনুমতি দেওয়া হয়নি' };
  return null;
}
function findExamFor_(body) {
  return body.examId ? getExam_(body.examId) : getExamByCode_(body.code);
}
// Preview before starting (does not start the clock)
function examInfo(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  const e = findExamFor_(body);
  if (!e) return { status: 'error', code: 'not-found', message: 'এই কোডে কোনো পরীক্ষা পাওয়া যায়নি' };
  const gate = examGate_(a, e);
  if (gate) return gate;
  const att = findAttempt_(e.id, a.id);
  const running = !!(att && att.status === 'started' && Date.now() <= att.startedAt + e.durationMin * 60000 + SUBMIT_GRACE_MS);
  return { status: 'success', exam: { id: e.id, title: e.title, durationMin: e.durationMin, qCount: e.qCount, teacherName: teacherName_(e.teacherId) },
    resume: running, remainingSec: running ? remainingSec_(e, att) : null };
}
function examStart(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  const e = findExamFor_(body);
  if (!e) return { status: 'error', code: 'not-found', message: 'এই কোডে কোনো পরীক্ষা পাওয়া যায়নি' };
  const gate = examGate_(a, e);
  if (gate) return gate;

  return withLock_(function () {
    let att = findAttempt_(e.id, a.id);
    if (att && att.status === 'started' && Date.now() > att.startedAt + e.durationMin * 60000 + SUBMIT_GRACE_MS) {
      let saved = []; try { saved = JSON.parse(att.answers || '[]'); } catch (x) {}
      finalizeAttempt_(e, findStudent_(a.id), saved, att, att.startedAt + e.durationMin * 60000);
      return { status: 'error', code: 'already-done', examId: e.id, message: 'আপনার সময় শেষ হয়ে গিয়েছিল — উত্তর জমা হয়েছে' };
    }
    if (!att) {
      const now = Date.now();
      attemptsSheet_().appendRow([e.id, a.id, now, 'started', '[]', now]);
      att = { startedAt: now, answers: '[]' };
    }
    const qs = loadQuestions_(e.id);
    return { status: 'success', exam: { id: e.id, title: e.title, durationMin: e.durationMin, teacherName: teacherName_(e.teacherId), qCount: qs.length },
      questions: qs.map(stripQ_), remainingSec: remainingSec_(e, att), saved: parseAnswers_(att.answers, qs.length), resumed: !!att.row };
  });
}
function examSave(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  const e = getExam_(body.examId);
  if (!e) return { status: 'error', message: 'Exam not found' };
  const att = findAttempt_(e.id, a.id);
  if (!att || att.status !== 'started') return { status: 'error', code: 'no-attempt', message: 'No active attempt' };
  attemptsSheet_().getRange(att.row, 5, 1, 2).setValues([[JSON.stringify(body.answers || []), Date.now()]]);
  return { status: 'success', remainingSec: remainingSec_(e, att) };
}
function examSubmit(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  const e = getExam_(body.examId);
  if (!e) return { status: 'error', message: 'Exam not found' };
  return withLock_(function () {
    const att = findAttempt_(e.id, a.id);
    const done = resultRows_().filter(function (r) { return r.examId === e.id && r.id === a.id; })[0];
    if (!done && !att) return { status: 'error', message: 'আগে পরীক্ষা শুরু করুন' };
    if (!done) {
      const now = Date.now();
      const onTime = now <= att.startedAt + e.durationMin * 60000 + SUBMIT_GRACE_MS;
      let answers = body.answers || [];
      if (!onTime) { try { answers = JSON.parse(att.answers || '[]'); } catch (x) { answers = []; } }
      finalizeAttempt_(e, findStudent_(a.id), answers, att, now);
    }
    return reviewFor_(e, a.id);
  });
}
// Full A-Z paper: questions with the right answers + what this student chose
function reviewFor_(e, studentId) {
  const ranked = rankedResults_(e.id);
  const mine = ranked.filter(function (r) { return r.id === String(studentId); })[0];
  if (!mine) return { status: 'error', message: 'এই পরীক্ষার ফলাফল পাওয়া যায়নি' };
  const qs = loadQuestions_(e.id);
  const hasAnswers = !!mine.answers;
  const ans = hasAnswers ? parseAnswers_(mine.answers, qs.length) : null;
  let c = 0, w = 0, s = 0;
  if (ans) qs.forEach(function (q, i) { if (ans[i] === -1) s++; else if (ans[i] === q.ans) c++; else w++; });
  return { status: 'success', exam: { id: e.id, title: e.title, durationMin: e.durationMin, teacherName: teacherName_(e.teacherId) },
    result: { score: mine.score, total: qs.length, correct: c, wrong: w, skipped: s, timeSec: mine.timeSec, time: mine.time, rank: mine.rank, participants: ranked.length, name: mine.name, studentId: mine.id },
    questions: hasAnswers ? qs : null, answers: ans, details: hasAnswers ? null : mine.details };
}
function examReview(body) {
  const a = actor_(body);
  if (!a) return UNAUTH_;
  const e = getExam_(body.examId);
  if (!e) return { status: 'error', message: 'Exam not found' };
  if (a.role === 'student') return reviewFor_(e, a.id);
  if (a.role !== 'admin' && e.teacherId !== a.id) return { status: 'error', message: 'এটি আপনার পরীক্ষা নয়' };
  return reviewFor_(e, body.studentId);
}
function examRanking(body) {
  const a = actor_(body);
  if (!a) return UNAUTH_;
  const e = getExam_(body.examId);
  if (!e) return { status: 'error', message: 'Exam not found' };
  if (a.role === 'student') {
    if (!resultRows_().some(function (r) { return r.examId === e.id && r.id === a.id; })) return { status: 'error', message: 'পরীক্ষা দেওয়ার পর র‍্যাংকিং দেখতে পাবেন' };
  } else if (a.role !== 'admin' && e.teacherId !== a.id) return { status: 'error', message: 'এটি আপনার পরীক্ষা নয়' };
  if (a.role !== 'student') finalizeExpired_(e);
  const list = rankedResults_(e.id).map(function (r) {
    return { rank: r.rank, studentId: a.role === 'student' ? undefined : r.id, name: r.name, score: r.score, total: r.total, timeSec: r.timeSec, time: r.time, me: r.id === a.id };
  });
  let inProgress = [];
  if (a.role !== 'student') {
    const done = {}; list.forEach(function (r) { if (r.studentId) done[r.studentId] = true; });
    rows_(attemptsSheet_()).forEach(function (r) {
      if (String(r[0]) === e.id && String(r[3]) === 'started' && !done[String(r[1])]) {
        const s = findStudent_(r[1]); inProgress.push({ studentId: String(r[1]), name: s ? s.name : '?', startedAt: Number(r[2]) });
      }
    });
  }
  return { status: 'success', exam: examMetaOut_(e), ranking: list, inProgress: inProgress };
}
function myResults(body) {
  const a = needStudent_(body);
  if (!a) return UNAUTH_;
  const mine = resultRows_().filter(function (r) { return r.id === a.id; });
  const cache = {};
  const out = mine.map(function (r) {
    if (r.examId && !cache[r.examId]) cache[r.examId] = rankedResults_(r.examId);
    const rk = (cache[r.examId] || []).filter(function (x) { return x.id === a.id; })[0];
    return { examId: r.examId, topic: r.topic, score: r.score, total: r.total, time: r.time, rank: rk ? rk.rank : null, participants: (cache[r.examId] || []).length, details: r.details, hasReview: !!r.answers };
  });
  out.reverse();
  return { status: 'success', results: out };
}
function teacherDeleteResult(body) {
  const a = needTeacher_(body);
  if (!a) return UNAUTH_;
  const o = ownExam_(a, body.examId);
  if (o.err) return o.err;
  const sid = String(body.studentId || '');
  return withLock_(function () {
    const rs = getOrCreateSheet(SpreadsheetApp.getActiveSpreadsheet(), RESULTS_SHEET);
    const d = rows_(rs);
    for (let i = d.length - 1; i >= 0; i--) if (String(d[i][5]) === o.exam.id && String(d[i][1]) === sid) rs.deleteRow(i + 2);
    const at = attemptsSheet_(); const ad = rows_(at);
    for (let j = ad.length - 1; j >= 0; j--) if (String(ad[j][0]) === o.exam.id && String(ad[j][1]) === sid) at.deleteRow(j + 2);
    return { status: 'success', message: 'ফলাফল মুছে ফেলা হয়েছে — স্টুডেন্ট আবার পরীক্ষা দিতে পারবে' };
  });
}
