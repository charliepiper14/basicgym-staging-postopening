/**
 * BasicGym - Events registration form
 * Google Apps Script, bound to a new "BasicGym event registrations" Google Sheet.
 *
 * Every registration from basicgym.co.uk/events/:
 *   1. adds a row to the "Registrations" tab (one tab for all events, Event column)
 *   2. emails info@basicgym.co.uk, Reply-To = the person registering
 *   3. adds them to the Brevo list "Event registrations" (needs brevo.gs)
 *
 * Setup: Script Properties > BREVO_API_KEY, run setup() then brevoSetup(),
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
 * and paste the /exec URL into EVENT_ENDPOINT in elementor/11-events.html.
 */

var TO = 'info@basicgym.co.uk';
var TAB = 'Registrations';
var HEADERS = ['Received', 'Event', 'First name', 'Last name', 'Email', 'Mobile', 'Member',
               'Offers opt-in', 'Source', 'Campaign', 'Page'];

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.website) return done_();                         // honeypot: bots only
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var first = clean_(p.first_name, 60), last = clean_(p.last_name, 60);
    var email = clean_(p.email, 120).toLowerCase(), phone = clean_(p.phone, 20);
    if (!first || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, '').length < 10) return done_();
    var event = clean_(p.event, 120) || 'Event';
    var member = p.member === 'yes' ? 'Yes' : (p.member === 'no' ? 'Not yet' : '');
    var optIn = p.marketing === 'yes' || p.marketing === 'on';
    var source = [clean_(p.utm_source, 60), clean_(p.utm_medium, 60)].filter(String).join(' / ');
    var campaign = clean_(p.utm_campaign, 80);

    sheet_().appendRow([new Date(), safe_(event), safe_(first), safe_(last), safe_(email), "'" + phone,
                        member, optIn ? 'yes' : 'no', safe_(source), safe_(campaign), safe_(clean_(p.page, 300))]);

    var rows = [['Event', event], ['Name', (first + ' ' + last).trim()], ['Email', email], ['Mobile', phone],
                ['Member', member || 'Not given'], ['Offers opt-in', optIn ? 'Yes' : 'No'], ['Source', source || 'Direct'],
                ['Received', Utilities.formatDate(new Date(), 'Europe/London', 'd MMM yyyy, HH:mm')]];
    var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0E0E0E">' +
      '<p style="margin:0 0 12px"><b style="color:#FF6600">New event registration</b></p>' +
      '<table cellpadding="6" style="border-collapse:collapse">' +
      rows.map(function (r) {
        return '<tr><td style="color:#565659;padding-right:16px">' + esc_(r[0]) + '</td><td><b>' + esc_(r[1]) + '</b></td></tr>';
      }).join('') + '</table>' +
      '<p style="margin:16px 0 0;color:#565659">Reply to this email to contact ' + esc_(first) + ' directly. All registrations: ' +
      '<a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">BasicGym event registrations</a></p></div>';
    MailApp.sendEmail({
      to: TO, replyTo: email, name: 'BasicGym Website',
      subject: 'Event registration: ' + first + ' (' + event + ')',
      body: rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n'),
      htmlBody: html
    });

    /* copy to Brevo (brevo.gs). Offers only if they ticked the optional box. */
    brevoAdd_('events', { email: email, first: first, last: last, phone: phone, optIn: optIn,
                          event: event, member: member, source: source, campaign: campaign });
    return done_();
  } finally {
    lock.releaseLock();
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
