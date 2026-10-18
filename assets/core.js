/* HELP ME 4U · Partner Trust & Verification — กฎของระบบ (ใช้ร่วมกัน)
   ไฟล์นี้รันได้ทั้งบนเบราว์เซอร์ (โหมดทดลอง) และใน Google Apps Script (คัดลอกไปเป็น Core.gs)
   ทุกการตัดสินใจเรื่องสถานะ/สิทธิ์ต้องผ่านฟังก์ชันในไฟล์นี้ ฝั่งหน้าเว็บแค่แสดงผล */
var HM = (function () {
  var LEVELS = {
    L0: { name: 'ยังไม่มีสิทธิ์', desc: 'เห็นเฉพาะใบสมัครของตัวเอง ไม่เห็นข้อมูลผู้ประสบภัย' },
    L1: { name: 'ภาพรวมพื้นที่', desc: 'เห็นสถิติรวมรายเขต/อำเภอ (จำนวนเคส ความต้องการ ระดับน้ำ) ไม่มีชื่อ เบอร์ หรือพิกัด' },
    L2: { name: 'ทีมปฏิบัติการ', desc: 'รับเคสที่ถูกมอบหมาย เห็นชื่อ เบอร์ และพิกัดเฉพาะเคสนั้นระหว่างปฏิบัติงาน' },
    L3: { name: 'ผู้ประสานพื้นที่', desc: 'เห็นเคสทั้งหมดในพื้นที่ที่ได้รับอนุมัติ และมอบหมายเคสให้ทีม L2' }
  };
  var COMMON_CHECKS = [
    { key: 'contact_called', label: 'โทรกลับยืนยันกับผู้รับผิดชอบแล้ว', min: 'L1' },
    { key: 'leader_id', label: 'ยืนยันตัวตนผู้รับผิดชอบ (บัตร/หนังสือแต่งตั้ง)', min: 'L2' },
    { key: 'area_ok', label: 'พื้นที่ปฏิบัติงานสอดคล้องกับที่ตั้ง/ผลงาน', min: 'L2' }
  ];
  var TYPES = {
    foundation: { name: 'มูลนิธิ', max: 'L3', hint: 'ใบอนุญาตจัดตั้งมูลนิธิ หรือประกาศกระทรวงมหาดไทย, เลขทะเบียน, หนังสือมอบหมายผู้ประสานงาน',
      checks: [{ key: 'reg_doc', label: 'เอกสารจดทะเบียนตรงกับชื่อองค์กร', min: 'L1' }, { key: 'reg_verified', label: 'ตรวจเลขทะเบียนกับฐานข้อมูลราชการแล้ว', min: 'L2' }] },
    association: { name: 'สมาคม / ชมรมจดทะเบียน', max: 'L3', hint: 'ใบสำคัญแสดงการจดทะเบียนสมาคม, เลขทะเบียน, หนังสือมอบหมายผู้ประสานงาน',
      checks: [{ key: 'reg_doc', label: 'เอกสารจดทะเบียนตรงกับชื่อองค์กร', min: 'L1' }, { key: 'reg_verified', label: 'ตรวจเลขทะเบียนกับฐานข้อมูลราชการแล้ว', min: 'L2' }] },
    government: { name: 'หน่วยงานรัฐ / ท้องถิ่น', max: 'L3', hint: 'หนังสือราชการแจ้งชื่อผู้ประสานงาน, อีเมล .go.th หรือเบอร์สำนักงาน',
      checks: [{ key: 'official_letter', label: 'มีหนังสือราชการ/คำสั่งแต่งตั้งผู้ประสานงาน', min: 'L1' }, { key: 'official_channel', label: 'ยืนยันผ่านช่องทางทางการ (เบอร์สำนักงาน/อีเมลราชการ)', min: 'L2' }] },
    warroom: { name: 'War Room / ศูนย์บัญชาการเหตุการณ์', max: 'L3', hint: 'คำสั่งจัดตั้งศูนย์, ชื่อหน่วยงานต้นสังกัด, ผู้บัญชาการ/ผู้ประสานงานกะ',
      checks: [{ key: 'command_order', label: 'มีคำสั่ง/ประกาศจัดตั้งศูนย์', min: 'L1' }, { key: 'parent_confirmed', label: 'หน่วยงานต้นสังกัดยืนยันแล้ว', min: 'L2' }] },
    volunteer: { name: 'กลุ่มอาสาอิสระ', max: 'L2', hint: 'ลิงก์เพจ/ภาพผลงานย้อนหลัง, ชื่อองค์กรหรือบุคคลที่รับรองได้, บัตรประชาชนหัวหน้ากลุ่ม',
      checks: [{ key: 'track_record', label: 'มีผลงานช่วยเหลือที่ตรวจสอบได้', min: 'L1' }, { key: 'referee', label: 'ผู้รับรองยืนยันแล้ว (องค์กร Verified หรือหน่วยงานรัฐ)', min: 'L2' }] },
    business: { name: 'บริษัท / CSR', max: 'L1', hint: 'หนังสือรับรองบริษัท, หนังสือมอบหมายผู้ประสานงาน (รับบทสนับสนุนสิ่งของ/ขนส่ง)',
      checks: [{ key: 'company_cert', label: 'หนังสือรับรองบริษัทตรงกับชื่อ', min: 'L1' }] }
  };
  var STATUSES = {
    pending: 'รอตรวจสอบ', reviewing: 'กำลังตรวจสอบ', need_info: 'ขอข้อมูลเพิ่ม',
    approved: 'Verified', rejected: 'ไม่อนุมัติ', suspended: 'ระงับสิทธิ์'
  };
  var CAPABILITIES = ['อพยพ / กู้ภัยทางน้ำ', 'เรือ', 'รถสูง / รถขนส่ง', 'แพทย์ / พยาบาล', 'ดูแลผู้ป่วยติดเตียง', 'อาหาร / ครัวกลาง',
    'น้ำดื่ม', 'ถุงยังชีพ', 'ยา / เวชภัณฑ์', 'ที่พักชั่วคราว', 'สื่อสาร / วิทยุ', 'ประสานงาน / คอลเซ็นเตอร์', 'ฟื้นฟูหลังน้ำลด', 'บริจาคเงิน / สิ่งของ'];
  var AGREEMENTS = [
    { key: 'truth', label: 'ข้อมูลและเอกสารที่ส่งเป็นความจริง' },
    { key: 'verify', label: 'ยินยอมให้ HELP ME 4U ติดต่อและตรวจสอบกับผู้รับรองหรือหน่วยงานที่เกี่ยวข้อง' },
    { key: 'pdpa', label: 'ยินยอมให้เก็บข้อมูลผู้ติดต่อเพื่อการประสานงานภัยพิบัติ ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)' },
    { key: 'victim_data', label: 'จะใช้ข้อมูลผู้ประสบภัยเฉพาะภารกิจช่วยเหลือ ไม่เผยแพร่ ไม่ส่งต่อ และลบเมื่อจบภารกิจ' },
    { key: 'revoke', label: 'รับทราบว่า HELP ME 4U ระงับสิทธิ์ได้ทันทีหากพบการใช้ข้อมูลผิดวัตถุประสงค์' }
  ];
  var LIMITS = { files: 5, fileBytes: 5 * 1024 * 1024, links: 5, text: 1000 };
  var FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  function lv(l) { return Number(String(l || 'L0').slice(1)) || 0 }
  function checksFor(type) { return COMMON_CHECKS.concat((TYPES[type] || { checks: [] }).checks) }
  /* รายการตรวจที่ยังไม่ผ่านสำหรับระดับที่จะอนุมัติ */
  function missingChecks(rec, level) {
    var done = rec.checklist || {};
    return checksFor(rec.org_type).filter(function (c) { return lv(c.min) <= lv(level) && !done[c.key] });
  }
  function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200) }
  function list(v, max, n) { return (Array.isArray(v) ? v : String(v || '').split(',')).map(function (x) { return str(x, max) }).filter(Boolean).slice(0, n || 30) }
  function phone(v) { return String(v || '').replace(/[^\d]/g, '') }
  function fail(code, msg) { return { ok: false, error: code, message: msg } }

  var ACTIONS = {
    start_review: { from: ['pending'], to: 'reviewing' },
    request_info: { from: ['pending', 'reviewing'], to: 'need_info', note: true },
    approve: { from: ['pending', 'reviewing'], to: 'approved', level: true },
    reject: { from: ['pending', 'reviewing', 'need_info'], to: 'rejected', note: true },
    suspend: { from: ['approved'], to: 'suspended', note: true },
    reinstate: { from: ['suspended'], to: 'approved', level: true, note: true },
    set_level: { from: ['approved'], to: 'approved', level: true, note: true }
  };
  /* ข้อความของการกระทำเหล่านี้จะแสดงให้ผู้สมัครเห็น */
  var PUBLIC_NOTE = { request_info: 1, reject: 1, suspend: 1 };

  /* decide ใช้ p.act เป็นชื่อการตัดสินใจ (p.action เป็นชื่อคำสั่ง API)
     db: { all(), get(id), insert(rec), update(rec), log(entry), logsFor(id) }
     deps: { now(), token(), hash(s), newId(), saveFile(file, id) } */
  function createCore(db, deps) {
    function audit(rec, actor, action, before, note) {
      db.log({ ts: deps.now(), partner_id: rec.id, actor: actor, action: action, from_status: before.status, to_status: rec.status,
        from_level: before.level, to_level: rec.level, note: note || '', public: PUBLIC_NOTE[action] || action === 'submitted' || action === 'resubmitted' ? 1 : 0 });
    }
    function authApplicant(p) {
      var rec = db.get(str(p.id, 30).toUpperCase());
      if (!rec || !p.token || deps.hash(str(p.token, 40).toUpperCase()) !== rec.token_hash) return null;
      return rec;
    }
    function saveFiles(files, id) {
      return (files || []).slice(0, LIMITS.files).map(function (f) { return deps.saveFile(f, id) });
    }
    function checkFiles(files) {
      if (!Array.isArray(files)) return '';
      if (files.length > LIMITS.files) return 'แนบไฟล์ได้ไม่เกิน ' + LIMITS.files + ' ไฟล์';
      for (var i = 0; i < files.length; i++) {
        var f = files[i] || {};
        if (FILE_TYPES.indexOf(f.type) < 0) return 'ไฟล์ ' + str(f.name, 80) + ' ต้องเป็น PDF, JPG, PNG หรือ WEBP';
        if (String(f.data || '').length * 0.75 > LIMITS.fileBytes) return 'ไฟล์ ' + str(f.name, 80) + ' ใหญ่เกิน 5 MB';
      }
      return '';
    }
    function publicView(rec) {
      return { id: rec.id, org_name: rec.org_name, org_type: rec.org_type, status: rec.status, level: rec.level,
        info_request: rec.status === 'need_info' ? rec.info_request : '', created_at: rec.created_at, updated_at: rec.updated_at,
        timeline: db.logsFor(rec.id).filter(function (l) { return l.from_status !== l.to_status || l.public }).map(function (l) {
          return { ts: l.ts, status: l.to_status, level: l.to_level, note: l.public ? l.note : '' };
        }) };
    }

    return {
      apply: function (p) {
        if (p.website) return { ok: true, id: 'HM-0000-0000', token: 'IGNORED' }; // honeypot
        if (!TYPES[p.org_type]) return fail('bad_type', 'เลือกประเภทองค์กร');
        var rec = {
          org_type: p.org_type, org_name: str(p.org_name, 150), reg_no: str(p.reg_no, 60), parent_agency: str(p.parent_agency, 150),
          founded_year: str(p.founded_year, 4), members: Math.min(99999, Math.max(0, Number(p.members) || 0)),
          contact_name: str(p.contact_name, 100), contact_role: str(p.contact_role, 100), contact_phone: phone(p.contact_phone),
          contact_email: str(p.contact_email, 120), contact_line: str(p.contact_line, 60),
          backup_name: str(p.backup_name, 100), backup_phone: phone(p.backup_phone),
          province: str(p.province, 60), districts: str(p.districts, 300), address: str(p.address, 300),
          capabilities: list(p.capabilities, 60, 20), resources: str(p.resources, LIMITS.text), availability: str(p.availability, 100),
          requested_level: 'L' + Math.max(1, Math.min(lv(TYPES[p.org_type].max), LEVELS[p.requested_level] ? lv(p.requested_level) : 1)),
          links: list(p.links, 300, LIMITS.links).filter(function (u) { return /^https?:\/\//i.test(u) }),
          referee: str(p.referee, 200), about: str(p.about, LIMITS.text)
        };
        if (!rec.org_name) return fail('missing', 'กรอกชื่อองค์กร');
        if (!rec.contact_name) return fail('missing', 'กรอกชื่อผู้รับผิดชอบ');
        if (!/^0\d{8,9}$/.test(rec.contact_phone)) return fail('bad_phone', 'เบอร์โทรผู้รับผิดชอบไม่ถูกต้อง');
        if (rec.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.contact_email)) return fail('bad_email', 'อีเมลไม่ถูกต้อง');
        if (!rec.province) return fail('missing', 'เลือกจังหวัดที่ปฏิบัติงาน');
        if (!rec.capabilities.length) return fail('missing', 'เลือกความสามารถอย่างน้อย 1 ข้อ');
        var ag = p.agreements || {};
        for (var i = 0; i < AGREEMENTS.length; i++) if (!ag[AGREEMENTS[i].key]) return fail('agreements', 'ต้องยอมรับข้อตกลงทุกข้อ');
        var fileErr = checkFiles(p.files); if (fileErr) return fail('bad_file', fileErr);
        if (!(p.files || []).length && !rec.links.length) return fail('no_evidence', 'แนบเอกสารหรือใส่ลิงก์หลักฐานอย่างน้อย 1 รายการ');

        var token = deps.token(), now = deps.now();
        rec.id = deps.newId();
        rec.created_at = now; rec.updated_at = now; rec.status = 'pending'; rec.level = 'L0';
        rec.token_hash = deps.hash(token); rec.agreements = ag; rec.agreed_at = now;
        rec.checklist = {}; rec.admin_note = ''; rec.info_request = ''; rec.responses = []; rec.reviewer = ''; rec.decided_at = '';
        rec.docs = saveFiles(p.files, rec.id);
        db.insert(rec);
        audit(rec, 'ผู้สมัคร', 'submitted', { status: '', level: '' }, '');
        return { ok: true, id: rec.id, token: token };
      },

      status: function (p) {
        var rec = authApplicant(p);
        return rec ? { ok: true, application: publicView(rec) } : fail('not_found', 'ไม่พบใบสมัคร หรือรหัสติดตามไม่ถูกต้อง');
      },

      resubmit: function (p) {
        var rec = authApplicant(p);
        if (!rec) return fail('not_found', 'ไม่พบใบสมัคร หรือรหัสติดตามไม่ถูกต้อง');
        if (rec.status !== 'need_info') return fail('bad_state', 'ใบสมัครนี้ไม่ได้อยู่ในสถานะขอข้อมูลเพิ่ม');
        var msg = str(p.message, LIMITS.text), links = list(p.links, 300, LIMITS.links).filter(function (u) { return /^https?:\/\//i.test(u) });
        var fileErr = checkFiles(p.files); if (fileErr) return fail('bad_file', fileErr);
        if (!msg && !links.length && !(p.files || []).length) return fail('missing', 'พิมพ์คำตอบหรือแนบหลักฐานเพิ่ม');
        if ((rec.docs || []).length + (p.files || []).length > LIMITS.files * 3) return fail('bad_file', 'แนบไฟล์รวมเกินจำนวนที่รับได้');
        var before = { status: rec.status, level: rec.level };
        rec.docs = (rec.docs || []).concat(saveFiles(p.files, rec.id));
        rec.links = (rec.links || []).concat(links).slice(0, LIMITS.links * 3);
        rec.responses = (rec.responses || []).concat([{ ts: deps.now(), question: rec.info_request, message: msg }]);
        rec.status = 'pending'; rec.info_request = ''; rec.updated_at = deps.now();
        db.update(rec);
        audit(rec, 'ผู้สมัคร', 'resubmitted', before, msg);
        return { ok: true, application: publicView(rec) };
      },

      /* ---------- ฝั่งแอดมิน (เรียกหลังตรวจรหัสแอดมินแล้วเท่านั้น) ---------- */
      list: function () {
        var all = db.all(), byPhone = {}, byReg = {};
        all.forEach(function (r) {
          byPhone[r.contact_phone] = (byPhone[r.contact_phone] || 0) + 1;
          if (r.reg_no) byReg[r.reg_no] = (byReg[r.reg_no] || 0) + 1;
        });
        return { ok: true, partners: all.map(function (r) {
          return { id: r.id, org_name: r.org_name, org_type: r.org_type, province: r.province, status: r.status, level: r.level,
            requested_level: r.requested_level, created_at: r.created_at, updated_at: r.updated_at, reviewer: r.reviewer,
            capabilities: r.capabilities, docs: (r.docs || []).length + (r.links || []).length,
            checks_done: checksFor(r.org_type).filter(function (c) { return (r.checklist || {})[c.key] }).length, checks_total: checksFor(r.org_type).length,
            duplicate: byPhone[r.contact_phone] > 1 || (r.reg_no && byReg[r.reg_no] > 1) ? 1 : 0 };
        }) };
      },

      get: function (p) {
        var rec = db.get(str(p.id, 30));
        if (!rec) return fail('not_found', 'ไม่พบใบสมัคร');
        var out = {}; for (var k in rec) if (k !== 'token_hash') out[k] = rec[k];
        out.duplicates = db.all().filter(function (r) { return r.id !== rec.id && (r.contact_phone === rec.contact_phone || (rec.reg_no && r.reg_no === rec.reg_no)) })
          .map(function (r) { return { id: r.id, org_name: r.org_name, status: r.status } });
        return { ok: true, partner: out, log: db.logsFor(rec.id) };
      },

      /* บันทึก checklist และโน้ตภายใน ไม่เปลี่ยนสถานะ */
      review: function (p, actor) {
        var rec = db.get(str(p.id, 30));
        if (!rec) return fail('not_found', 'ไม่พบใบสมัคร');
        var valid = {}; checksFor(rec.org_type).forEach(function (c) { valid[c.key] = 1 });
        var cl = {}, inp = p.checklist || {};
        for (var k in valid) if (inp[k]) cl[k] = 1;
        var changed = JSON.stringify(cl) !== JSON.stringify(rec.checklist || {}) || str(p.admin_note, LIMITS.text) !== (rec.admin_note || '');
        if (!changed) return { ok: true, partner: rec, unchanged: true };
        var before = { status: rec.status, level: rec.level };
        rec.checklist = cl; rec.admin_note = str(p.admin_note, LIMITS.text); rec.updated_at = deps.now();
        if (!rec.reviewer) rec.reviewer = actor;
        db.update(rec);
        audit(rec, actor, 'checklist', before, Object.keys(cl).length + '/' + checksFor(rec.org_type).length + ' รายการ');
        return { ok: true };
      },

      decide: function (p, actor) {
        var rec = db.get(str(p.id, 30)), name = String(p.act || ''), act = ACTIONS.hasOwnProperty(name) ? ACTIONS[name] : null;
        if (!rec) return fail('not_found', 'ไม่พบใบสมัคร');
        if (!act) return fail('bad_action', 'ไม่รู้จักคำสั่งนี้');
        if (act.from.indexOf(rec.status) < 0) return fail('bad_state', 'ทำรายการนี้ไม่ได้เมื่อสถานะเป็น "' + STATUSES[rec.status] + '"');
        var note = str(p.note, LIMITS.text);
        if (act.note && !note) return fail('need_note', 'ต้องระบุเหตุผล');
        var level = rec.level;
        if (act.level) {
          level = str(p.level, 2);
          if (!LEVELS[level] || level === 'L0') return fail('bad_level', 'เลือกระดับสิทธิ์ L1–L3');
          if (lv(level) > lv(TYPES[rec.org_type].max)) return fail('over_cap', TYPES[rec.org_type].name + ' ได้สิทธิ์สูงสุด ' + TYPES[rec.org_type].max);
          var miss = missingChecks(rec, level);
          if (miss.length) return fail('checks', 'ยังตรวจไม่ครบสำหรับ ' + level + ': ' + miss.map(function (c) { return c.label }).join(', '));
          if (name === 'set_level' && level === rec.level) return fail('same_level', 'ระดับสิทธิ์เท่าเดิม');
        }
        var before = { status: rec.status, level: rec.level };
        rec.status = act.to;
        rec.level = act.to === 'approved' ? level : 'L0';
        if (name === 'request_info') rec.info_request = note;
        if (name === 'suspend') rec.suspended_reason = note;
        if (name === 'reinstate') rec.suspended_reason = '';
        if (name !== 'start_review') { rec.decided_at = deps.now() }
        rec.reviewer = actor; rec.updated_at = deps.now();
        db.update(rec);
        audit(rec, actor, name, before, note);
        return { ok: true };
      }
    };
  }

  return { LEVELS: LEVELS, TYPES: TYPES, STATUSES: STATUSES, CAPABILITIES: CAPABILITIES, AGREEMENTS: AGREEMENTS, LIMITS: LIMITS,
    FILE_TYPES: FILE_TYPES, ACTIONS: ACTIONS, checksFor: checksFor, missingChecks: missingChecks, lv: lv, createCore: createCore };
})();
if (typeof module !== 'undefined') module.exports = HM;
