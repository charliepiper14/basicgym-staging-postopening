/**
 * BasicGym - capture-first JOIN lead handler (Google Apps Script)
 * Receives POSTs from the /join/ page form and appends a row to the Sheet,
 * then adds the lead to Brevo (needs brevo.gs in the same project).
 *
 * 5 Nov 2026: added plan and marketing columns at the end of the row, and the
 * Brevo copy. Existing columns and their order are unchanged.
 *
 * To update, use Deploy > Manage deployments > edit > Version: New version, so the
 * SAME /exec URL keeps working (don't create a brand-new deployment each time).
 */

var SHEET_ID  = '18xBrlL4MFy28FRwikvK5JOiPcOZxu25t-hDU5zdegO4'; // BasicGym Join Leads spreadsheet
var TAB_NAME  = 'join_leads';

var HEADERS = ['timestamp','first_name','last_name','email','phone','event_id','source','offer','page','user_agent',
               'plan','marketing'];

function setup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(TAB_NAME) || ss.insertSheet(TAB_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  } else {
    /* add any missing header names (plan, marketing) without touching the rest */
    var row = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    HEADERS.forEach(function (h, i) { if (!row[i]) sh.getRange(1, i + 1).setValue(h); });
  }
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
}

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    // sendBeacon(FormData) lands in e.parameter. JSON/text fallbacks handled too.
    if ((!p || !p.email) && e && e.postData && e.postData.contents) {
      try {
        var j = JSON.parse(e.postData.contents);
        if (j && typeof j === 'object') p = j;
      } catch (ignore) {}
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = ss.getSheetByName(TAB_NAME);
    if (!sh) { sh = ss.insertSheet(TAB_NAME); sh.appendRow(HEADERS); sh.setFrozenRows(1); }

    var optIn = p.marketing === 'yes' || p.marketing === 'on';

    sh.appendRow([
      p.ts || new Date().toISOString(),
      p.first_name || '',
      p.last_name  || '',
      p.email      || '',
      p.phone      || '',
      p.event_id   || '',
      p.source     || 'capture-first-join',
      p.offer      || 'none',
      p.page       || '',
      '',
      p.plan       || '',
      optIn ? 'yes' : 'no'
    ]);

    /* copy to Brevo (brevo.gs). Marketing only if they ticked the optional box. */
    var email = String(p.email || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      var utm = utm_(p.page);
      brevoAdd_('join', {
        email: email,
        first: String(p.first_name || '').trim().slice(0, 60),
        last:  String(p.last_name  || '').trim().slice(0, 60),
        phone: p.phone || '',
        plan:  p.plan  || '',
        optIn: optIn,
        source: [utm.utm_source, utm.utm_medium].filter(String).join(' / '),
        campaign: utm.utm_campaign || ''
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* utm_source, utm_medium and utm_campaign from the page URL the form was sent from */
function utm_(url) {
  var out = { utm_source: '', utm_medium: '', utm_campaign: '' };
  var q = String(url || '').split('#')[0].split('?')[1] || '';
  q.split('&').forEach(function (pair) {
    var kv = pair.split('=');
    if (out.hasOwnProperty(kv[0])) {
      try { out[kv[0]] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')).slice(0, 80); } catch (x) {}
    }
  });
  return out;
}

// Lets you open the /exec URL in a browser to confirm it's deployed.
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'basicgym-join-capture' }))
    .setMimeType(ContentService.MimeType.JSON);
}
