/* หน้า Admin Verification: คิวใบสมัคร, ตรวจ checklist, ตัดสินใจ, Audit Log
   หน้าเว็บแค่ส่งคำสั่ง ทุกกฎ (สถานะที่เปลี่ยนได้, เพดานสิทธิ์, checklist ที่ต้องครบ) ตรวจซ้ำที่ฝั่งเซิร์ฟเวอร์ใน core.js */
const ACTION_UI = {
  start_review: { label: 'เริ่มตรวจ', cls: '', hint: 'ย้ายเข้าสถานะกำลังตรวจสอบ และบันทึกชื่อคุณเป็นผู้ตรวจ' },
  request_info: { label: 'ขอข้อมูลเพิ่ม', cls: '', hint: 'ข้อความนี้จะแสดงให้ผู้สมัครเห็นในหน้าติดตาม' },
  approve: { label: 'อนุมัติ (Verified)', cls: 'primary', hint: 'เลือกระดับสิทธิ์ ระบบเปิดให้เฉพาะระดับที่ตรวจครบแล้ว' },
  set_level: { label: 'เปลี่ยนระดับสิทธิ์', cls: '', hint: 'ระบุเหตุผลการปรับระดับ' },
  reject: { label: 'ไม่อนุมัติ', cls: 'danger', hint: 'เหตุผลจะแสดงให้ผู้สมัครเห็น' },
  suspend: { label: 'ระงับสิทธิ์', cls: 'danger', hint: 'สิทธิ์กลับเป็น L0 ทันที เหตุผลจะแสดงให้ผู้สมัครเห็น' },
  reinstate: { label: 'คืนสิทธิ์', cls: 'primary', hint: 'ระบุสิ่งที่ตรวจแล้วก่อนคืนสิทธิ์' }
};
const TABS = [
  { key: 'todo', label: 'ต้องตรวจ', has: s => s === 'pending' || s === 'reviewing' },
  { key: 'need_info', label: 'ขอข้อมูลเพิ่ม', has: s => s === 'need_info' },
  { key: 'approved', label: 'Verified', has: s => s === 'approved' },
  { key: 'suspended', label: 'ระงับสิทธิ์', has: s => s === 'suspended' },
  { key: 'rejected', label: 'ไม่อนุมัติ', has: s => s === 'rejected' },
  { key: 'all', label: 'ทั้งหมด', has: () => true }
];
const LOG_LABEL = { submitted: 'ส่งใบสมัคร', resubmitted: 'ผู้สมัครส่งข้อมูลเพิ่ม', checklist: 'บันทึกผลตรวจ', start_review: 'เริ่มตรวจ', request_info: 'ขอข้อมูลเพิ่ม',
  approve: 'อนุมัติ', reject: 'ไม่อนุมัติ', suspend: 'ระงับสิทธิ์', reinstate: 'คืนสิทธิ์', set_level: 'เปลี่ยนระดับสิทธิ์' };
const S = { key: store.get('hm4u_admin_key'), partners: [], tab: 'todo', cur: null, rec: null, pending: null };

demoBar();
$('#f-type').innerHTML += Object.entries(HM.TYPES).map(([k, t]) => `<option value="${k}">${esc(t.name)}</option>`).join('');
if (DEMO) $('#login-hint').innerHTML = 'โหมดทดลอง: ใช้รหัส <b class="mono">demo</b>';

const api = async body => {
  const r = await Api.call({ ...body, key: S.key });
  if (r && r.error === 'not_admin') { logout('รหัสไม่ถูกต้องหรือถูกยกเลิก กรุณาเข้าสู่ระบบใหม่'); throw new Error('auth') }
  return r;
};
function logout(msg) { store.set('hm4u_admin_key', ''); S.key = ''; $('#app').hidden = true; $('#logout').hidden = true; $('#login').hidden = false; $('#login-err').textContent = msg || '' }
$('#logout').addEventListener('click', e => { e.preventDefault(); logout('ออกจากระบบแล้ว') });
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); S.key = $('#login-key').value.trim(); if (!S.key) return;
  $('#login-go').disabled = true; $('#login-err').textContent = 'กำลังตรวจรหัส…';
  try { const r = await Api.call({ action: 'whoami', key: S.key });
    if (!r.ok) { $('#login-err').textContent = r.message || 'รหัสไม่ถูกต้อง'; S.key = ''; return }
    store.set('hm4u_admin_key', S.key, $('#login-remember').checked); $('#login-key').value = ''; start(r.name) }
  catch (err) { $('#login-err').textContent = 'เชื่อมต่อไม่ได้ ลองอีกครั้ง'; S.key = '' }
  finally { $('#login-go').disabled = false }
});

