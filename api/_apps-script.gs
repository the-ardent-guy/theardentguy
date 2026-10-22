/* ===========================================================================
   ASK RISH, THE LOG AND LEAD SINK  (spec 11.5)

   THIS FILE IS NOT DEPLOYED AND NOT RUN BY VERCEL. The leading underscore
   keeps Vercel from treating it as a function; it is here so it lives in the
   repo next to the thing that calls it. It is Google Apps Script, to paste.

   SETUP
   1  Make a Google Sheet with two tabs named exactly: conversations, leads
   2  Extensions -> Apps Script, delete the stub, paste this whole file
   3  Project Settings -> Script Properties, add three:
        SECRET      any long random string. The same string goes in Vercel as
                    SHEET_SECRET. It is what stops anyone who finds the /exec
                    URL from writing rows into your sheet.
        TG_TOKEN    from @BotFather
        TG_CHAT_ID  message your bot once, then open
                    https://api.telegram.org/bot<TOKEN>/getUpdates and read
                    result[0].message.chat.id
   4  Deploy -> New deployment -> Web app
        Execute as: Me
        Who has access: Anyone
      Copy the /exec URL into Vercel as SHEET_WEBHOOK_URL.

   The Telegram token lives in Script Properties and never in Vercel, so the
   bot token is not in the same place as the site's other keys.

   NOTE ON REDEPLOYS: editing this script does not update the live web app.
   Deploy -> Manage deployments -> edit -> Version: New version. Forgetting
   this is the usual reason a change appears to do nothing.
   =========================================================================== */

function doPost(e) {
  var p = PropertiesService.getScriptProperties();

  var d;
  try {
    d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return out({ ok: false, why: 'bad json' });
  }

  // Constant-time-ish compare is overkill here, but an early return on a bad
  // secret means a wrong caller never touches the spreadsheet.
  if (!d.secret || d.secret !== p.getProperty('SECRET')) {
    return out({ ok: false });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');

  var conv = ss.getSheetByName('conversations');
  if (conv) {
    conv.appendRow([now, d.sessionId || '', d.page || '', d.ip || '',
                    d.q || '', d.a || '', d.lead ? 'yes' : '']);
  }

  if (d.lead) {
    var lead;
    try { lead = JSON.parse(d.lead); } catch (err2) { lead = {}; }

    var sheet = ss.getSheetByName('leads');
    if (sheet) {
      sheet.appendRow([now, d.sessionId || '', lead.name || '',
                       lead.email || '', lead.brief || '', d.page || '']);
    }

    var token = p.getProperty('TG_TOKEN');
    var chat = p.getProperty('TG_CHAT_ID');
    if (token && chat) {
      var text = '🆕 Lead from Ask Rish\n' +
                 (lead.name || '(no name)') + ' <' + (lead.email || '') + '>\n' +
                 '"' + (lead.brief || '') + '"\n' +
                 'page: ' + (d.page || '');
      UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: chat, text: text })
      });
    }
  }

  return out({ ok: true });
}

/* A GET on the /exec URL is how you check the deployment is live without
   writing a row. It deliberately says nothing about the sheet. */
function doGet() {
  return out({ ok: true, service: 'ask-rish-log' });
}

function out(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
