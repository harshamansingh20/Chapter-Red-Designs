// ─────────────────────────────────────────────────────────────────────────────
// Chapter Red — Contact Form Handler
// Paste this entire file into Google Apps Script, then deploy as a Web App.
//
// SETUP STEPS (do these in order):
//
//   1. Open Google Sheets → Extensions → Apps Script
//   2. Delete any existing code and paste this entire file
//   3. Fill in YOUR_EMAIL_HERE and YOUR_RECAPTCHA_SECRET_HERE below
//   4. Click Deploy → New Deployment
//        Type: Web App
//        Execute as: Me
//        Who has access: Anyone
//   5. Click Deploy → copy the Web App URL
//   6. Paste that URL into book-a-call.html where it says YOUR_APPS_SCRIPT_URL_HERE
//
// That's it. Every submission will:
//   → Add a new row to the "Submissions" sheet
//   → Send you a notification email
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_TO         = 'YOUR_EMAIL_HERE';            // e.g. you@gmail.com
const RECAPTCHA_SECRET = 'YOUR_RECAPTCHA_SECRET_HERE'; // from google.com/recaptcha/admin
const SHEET_NAME       = 'Submissions';

// ─── Main entry point ────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // 1. Honeypot — bots fill this hidden field, humans never see it
    if (data._hp) return ok();

    // 2. reCAPTCHA — reject anything that didn't pass the checkbox
    if (!verifyCaptcha(data.token)) {
      return ok(); // silently succeed so bots don't know they failed
    }

    // 3. Write to sheet
    appendToSheet(data);

    // 4. Email notification
    sendEmail(data);

    return ok();

  } catch (err) {
    return ok(); // never expose internal errors to the client
  }
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

function appendToSheet(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // Add header row on first use
  if (sheet.getLastRow() === 0) {
    const headers = ['Timestamp', 'Name', 'Email', 'Company', 'Website', 'Services', 'Message'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#121212')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date().toLocaleString('en-GB'),
    data.name    || '',
    data.email   || '',
    data.company || '',
    data.website || '',
    data.services || '',
    data.message || ''
  ]);
}

// ─── Email ───────────────────────────────────────────────────────────────────

function sendEmail(data) {
  const subject = 'New enquiry — ' + (data.name || 'Unknown') + ' via Chapter Red';
  const body = [
    'You have a new contact form submission from the Chapter Red website.',
    '',
    'NAME     : ' + (data.name    || '—'),
    'EMAIL    : ' + (data.email   || '—'),
    'COMPANY  : ' + (data.company || '—'),
    'WEBSITE  : ' + (data.website || '—'),
    'SERVICES : ' + (data.services || '—'),
    '',
    'MESSAGE:',
    data.message || '—',
    '',
    '──────────────────────────────',
    'Sent from Chapter Red contact form'
  ].join('\n');

  GmailApp.sendEmail(EMAIL_TO, subject, body);
}

// ─── reCAPTCHA ───────────────────────────────────────────────────────────────

function verifyCaptcha(token) {
  if (!token) return false;
  const res = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    payload: {
      secret:   RECAPTCHA_SECRET,
      response: token
    }
  });
  return JSON.parse(res.getContentText()).success === true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok() {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
