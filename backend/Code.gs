/* HELP ME 4U · Partner Trust & Verification — Google Apps Script backend
   ไฟล์ในโปรเจกต์ Apps Script:
     Core.gs  ← คัดลอกจาก assets/core.js ทั้งไฟล์ (กฎสถานะ/สิทธิ์อยู่ที่นั่น)
     Code.gs  ← ไฟล์นี้ (เก็บข้อมูลใน Google Sheet, ไฟล์หลักฐานใน Google Drive, ตรวจรหัสแอดมิน)
   Script Properties:
     ADMIN_KEYS      ชื่อ:รหัส คั่นด้วยจุลภาค เช่น  สมชาย:x9Kp2...,วิภา:Qm7r...  (ชื่อจะถูกบันทึกใน Audit Log)
     SPREADSHEET_ID  (ไม่บังคับ) ถ้าสคริปต์ไม่ได้ผูกกับชีต
     DOCS_FOLDER_ID  (ไม่บังคับ) โฟลเดอร์ Drive สำหรับเก็บหลักฐาน ถ้าไม่ใส่จะสร้างให้อัตโนมัติ */

var PARTNER_COLUMNS = ['id', 'created_at', 'updated_at', 'status', 'level', 'requested_level', 'org_type', 'org_name', 'reg_no', 'parent_agency',
  'founded_year', 'members', 'contact_name', 'contact_role', 'contact_phone', 'contact_email', 'contact_line', 'backup_name', 'backup_phone',
  'province', 'districts', 'address', 'capabilities', 'resources', 'availability', 'links', 'docs', 'referee', 'about', 'agreements', 'agreed_at',
  'checklist', 'admin_note', 'info_request', 'responses', 'suspended_reason', 'reviewer', 'decided_at', 'token_hash'];
var JSON_COLUMNS = { capabilities: 1, links: 1, docs: 1, agreements: 1, checklist: 1, responses: 1 };
var LOG_COLUMNS = ['ts', 'partner_id', 'actor', 'action', 'from_status', 'to_status', 'from_level', 'to_level', 'note', 'public'];
var PUBLIC_ACTIONS = { apply: 1, status: 1, resubmit: 1 };
var ADMIN_ACTIONS = { whoami: 1, list: 1, get: 1, review: 1, decide: 1 };

function doGet() {
  return json({ ok: true, service: 'helpme4u-partners' });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents) } catch (err) { return json({ ok: false, error: 'bad_json' }) }
  var action = String(body.action || '');
  try {
    if (PUBLIC_ACTIONS[action]) {
      if (action === 'apply' && !rateOk('apply:' + String(body.contact_phone || '').replace(/\D/g, ''), 3)) return json({ ok: false, error: 'rate', message: 'ส่งใบสมัครถี่เกินไป ลองใหม่ในอีก 1 ชั่วโมง' });
      if (action !== 'apply' && !rateOk('track:' + String(body.id || ''), 30)) return json({ ok: false, error: 'rate', message: 'ลองหลายครั้งเกินไป รอสักครู่' });
      return json(withLock(action !== 'status', function () { return core()[action](body) }));
    }
    if (ADMIN_ACTIONS[action]) {
      var actor = adminName(body.key);
      if (!actor) return json({ ok: false, error: 'not_admin', message: 'รหัสแอดมินไม่ถูกต้อง' });
      if (action === 'whoami') return json({ ok: true, name: actor });
      var res = withLock(action === 'review' || action === 'decide', function () { return core()[action](body, actor) });
      if (action === 'get' && res.ok) res.partner.docs = (res.partner.docs || []).map(function (d) {
        d.url = d.ref ? 'https://drive.google.com/file/d/' + d.ref + '/view' : ''; return d;
      });
      return json(res);
    }
    return json({ ok: false, error: 'bad_action' });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server', message: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' });
  }
}

/* ---------- ฐานข้อมูล Google Sheet ---------- */
function core() {
  return HM.createCore(sheetDb(), {
    now: function () { return Date.now() },
    token: function () { return randomCode(10) },
    hash: function (s) {
      var salt = PropertiesService.getScriptProperties().getProperty('TOKEN_SALT');
      if (!salt) { salt = Utilities.getUuid(); PropertiesService.getScriptProperties().setProperty('TOKEN_SALT', salt) }
      return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + s, Utilities.Charset.UTF_8));
    },
    newId: function () {
      var d = new Date(); return 'HM-' + String(d.getFullYear() + 543).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + randomCode(4);
    },
    saveFile: function (f, id) {
      var blob = Utilities.newBlob(Utilities.base64Decode(String(f.data)), f.type, id + ' · ' + String(f.name || 'file').slice(0, 100));
      var file = docsFolder().createFile(blob);
      return { kind: String(f.kind || 'เอกสาร').slice(0, 60), name: String(f.name || 'file').slice(0, 120), type: f.type, size: blob.getBytes().length, ref: file.getId() };
    }
  });
}

