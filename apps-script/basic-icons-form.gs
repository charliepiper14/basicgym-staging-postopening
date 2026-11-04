/**
 * BasicGym - Basic Icons application form
 * Google Apps Script, bound to the "Basic Icons applications" Google Sheet.
 *
 * Every application from basicgym.co.uk/basic-icons/:
 *   1. adds a row to the "Applications" tab
 *   2. emails info@basicgym.co.uk, Reply-To = the applicant
 * The optional step 2 (platform, followers, why) fills in the same row.
 *
 * Setup: see apps-script/SETUP.md. Deploy as a web app:
 *   Execute as: Me    Who has access: Anyone
 */

var TO = 'info@basicgym.co.uk';
var TAB = 'Applications';
var HEADERS = ['Received', 'First name', 'Mobile', 'Email', 'Handle', 'Platform', 'Followers',
               'Why', 'Status', 'Source', 'Campaign', 'Ref code', 'Page', 'Application ID'];

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.website) return done_();                         // honeypot: bots only
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    if (p.step === '2') { addDetails_(sh, p); return done_(); }

    var first = clean_(p.first_name, 60);
    var phone = clean_(p.phone, 20);
    var email = clean_(p.email, 120).toLowerCase();
    if (!first || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, '').length < 10) return done_();

    var handle = clean_(p.handle, 60);
    if (handle && handle.charAt(0) !== '@') handle = '@' + handle;
    var source = [clean_(p.utm_source, 60), clean_(p.utm_medium, 60)].filter(String).join(' / ');

    sh.appendRow([new Date(), safe_(first), "'" + phone, safe_(email), safe_(handle), '', '', '', 'New',
                  safe_(source), safe_(clean_(p.utm_campaign, 80)), safe_(clean_(p.ref, 40)),
                  safe_(clean_(p.page, 300)), safe_(clean_(p.id, 60))]);

    var rows = [['First name', first], ['Mobile', phone], ['Email', email],
                ['Instagram / TikTok', handle || 'Not given'], ['Source', source || 'Direct'],
                ['Received', Utilities.formatDate(new Date(), 'Europe/London', 'd MMM yyyy, HH:mm')]];
    var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0E0E0E">' +
      '<p style="margin:0 0 12px"><b style="color:#FF6600">New Basic Icon application</b></p>' +
      '<table cellpadding="6" style="border-collapse:collapse">' +
      rows.map(function (r) {
        return '<tr><td style="color:#565659;padding-right:16px">' + esc_(r[0]) + '</td><td><b>' + esc_(r[1]) + '</b></td></tr>';
      }).join('') + '</table>' +
      '<p style="margin:16px 0 0;color:#565659">Reply to this email to contact ' + esc_(first) + ' directly. ' +
      'Extra details they add (platform, followers, why) appear in the sheet: ' +
      '<a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">Basic Icons applications</a></p></div>';
    var text = rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');

    MailApp.sendEmail({
      to: TO,
      replyTo: email,
      name: 'BasicGym Website',
      subject: 'New Basic Icon application: ' + first + (handle ? ' (' + handle + ')' : ''),
      body: text,
      htmlBody: html
    });
    return done_();
  } finally {
    lock.releaseLock();
  }
}

/* step 2: fill platform, followers and why on the row with the same ID and email */
function addDetails_(sh, p) {
  var id = clean_(p.id, 60), email = clean_(p.email, 120).toLowerCase();
  if (!id) return;
  var last = sh.getLastRow();
  if (last < 2) return;
  var ids = sh.getRange(2, 14, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0] === id) {
      var r = i + 2;
      if (String(sh.getRange(r, 4).getValue()).toLowerCase() !== email) return;
      sh.getRange(r, 6, 1, 3).setValues([[safe_(clean_(p.platform, 30)), safe_(clean_(p.followers, 30)), safe_(clean_(p.why, 600))]]);
      return;
    }
  }
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0E0E0E').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function clean_(v, max) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max); }
/* stop Sheets reading a value as a formula or a number */
function safe_(v) { return /^[=+\-]/.test(v) ? "'" + v : v; }
function esc_(v) { return String(v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function done_() { return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT); }

/* Run once from the editor to create the tab and approve the email permission. */
function setup() {
  sheet_();
  MailApp.getRemainingDailyQuota();
}
