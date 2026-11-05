/**
 * BasicGym - Brevo connection for the website forms
 * Add this file to each form's Apps Script project (join leads and Basic Icons).
 *
 * Every form entry still goes to the sheet first. Brevo is sent a copy straight
 * after; if Brevo fails, the entry is safe in the sheet and the error is logged.
 *
 * The API key is NOT in this code. In the Apps Script editor:
 *   Project Settings (cog) > Script Properties > Add script property
 *   Property: BREVO_API_KEY    Value: the key from Brevo (Settings > SMTP & API)
 *
 * Then run brevoSetup() once from the editor. It creates, only if missing:
 *   folder "Website", lists "Website join leads" and "Basic Icons applicants",
 *   contact fields FORM, PLAN, SOURCE, CAMPAIGN, HANDLE, MARKETING_OPT_IN, FORM_DATE
 * Running it twice, or in both projects, is safe.
 */

var BREVO_API = 'https://api.brevo.com/v3';
var BREVO_FOLDER = 'Website';
var BREVO_LISTS = { join: 'Website join leads', icons: 'Basic Icons applicants' };
var BREVO_FIELDS = { FORM: 'text', PLAN: 'text', SOURCE: 'text', CAMPAIGN: 'text', HANDLE: 'text',
                     MARKETING_OPT_IN: 'boolean', FORM_DATE: 'date' };

/**
 * Add or update one contact. form = 'join' or 'icons'.
 * c = { email, first, last, phone, optIn (true/false), plan, source, campaign, handle }
 */
function brevoAdd_(form, c) {
  try {
    var key = PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY');
    if (!key || !c.email) return;
    var listId = brevoListId_(key, form);
    var attrs = {
      FIRSTNAME: c.first || '', LASTNAME: c.last || '', FORM: form,
      PLAN: c.plan || '', SOURCE: c.source || '', CAMPAIGN: c.campaign || '', HANDLE: c.handle || '',
      MARKETING_OPT_IN: !!c.optIn, FORM_DATE: Utilities.formatDate(new Date(), 'Europe/London', 'yyyy-MM-dd')
    };
    var sms = ukMobile_(c.phone);
    if (sms) attrs.SMS = sms;
    var body = { email: c.email, attributes: attrs, updateEnabled: true };
    if (listId) body.listIds = [listId];

    var res = brevoCall_(key, 'post', '/contacts', body);
    /* the same mobile already sits on another contact: save the rest without it */
    if (res.code === 400 && sms && /SMS|phone|duplicate/i.test(res.text)) {
      delete attrs.SMS;
      res = brevoCall_(key, 'post', '/contacts', body);
    }
    if (res.code >= 300) console.error('Brevo ' + res.code + ': ' + res.text);
  } catch (err) {
    console.error('Brevo failed: ' + err);
  }
}

/* 07123 456789, +44 7123 456789 or 447123456789 -> +447123456789. Anything else: no SMS. */
function ukMobile_(v) {
  var d = String(v || '').replace(/\D/g, '');
  if (/^07\d{9}$/.test(d)) return '+44' + d.slice(1);
  if (/^447\d{9}$/.test(d)) return '+' + d;
  return '';
}

function brevoListId_(key, form) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('BREVO_LIST_' + form);
  if (saved) return Number(saved);
  var id = brevoFindList_(key, BREVO_LISTS[form]);
  if (id) props.setProperty('BREVO_LIST_' + form, String(id));
  return id;
}

function brevoFindList_(key, name) {
  for (var offset = 0; offset < 1000; offset += 50) {
    var res = brevoCall_(key, 'get', '/contacts/lists?limit=50&offset=' + offset);
    var lists = (res.json && res.json.lists) || [];
    for (var i = 0; i < lists.length; i++) if (lists[i].name === name) return lists[i].id;
    if (lists.length < 50) break;
  }
  return 0;
}

function brevoCall_(key, method, path, body) {
  var opt = { method: method, muteHttpExceptions: true,
              headers: { 'api-key': key, accept: 'application/json' } };
  if (body) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  var r = UrlFetchApp.fetch(BREVO_API + path, opt);
  var text = r.getContentText();
  var json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) {}
  return { code: r.getResponseCode(), text: text, json: json };
}

/* Run once from the editor. Logs what it created and the list IDs. */
function brevoSetup() {
  var key = PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY');
  if (!key) throw new Error('Add the BREVO_API_KEY script property first (Project Settings > Script Properties).');

  /* contact fields: a 400 here just means the field already exists */
  Object.keys(BREVO_FIELDS).forEach(function (name) {
    var r = brevoCall_(key, 'post', '/contacts/attributes/normal/' + name, { type: BREVO_FIELDS[name] });
    if (r.code === 401 || r.code === 403) throw new Error('Brevo refused the key (' + r.code + '): ' + r.text);
    console.log('Field ' + name + ': ' + (r.code < 300 ? 'created' : 'already there (' + r.code + ')'));
  });

  /* folder */
  var folderId = 0;
  var f = brevoCall_(key, 'get', '/contacts/folders?limit=50&offset=0');
  ((f.json && f.json.folders) || []).forEach(function (x) { if (x.name === BREVO_FOLDER) folderId = x.id; });
  if (!folderId) {
    var nf = brevoCall_(key, 'post', '/contacts/folders', { name: BREVO_FOLDER });
    if (nf.code >= 300) throw new Error('Could not create folder: ' + nf.text);
    folderId = nf.json.id;
  }

  /* lists */
  Object.keys(BREVO_LISTS).forEach(function (form) {
    var id = brevoFindList_(key, BREVO_LISTS[form]);
    if (!id) {
      var nl = brevoCall_(key, 'post', '/contacts/lists', { name: BREVO_LISTS[form], folderId: folderId });
      if (nl.code >= 300) throw new Error('Could not create list ' + BREVO_LISTS[form] + ': ' + nl.text);
      id = nl.json.id;
    }
    PropertiesService.getScriptProperties().setProperty('BREVO_LIST_' + form, String(id));
    console.log('List "' + BREVO_LISTS[form] + '": ID ' + id);
  });
  console.log('Brevo is ready.');
}

/* Optional check from the editor: adds one test contact, then delete it in Brevo. */
function brevoTest() {
  brevoAdd_('icons', { email: 'brevo-test@basicgym.co.uk', first: 'Test', phone: '', optIn: false, source: 'test' });
  console.log('Sent. Look for brevo-test@basicgym.co.uk in Brevo > Contacts.');
}