async function start(name) {
  $('#login').hidden = true; $('#app').hidden = false; $('#logout').hidden = false; $('#who').textContent = 'ผู้ตรวจ: ' + name;
  await loadList();
  const first = filtered()[0]; if (first && innerWidth > 900) open(first.id);
}
async function loadList() {
  try { const r = await api({ action: 'list' }); if (r.ok) { S.partners = r.partners; renderTabs(); renderQueue() } else toast(r.message || 'โหลดคิวไม่สำเร็จ', 1) }
  catch (e) { if (e.message !== 'auth') toast('เชื่อมต่อไม่ได้', 1) }
}
$('#reload').addEventListener('click', async () => { await loadList(); if (S.cur) open(S.cur) });

/* ---------- คิว ---------- */
function filtered() {
  const t = TABS.find(x => x.key === S.tab), q = $('#q').value.trim().toLowerCase(), ty = $('#f-type').value;
  return S.partners.filter(p => t.has(p.status) && (!ty || p.org_type === ty) && (!q || [p.org_name, p.province, p.id].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => S.tab === 'todo' ? a.created_at - b.created_at : b.updated_at - a.updated_at);
}
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(t => `<button type="button" data-tab="${t.key}" aria-pressed="${t.key === S.tab}">${t.label}<b>${S.partners.filter(p => t.has(p.status)).length}</b></button>`).join('');
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; renderTabs(); renderQueue() });
$('#q').addEventListener('input', renderQueue); $('#f-type').addEventListener('change', renderQueue);
function renderQueue() {
  const list = filtered();
  $('#queue').innerHTML = list.length ? list.map(p => `<button type="button" data-id="${esc(p.id)}" aria-current="${p.id === S.cur}">
    <div class="row"><span class="name">${esc(p.org_name)}</span>${pill(p.status)}</div>
    <div class="row small muted"><span>${esc(HM.TYPES[p.org_type].name)} · ${esc(p.province)}</span><span class="mono">${esc(p.id)}</span></div>
    <div class="row small"><span>${p.status === 'approved' ? lvTag(p.level) : 'ขอ ' + lvTag(p.requested_level)}</span>
      <span class="muted" title="ตรวจแล้ว ${p.checks_done}/${p.checks_total}" style="display:flex;gap:6px;align-items:center"><span class="meter"><i style="width:${Math.round(p.checks_done / p.checks_total * 100)}%"></i></span>${p.checks_done}/${p.checks_total}</span></div>
    ${p.duplicate ? '<div class="small" style="color:var(--warn)">⚠ เบอร์โทรหรือเลขทะเบียนซ้ำกับใบสมัครอื่น</div>' : ''}
    <div class="small muted">ส่งเมื่อ ${fmtTime(p.created_at)} · หลักฐาน ${p.docs} รายการ</div></button>`).join('')
    : '<p class="empty">ไม่มีใบสมัครในกลุ่มนี้</p>';
}
$('#queue').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) open(b.dataset.id) });

