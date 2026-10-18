/* เชื่อมต่อฐานข้อมูล
   ใส่ URL ของ Google Apps Script (Deploy → Web app) ที่ API_URL เพื่อใช้ฐานข้อมูลจริงใน Google Sheet
   ถ้าเว้นว่าง หน้าเว็บจะทำงานแบบ "โหมดทดลอง" เก็บข้อมูลตัวอย่างไว้ในเบราว์เซอร์นี้เท่านั้น */
var API_URL = '';
var DEMO = !API_URL;
var DEMO_ADMIN_KEY = 'demo';

var Api = (function () {
  async function remote(body) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 60000);
    try {
      const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal, cache: 'no-store' });
      return await r.json();
    } finally { clearTimeout(tm) }
  }

  /* ---------- โหมดทดลอง: ฐานข้อมูลจำลองใน localStorage ---------- */
  const KEY = 'hm4u_demo_db_v1';
  let mem = null;
  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) { mem = null }
    if (!mem || !mem.partners) mem = seed();
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch (e) { } }
  const demoHash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return 'demo-' + (h >>> 0).toString(16) };
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = n => Array.from({ length: n }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  const db = {
    all: () => load().partners.slice().sort((a, b) => b.created_at - a.created_at),
    get: id => load().partners.find(p => p.id === id) || null,
    insert: r => { load().partners.push(r); save() },
    update: r => { const d = load(), i = d.partners.findIndex(p => p.id === r.id); d.partners[i] = r; save() },
    log: e => { load().logs.push(e); save() },
    logsFor: id => load().logs.filter(l => l.partner_id === id).sort((a, b) => a.ts - b.ts)
  };
  const deps = {
    now: () => Date.now(), token: () => rand(10), hash: demoHash,
    newId: () => { const d = new Date(); return 'HM-' + String(d.getFullYear() + 543).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + '-' + rand(4) },
    saveFile: f => ({ kind: f.kind || 'เอกสาร', name: String(f.name || 'file').slice(0, 120), type: f.type, size: Math.round(String(f.data || '').length * 0.75), ref: '' })
  };
  const core = HM.createCore(db, deps);

  function seed() {
    const H = 3600e3, now = Date.now(), all = { truth: 1, verify: 1, pdpa: 1, victim_data: 1, revoke: 1 };
    const base = { agreements: all, backup_name: '', backup_phone: '', contact_line: '', founded_year: '', parent_agency: '', reg_no: '', referee: '', about: '', responses: [], suspended_reason: '', admin_note: '', info_request: '' };
    const doc = (kind, name) => ({ kind, name, type: 'application/pdf', size: 420000, ref: '' });
    const P = [
      { ...base, id: 'HM-6910-K7QF', org_type: 'foundation', org_name: 'มูลนิธิสายน้ำใจ (ตัวอย่าง)', reg_no: 'กท.1234', founded_year: '2548', members: 120,
        contact_name: 'สมชาย ใจดี', contact_role: 'ผู้จัดการฝ่ายภัยพิบัติ', contact_phone: '0812345678', contact_email: 'ops@example.org', province: 'กรุงเทพมหานคร', districts: 'บางนา, ประเวศ, สะพานสูง',
        capabilities: ['เรือ', 'อพยพ / กู้ภัยทางน้ำ', 'ถุงยังชีพ'], resources: 'เรือท้องแบน 4 ลำ, รถกระบะยกสูง 2 คัน', availability: '24 ชม. ช่วงน้ำท่วม', requested_level: 'L2',
        links: ['https://example.org/flood-2025'], docs: [doc('ใบอนุญาตจัดตั้ง', 'ใบอนุญาตมูลนิธิ.pdf'), doc('หนังสือมอบหมาย', 'หนังสือมอบหมายผู้ประสานงาน.pdf')],
        status: 'pending', level: 'L0', checklist: {}, reviewer: '', created_at: now - 5 * H, updated_at: now - 5 * H, decided_at: '' },
      { ...base, id: 'HM-6910-W3RM', org_type: 'warroom', org_name: 'War Room เขตตัวอย่าง', parent_agency: 'สำนักงานเขตตัวอย่าง', members: 30,
        contact_name: 'วิภา ประสานงาน', contact_role: 'หัวหน้ากะ', contact_phone: '0223456789', contact_email: 'warroom@example.go.th', province: 'กรุงเทพมหานคร', districts: 'ทั้งเขต',
        capabilities: ['ประสานงาน / คอลเซ็นเตอร์', 'สื่อสาร / วิทยุ'], resources: 'ศูนย์รับแจ้ง 6 คู่สาย', availability: 'เปิดศูนย์ 24 ชม.', requested_level: 'L3',
        links: [], docs: [doc('คำสั่งจัดตั้งศูนย์', 'คำสั่งจัดตั้งศูนย์.pdf')],
        status: 'reviewing', level: 'L0', checklist: { contact_called: 1, command_order: 1 }, reviewer: 'แอดมินทดลอง', created_at: now - 26 * H, updated_at: now - 3 * H, decided_at: '' },
      { ...base, id: 'HM-6910-T8VN', org_type: 'volunteer', org_name: 'กลุ่มอาสาเรือชุมชน (ตัวอย่าง)', members: 15,
        contact_name: 'อนันต์ พายเรือ', contact_role: 'หัวหน้ากลุ่ม', contact_phone: '0898765432', province: 'ปทุมธานี', districts: 'ลำลูกกา, คลองหลวง',
        capabilities: ['เรือ', 'อพยพ / กู้ภัยทางน้ำ'], resources: 'เรือหางยาว 2 ลำ', availability: 'เย็น–ค่ำ', requested_level: 'L2',
        links: ['https://facebook.com/example-boat-volunteers'], docs: [], referee: 'มูลนิธิสายน้ำใจ (ตัวอย่าง)',
        status: 'need_info', level: 'L0', checklist: { contact_called: 1 }, info_request: 'ขอภาพหรือลิงก์ผลงานช่วยเหลือที่ผ่านมา และเบอร์ติดต่อผู้รับรอง',
        reviewer: 'แอดมินทดลอง', created_at: now - 50 * H, updated_at: now - 20 * H, decided_at: now - 20 * H },
      { ...base, id: 'HM-6910-B2DX', org_type: 'government', org_name: 'องค์การบริหารส่วนตำบลตัวอย่าง', members: 40,
        contact_name: 'ปกรณ์ ราชการ', contact_role: 'ปลัด อบต.', contact_phone: '0356789012', contact_email: 'contact@example.go.th', province: 'พระนครศรีอยุธยา', districts: 'บางบาล',
        capabilities: ['ที่พักชั่วคราว', 'อาหาร / ครัวกลาง', 'รถสูง / รถขนส่ง'], resources: 'อาคารอเนกประสงค์ รับได้ 200 คน', availability: 'เวลาราชการ + เวรฉุกเฉิน', requested_level: 'L3',
        links: [], docs: [doc('หนังสือราชการ', 'หนังสือแจ้งผู้ประสานงาน.pdf')],
        status: 'approved', level: 'L3', checklist: { contact_called: 1, leader_id: 1, area_ok: 1, official_letter: 1, official_channel: 1 },
        reviewer: 'แอดมินทดลอง', created_at: now - 120 * H, updated_at: now - 90 * H, decided_at: now - 90 * H },
      { ...base, id: 'HM-6910-Z5PC', org_type: 'business', org_name: 'บริษัท ขนส่งตัวอย่าง จำกัด', reg_no: '0105555000000', members: 8,
        contact_name: 'ศิริพร ซีเอสอาร์', contact_role: 'ผู้จัดการ CSR', contact_phone: '0811112222', province: 'นนทบุรี', districts: '',
        capabilities: ['รถสูง / รถขนส่ง', 'บริจาคเงิน / สิ่งของ'], resources: 'รถ 6 ล้อ 3 คัน', availability: 'สุดสัปดาห์', requested_level: 'L1',
        links: [], docs: [doc('หนังสือรับรองบริษัท', 'หนังสือรับรองบริษัท.pdf')],
        status: 'suspended', level: 'L0', checklist: { contact_called: 1, company_cert: 1 }, suspended_reason: 'นำภาพผู้ประสบภัยไปใช้โฆษณาโดยไม่ได้รับอนุญาต',
        reviewer: 'แอดมินทดลอง', created_at: now - 200 * H, updated_at: now - 30 * H, decided_at: now - 30 * H }
    ];
    const L = [];
    const add = (p, ts, actor, action, fs, ts2, fl, tl, note, pub) => L.push({ ts, partner_id: p, actor, action, from_status: fs, to_status: ts2, from_level: fl, to_level: tl, note: note || '', public: pub ? 1 : 0 });
    P.forEach(p => add(p.id, p.created_at, 'ผู้สมัคร', 'submitted', '', 'pending', '', 'L0', '', 1));
    add('HM-6910-W3RM', now - 4 * H, 'แอดมินทดลอง', 'start_review', 'pending', 'reviewing', 'L0', 'L0');
    add('HM-6910-W3RM', now - 3 * H, 'แอดมินทดลอง', 'checklist', 'reviewing', 'reviewing', 'L0', 'L0', '2/5 รายการ');
    add('HM-6910-T8VN', now - 20 * H, 'แอดมินทดลอง', 'request_info', 'pending', 'need_info', 'L0', 'L0', P[2].info_request, 1);
    add('HM-6910-B2DX', now - 90 * H, 'แอดมินทดลอง', 'approve', 'reviewing', 'approved', 'L0', 'L3', 'ยืนยันกับสำนักงานแล้ว');
    add('HM-6910-Z5PC', now - 150 * H, 'แอดมินทดลอง', 'approve', 'pending', 'approved', 'L0', 'L1', '');
    add('HM-6910-Z5PC', now - 30 * H, 'แอดมินทดลอง', 'suspend', 'approved', 'suspended', 'L1', 'L0', P[4].suspended_reason, 1);
    /* ใบสมัครตัวอย่างที่ผู้สมัครติดตามได้: HM-6910-T8VN / รหัส DEMO2026 */
    P[2].token_hash = demoHash('DEMO2026');
    P.forEach(p => { if (!p.token_hash) p.token_hash = demoHash(rand(10)) });
    return { partners: P, logs: L };
  }

  async function local(body) {
    await new Promise(r => setTimeout(r, 250));
    const { action, key, ...p } = body;
    if (['apply', 'status', 'resubmit'].includes(action)) return core[action](p);
    if (key !== DEMO_ADMIN_KEY) return { ok: false, error: 'not_admin', message: 'รหัสแอดมินไม่ถูกต้อง (โหมดทดลองใช้รหัส demo)' };
    const actor = 'แอดมินทดลอง';
    if (action === 'whoami') return { ok: true, name: actor };
    if (['list', 'get', 'review', 'decide'].includes(action)) return core[action](p, actor);
    return { ok: false, error: 'bad_action' };
  }

  return {
    call: body => DEMO ? local(body) : remote(body),
    resetDemo: () => { mem = seed(); save() }
  };
})();