function sheetDb() {
  var ps = sheet('Partners', PARTNER_COLUMNS), ls = sheet('AuditLog', LOG_COLUMNS);
  var cache = null;
  function rows() {
    if (cache) return cache;
    var v = ps.getDataRange().getValues(), head = v.shift();
    cache = v.map(function (r, i) { var o = { _row: i + 2 }; head.forEach(function (h, j) { o[h] = JSON_COLUMNS[h] ? parse(r[j]) : r[j] }); return o });
    return cache;
  }
  function toRow(rec) {
    return PARTNER_COLUMNS.map(function (h) { var v = rec[h]; return JSON_COLUMNS[h] ? cell(JSON.stringify(v || (h === 'agreements' || h === 'checklist' ? {} : []))) : cell(v) });
  }
  function clean(o) { var c = {}; for (var k in o) if (k !== '_row') c[k] = o[k]; return c }
  return {
    all: function () { return rows().map(clean).sort(function (a, b) { return b.created_at - a.created_at }) },
    get: function (id) { var r = rows().filter(function (x) { return x.id === id })[0]; return r ? clean(r) : null },
    insert: function (rec) { ps.appendRow(toRow(rec)); cache = null },
    update: function (rec) {
      var r = rows().filter(function (x) { return x.id === rec.id })[0];
      ps.getRange(r._row, 1, 1, PARTNER_COLUMNS.length).setValues([toRow(rec)]); cache = null;
    },
    log: function (e) { ls.appendRow(LOG_COLUMNS.map(function (h) { return cell(e[h]) })) },
    logsFor: function (id) {
      var v = ls.getDataRange().getValues(), head = v.shift();
      return v.filter(function (r) { return r[1] === id }).map(function (r) { var o = {}; head.forEach(function (h, j) { o[h] = r[j] }); return o })
        .sort(function (a, b) { return a.ts - b.ts });
    }
  };
}

function sheet(name, columns) {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(columns); sh.setFrozenRows(1); sh.getRange('1:1').setFontWeight('bold') }
  return sh;
}

function docsFolder() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('DOCS_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  var f = DriveApp.createFolder('HELP ME 4U · Partner Documents (ห้ามแชร์สาธารณะ)');
  props.setProperty('DOCS_FOLDER_ID', f.getId());
  return f;
}

/* ---------- สิทธิ์และความปลอดภัย ---------- */
function adminName(key) {
  key = String(key || '');
  if (key.length < 8) return '';
  var list = String(PropertiesService.getScriptProperties().getProperty('ADMIN_KEYS') || '').split(',');
  for (var i = 0; i < list.length; i++) {
    var p = list[i].split(':'), name = p[0].trim(), k = (p[1] || '').trim();
    if (k && k === key) return name;
  }
  return '';
}

function rateOk(bucket, max) {
  var c = CacheService.getScriptCache(), n = Number(c.get(bucket) || 0);
  if (n >= max) return false;
  c.put(bucket, String(n + 1), 3600);
  return true;
}

function withLock(needed, fn) {
  if (!needed) return fn();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn() } finally { lock.releaseLock() }
}

function randomCode(n) {
  var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '', b = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  for (var i = 0; i < n; i++) s += a[parseInt(b.substr(i * 2, 2), 16) % a.length];
  return s;
}

/* ข้อความที่ขึ้นต้นด้วย = + - @ หรือตัวเลข ใส่ ' นำหน้า: กันสูตรแปลกปลอม (formula injection) และเลข 0 หน้าเบอร์โทรหาย
   Google Sheet จะไม่ส่ง ' กลับมาตอนอ่าน */
function cell(v) {
  if (v == null) return '';
  if (typeof v === 'string' && /^[=+\-@\d]/.test(v)) return "'" + v;
  return v;
}

function parse(v) { try { return v === '' ? null : JSON.parse(v) } catch (e) { return null } }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON) }

/* รันครั้งแรกจากตัวแก้ไข Apps Script เพื่อสร้างชีตและขอสิทธิ์ Drive */
function setup() {
  sheet('Partners', PARTNER_COLUMNS); sheet('AuditLog', LOG_COLUMNS); docsFolder();
  if (!PropertiesService.getScriptProperties().getProperty('ADMIN_KEYS')) {
    var k = randomCode(16);
    PropertiesService.getScriptProperties().setProperty('ADMIN_KEYS', 'แอดมิน:' + k);
    Logger.log('สร้างรหัสแอดมินแรกแล้ว: ' + k + '  (แก้ได้ที่ Project Settings → Script Properties)');
  }
}