/* ---------- รายละเอียด ---------- */
async function open(id) {
  S.cur = id; S.pending = null; renderQueue(); $('#admin').classList.add('has-detail');
  $('#detail').innerHTML = '<p class="empty">กำลังโหลด…</p>';
  try { const r = await api({ action: 'get', id }); if (!r.ok) { $('#detail').innerHTML = `<p class="empty">${esc(r.message)}</p>`; return } S.rec = r; renderDetail() }
  catch (e) { if (e.message !== 'auth') $('#detail').innerHTML = '<p class="empty">โหลดไม่สำเร็จ</p>' }
}
const dl = rows => { const r = rows.filter(x => x[1]); return r.length ? '<dl class="summary">' + r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>' : '' };
const tel = p => p ? `<a href="tel:${esc(p)}" class="mono">${esc(p.replace(/^(\d{2,3})(\d{3})(\d{3,4})$/, '$1-$2-$3'))}</a>` : '';
function renderDetail() {
  const p = S.rec.partner, t = HM.TYPES[p.org_type], checks = HM.checksFor(p.org_type), cl = p.checklist || {};
  const actions = Object.keys(HM.ACTIONS).filter(a => HM.ACTIONS[a].from.includes(p.status));
  $('#detail').innerHTML = `
  <section>
    <button type="button" class="btn sm ghost back" id="back">← กลับไปคิว</button>
    <div class="actions"><h2 class="grow">${esc(p.org_name)}</h2>${pill(p.status)}${lvTag(p.level)}</div>
    <p class="small muted"><span class="mono">${esc(p.id)}</span> · ${esc(t.name)} · ส่งเมื่อ ${fmtTime(p.created_at)} · สิทธิ์สูงสุดของประเภทนี้ ${esc(t.max)}</p>
    ${p.duplicates.length ? `<div class="notice warn"><b>พบข้อมูลซ้ำ</b><span>${p.duplicates.map(d => `${esc(d.org_name)} (<span class="mono">${esc(d.id)}</span>, ${esc(HM.STATUSES[d.status])})`).join(', ')}</span></div>` : ''}
    ${p.status === 'suspended' ? `<div class="notice bad"><b>เหตุผลที่ระงับ</b><span>${esc(p.suspended_reason)}</span></div>` : ''}
    ${p.status === 'need_info' ? `<div class="notice warn"><b>รอผู้สมัครตอบ</b><span>${esc(p.info_request)}</span></div>` : ''}
  </section>
  <section><h3>องค์กร</h3>${dl([['เลขทะเบียน', esc(p.reg_no)], ['ต้นสังกัด', esc(p.parent_agency)], ['เริ่มดำเนินงาน', esc(p.founded_year)],
    ['สมาชิก', p.members ? esc(p.members) + ' คน' : ''], ['เกี่ยวกับองค์กร', esc(p.about)]]) || '<p class="muted small">ไม่ได้กรอกเพิ่ม</p>'}</section>
  <section><h3>ผู้รับผิดชอบ</h3>${dl([['ชื่อ', esc(p.contact_name) + (p.contact_role ? ' · ' + esc(p.contact_role) : '')], ['เบอร์โทร', tel(p.contact_phone)],
    ['อีเมล', esc(p.contact_email)], ['LINE', esc(p.contact_line)], ['ผู้ติดต่อสำรอง', p.backup_name ? esc(p.backup_name) + ' ' + tel(p.backup_phone) : '']])}</section>
  <section><h3>พื้นที่และความสามารถ</h3>${dl([['จังหวัด', esc(p.province)], ['เขต / อำเภอ', esc(p.districts)], ['ที่ตั้ง', esc(p.address)],
    ['ความสามารถ', (p.capabilities || []).map(esc).join(', ')], ['ทรัพยากร', esc(p.resources)], ['เวลาพร้อม', esc(p.availability)], ['ขอสิทธิ์', lvTag(p.requested_level)]])}</section>
  <section><h3>หลักฐาน</h3>
    <div class="hint small"><b>ที่ควรมีสำหรับ${esc(t.name)}</b><span>${esc(t.hint)}</span></div>
    <ul class="doc-list">${(p.docs || []).map(d => `<li>${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : `<span>${esc(d.name)}</span>`}<span class="small muted">${esc(d.kind)}${d.size ? ' · ' + (d.size / 1048576).toFixed(1) + ' MB' : ''}${!d.url && DEMO ? ' · ไฟล์ตัวอย่าง' : ''}</span></li>`).join('')}
      ${(p.links || []).map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a><span class="small muted">ลิงก์</span></li>`).join('')}</ul>
    ${!(p.docs || []).length && !(p.links || []).length ? '<p class="muted small">ยังไม่มีหลักฐาน</p>' : ''}
    ${p.referee ? dl([['ผู้รับรอง', esc(p.referee)]]) : ''}
    ${(p.responses || []).map(r => `<div class="notice info"><b>คำตอบผู้สมัคร · ${fmtTime(r.ts)}</b><span class="small">ถาม: ${esc(r.question)}</span><span>${esc(r.message) || '(แนบหลักฐานเพิ่มโดยไม่มีข้อความ)'}</span></div>`).join('')}
  </section>
  <section><h3>ผลการตรวจ</h3>
    <form id="checks" class="detail">
      ${checks.map(c => `<div class="check-row"><input type="checkbox" id="ck-${c.key}" name="${c.key}" ${cl[c.key] ? 'checked' : ''}><label for="ck-${c.key}">${esc(c.label)}</label><span class="small muted">จำเป็นสำหรับ ${lvTag(c.min)}</span></div>`).join('')}
      <label class="field">โน้ตภายใน<small>ผู้สมัครไม่เห็น</small><textarea id="admin-note" maxlength="1000">${esc(p.admin_note)}</textarea></label>
      <div class="actions"><button class="btn sm" id="save-checks">บันทึกผลตรวจ</button><span class="small muted" id="checks-state"></span></div>
    </form>
  </section>
  <section><h3>ตัดสินใจ</h3>
    ${actions.length ? `<div class="actions">${actions.map(a => `<button type="button" class="btn ${ACTION_UI[a].cls}" data-act="${a}">${ACTION_UI[a].label}</button>`).join('')}</div>` : '<p class="muted small">ใบสมัครที่ไม่อนุมัติแล้วเปลี่ยนสถานะไม่ได้ ผู้สมัครต้องยื่นใหม่</p>'}
    <div id="decision"></div>
  </section>
  <section><h3>Audit Log</h3><ol class="timeline">${S.rec.log.slice().reverse().map(l => `<li><div>
    <div><b>${esc(LOG_LABEL[l.action] || l.action)}</b> <span class="small muted">โดย ${esc(l.actor)}</span></div>
    <div class="when">${fmtTime(l.ts)}${l.from_status !== l.to_status ? ` · ${esc(HM.STATUSES[l.from_status] || '–')} → ${esc(HM.STATUSES[l.to_status])}` : ''}${l.from_level !== l.to_level && l.from_level ? ` · ${esc(l.from_level)} → ${esc(l.to_level)}` : ''}</div>
    ${l.note ? `<p class="small">${esc(l.note)}${Number(l.public) ? ' <span class="muted">(ผู้สมัครเห็น)</span>' : ''}</p>` : ''}</div></li>`).join('')}</ol></section>`;
  $('#back').addEventListener('click', () => { $('#admin').classList.remove('has-detail'); S.cur = null; renderQueue() });
  $('#checks').addEventListener('change', () => { $('#checks-state').textContent = 'ยังไม่บันทึก'; if (S.pending) renderDecision() });
  $('#checks').addEventListener('input', () => { $('#checks-state').textContent = 'ยังไม่บันทึก' });
  $('#checks').addEventListener('submit', async e => { e.preventDefault(); await saveChecks(true) });
  $$('[data-act]').forEach(b => b.addEventListener('click', () => { S.pending = b.dataset.act; renderDecision(); $('#decision').scrollIntoView({ block: 'nearest' }) }));
}
const formChecks = () => Object.fromEntries(HM.checksFor(S.rec.partner.org_type).map(c => [c.key, $('#ck-' + c.key).checked ? 1 : 0]).filter(x => x[1]));
async function saveChecks(reload) {
  const r = await api({ action: 'review', id: S.cur, checklist: formChecks(), admin_note: $('#admin-note').value });
  if (!r.ok) { toast(r.message || 'บันทึกไม่สำเร็จ', 1); return false }
  if (reload) { toast(r.unchanged ? 'ไม่มีอะไรเปลี่ยน' : 'บันทึกผลตรวจแล้ว'); await refresh() }
  return true;
}
async function refresh() { const id = S.cur, act = S.pending; await loadList(); await open(id); if (act && HM.ACTIONS[act].from.includes(S.rec.partner.status)) { S.pending = act; renderDecision() } }

/* แผงยืนยันการตัดสินใจ (หน้าเว็บนี้ไม่ใช้ confirm() ของเบราว์เซอร์) */
function renderDecision() {
  const a = S.pending, act = HM.ACTIONS[a], ui = ACTION_UI[a], p = S.rec.partner, max = HM.lv(HM.TYPES[p.org_type].max);
  const draft = { ...p, checklist: formChecks() };
  const levels = act.level ? ['L1', 'L2', 'L3'].map(l => {
    const over = HM.lv(l) > max, miss = HM.missingChecks(draft, l), same = a === 'set_level' && l === p.level;
    return { l, ok: !over && !miss.length && !same, why: over ? 'เกินเพดานของประเภทนี้' : same ? 'ระดับปัจจุบัน' : miss.length ? 'ยังขาด: ' + miss.map(c => c.label).join(', ') : '' };
  }) : [];
  const pick = levels.filter(x => x.ok).map(x => x.l), want = pick.includes(p.requested_level) ? p.requested_level : pick[pick.length - 1];
  $('#decision').innerHTML = `<form class="confirm" id="decide-form">
    <b>${ui.label}</b><p class="small muted">${ui.hint}</p>
    ${act.level ? `<div class="level-pick">${levels.map(x => `<label title="${esc(x.why)}"><input type="radio" name="level" value="${x.l}" ${x.ok ? '' : 'disabled'} ${x.l === want ? 'checked' : ''}>${lvTag(x.l)}</label>`).join('')}</div>
      ${levels.filter(x => !x.ok && x.why && x.why !== 'ระดับปัจจุบัน').map(x => `<p class="small muted"><b class="mono">${x.l}</b> ${esc(x.why)}</p>`).join('')}
      ${!pick.length ? '<p class="error">ยังอนุมัติไม่ได้ ติ๊กผลตรวจให้ครบก่อน</p>' : ''}` : ''}
    <label class="field"><span>${act.note ? 'เหตุผล <i class="req">*</i>' : 'บันทึก (ไม่บังคับ)'}</span><textarea id="decide-note" maxlength="1000" ${act.note ? 'required' : ''}></textarea></label>
    <p class="error" id="decide-err" role="alert" hidden></p>
    <div class="actions"><button class="btn ${ui.cls.includes('danger') ? 'danger solid' : 'primary'}" id="decide-go" ${act.level && !pick.length ? 'disabled' : ''}>ยืนยัน${ui.label}</button>
      <button type="button" class="btn ghost" id="decide-cancel">ยกเลิก</button></div></form>`;
  $('#decide-cancel').addEventListener('click', () => { S.pending = null; $('#decision').innerHTML = '' });
  $('#decide-form').addEventListener('submit', async e => {
    e.preventDefault();
    const note = $('#decide-note').value.trim(), level = ($('#decide-form [name=level]:checked') || {}).value, err = m => { $('#decide-err').textContent = m; $('#decide-err').hidden = !m };
    if (act.note && !note) return err('ต้องระบุเหตุผล');
    $('#decide-go').disabled = true;
    try {
      if ($('#checks-state').textContent && !(await saveChecks(false))) return;
      const r = await api({ action: 'decide', id: S.cur, act: a, level, note });
      if (!r.ok) return err(r.message || 'ทำรายการไม่สำเร็จ');
      toast(ui.label + 'แล้ว'); S.pending = null; await refresh();
    } catch (e2) { if (e2.message !== 'auth') err('เชื่อมต่อไม่ได้') }
    finally { const b = $('#decide-go'); if (b) b.disabled = false }
  });
}

if (S.key) Api.call({ action: 'whoami', key: S.key }).then(r => r.ok ? start(r.name) : logout('')).catch(() => logout('เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วรีเฟรช'));
else { $('#login').hidden = false; setTimeout(() => $('#login-key').focus(), 50) }
