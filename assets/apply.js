/* หน้าสมัครองค์กร + ติดตามใบสมัคร */
const PROVINCES = 'กรุงเทพมหานคร กระบี่ กาญจนบุรี กาฬสินธุ์ กำแพงเพชร ขอนแก่น จันทบุรี ฉะเชิงเทรา ชลบุรี ชัยนาท ชัยภูมิ ชุมพร เชียงราย เชียงใหม่ ตรัง ตราด ตาก นครนายก นครปฐม นครพนม นครราชสีมา นครศรีธรรมราช นครสวรรค์ นนทบุรี นราธิวาส น่าน บึงกาฬ บุรีรัมย์ ปทุมธานี ประจวบคีรีขันธ์ ปราจีนบุรี ปัตตานี พระนครศรีอยุธยา พะเยา พังงา พัทลุง พิจิตร พิษณุโลก เพชรบุรี เพชรบูรณ์ แพร่ ภูเก็ต มหาสารคาม มุกดาหาร แม่ฮ่องสอน ยโสธร ยะลา ร้อยเอ็ด ระนอง ระยอง ราชบุรี ลพบุรี ลำปาง ลำพูน เลย ศรีสะเกษ สกลนคร สงขลา สตูล สมุทรปราการ สมุทรสงคราม สมุทรสาคร สระแก้ว สระบุรี สิงห์บุรี สุโขทัย สุพรรณบุรี สุราษฎร์ธานี สุรินทร์ หนองคาย หนองบัวลำภู อ่างทอง อำนาจเจริญ อุดรธานี อุตรดิตถ์ อุทัยธานี อุบลราชธานี'.split(' ');
const STEP_NAMES = ['ประเภทองค์กร', 'ผู้รับผิดชอบ', 'พื้นที่และความสามารถ', 'หลักฐาน', 'ยืนยัน'];
const DOC_KINDS = ['เอกสารจดทะเบียน', 'หนังสือราชการ / คำสั่ง', 'หนังสือมอบหมายผู้ประสานงาน', 'บัตรประชาชนผู้รับผิดชอบ', 'ภาพผลงาน', 'อื่น ๆ'];
const form = $('#apply-form');
let step = 1, files = [];

$('#ladder').innerHTML = Object.entries(HM.LEVELS).map(([k, v]) => `<div>${lvTag(k)}<p>${esc(v.desc)}</p></div>`).join('');
$('#provinces').innerHTML = PROVINCES.map(p => `<option value="${p}">`).join('');
$('#types').innerHTML = Object.entries(HM.TYPES).map(([k, t]) =>
  `<label><input type="radio" name="org_type" value="${k}" id="type-${k}"><strong>${esc(t.name)}</strong><span class="small muted">สิทธิ์สูงสุด ${lvTag(t.max)}</span></label>`).join('');
$('#caps').innerHTML = HM.CAPABILITIES.map((c, i) => `<label><input type="checkbox" name="capabilities" value="${esc(c)}" id="cap-${i}"><span>${esc(c)}</span></label>`).join('');
$('#agreements').innerHTML = HM.AGREEMENTS.map(a => `<label><input type="checkbox" name="ag_${a.key}" id="ag-${a.key}"><span>${esc(a.label)}</span></label>`).join('');
$('#steps').innerHTML = STEP_NAMES.map((n, i) => `<li data-i="${i + 1}"><b>${i + 1}</b>${n}</li>`).join('');
if (DEMO) $('#track-demo').innerHTML = ' · ลองใช้ <span class="mono">HM-6910-T8VN</span> รหัส <span class="mono">DEMO2026</span>';
demoBar();

const type = () => (form.querySelector('[name=org_type]:checked') || {}).value || '';
function onType() {
  const t = HM.TYPES[type()];
  $('#reg-field').hidden = !['foundation', 'association', 'business'].includes(type());
  $('#parent-field').hidden = !['government', 'warroom'].includes(type());
  $('#evidence-hint').innerHTML = t ? `<b>หลักฐานสำหรับ${esc(t.name)}</b><span>${esc(t.hint)}</span><span class="muted small">ทีมงานจะตรวจ: ${HM.checksFor(type()).map(c => esc(c.label)).join(' · ')}</span>`
    : 'เลือกประเภทองค์กรในขั้นที่ 1 ก่อน';
  const max = t ? HM.lv(t.max) : 3, cur = (form.querySelector('[name=requested_level]:checked') || {}).value;
  $('#req-level').innerHTML = ['L1', 'L2', 'L3'].map(l => `<label><input type="radio" name="requested_level" value="${l}" id="rl-${l}" ${HM.lv(l) > max ? 'disabled' : ''}>${lvTag(l)}</label>`).join('');
  const pick = cur && HM.lv(cur) <= max ? cur : 'L1'; $('#rl-' + pick).checked = true;
}
form.addEventListener('change', e => { if (e.target.name === 'org_type') onType(); e.target.classList.remove('invalid') });
onType();

/* ---------- ไฟล์หลักฐาน ---------- */
function renderFiles() {
  $('#file-list').innerHTML = files.map((f, i) => `<div class="file-row"><span title="${esc(f.file.name)}">${esc(f.file.name)} <span class="muted">· ${(f.file.size / 1048576).toFixed(1)} MB</span></span>
    <select data-i="${i}" id="kind-${i}" aria-label="ประเภทเอกสาร">${DOC_KINDS.map(k => `<option ${k === f.kind ? 'selected' : ''}>${k}</option>`).join('')}</select>
    <button type="button" class="btn ghost sm" data-rm="${i}" aria-label="ลบไฟล์">✕</button></div>`).join('');
}
function addFiles(list) {
  for (const file of list) {
    if (files.length >= HM.LIMITS.files) { toast('แนบได้ไม่เกิน ' + HM.LIMITS.files + ' ไฟล์', 1); break }
    if (!HM.FILE_TYPES.includes(file.type)) { toast(file.name + ': รับเฉพาะ PDF, JPG, PNG, WEBP', 1); continue }
    if (file.size > HM.LIMITS.fileBytes) { toast(file.name + ': ใหญ่เกิน 5 MB', 1); continue }
    files.push({ file, kind: DOC_KINDS[0] });
  }
  renderFiles();
}
$('#f-files').addEventListener('change', e => { addFiles(e.target.files); e.target.value = '' });
$('#file-list').addEventListener('change', e => { if (e.target.dataset.i) files[e.target.dataset.i].kind = e.target.value });
$('#file-list').addEventListener('click', e => { const i = e.target.dataset.rm; if (i != null) { files.splice(Number(i), 1); renderFiles() } });
const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over') }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over') }));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#f-files').click() } });
drop.tabIndex = 0;

/* ---------- ขั้นตอน ---------- */
const val = n => (form.elements[n] && form.elements[n].value || '').trim();
const links = () => val('links').split(/\s+/).filter(Boolean);
function stepError(s) {
  const bad = [];
  if (s === 1) { if (!type()) bad.push(['org_type', 'เลือกประเภทองค์กร']); if (!val('org_name')) bad.push(['org_name', 'กรอกชื่อองค์กร']) }
  if (s === 2) {
    if (!val('contact_name')) bad.push(['contact_name', 'กรอกชื่อผู้รับผิดชอบ']);
    if (!/^0\d{8,9}$/.test(val('contact_phone').replace(/\D/g, ''))) bad.push(['contact_phone', 'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0']);
    if (val('contact_email') && !form.elements.contact_email.checkValidity()) bad.push(['contact_email', 'รูปแบบอีเมลไม่ถูกต้อง']);
  }
  if (s === 3) { if (!val('province')) bad.push(['province', 'ระบุจังหวัดที่ปฏิบัติงาน']); if (!$$('[name=capabilities]:checked').length) bad.push(['', 'เลือกความสามารถอย่างน้อย 1 ข้อ']) }
  if (s === 4) {
    if (!files.length && !links().length) bad.push(['links', 'แนบไฟล์หรือใส่ลิงก์หลักฐานอย่างน้อย 1 รายการ']);
    if (links().some(u => !/^https?:\/\//i.test(u))) bad.push(['links', 'ลิงก์ต้องขึ้นต้นด้วย https://']);
  }
  if (s === 5 && HM.AGREEMENTS.some(a => !$('#ag-' + a.key).checked)) bad.push(['', 'ต้องยอมรับข้อตกลงทุกข้อก่อนส่ง']);
  bad.forEach(([n]) => n && form.elements[n] && form.elements[n].classList && form.elements[n].classList.add('invalid'));
  return bad.map(b => b[1]).join(' · ');
}
function showError(msg) { $('#form-error').textContent = msg; $('#form-error').hidden = !msg }
function go(n) {
  step = n;
  $$('[data-step]', form).forEach(f => f.hidden = Number(f.dataset.step) !== n);
  $$('#steps li').forEach(li => { const i = Number(li.dataset.i); li.className = i === n ? 'now' : i < n ? 'done' : ''; li.toggleAttribute('aria-current', i === n) });
  $('#prev').hidden = n === 1; $('#next').hidden = n === 5; $('#submit').hidden = n !== 5;
  if (n === 5) renderReview();
  showError('');
}
$('#next').addEventListener('click', () => { const e = stepError(step); if (e) return showError(e); go(step + 1); $('#apply').scrollIntoView({ block: 'start' }) });
$('#prev').addEventListener('click', () => go(step - 1));

function renderReview() {
  const t = HM.TYPES[type()], rows = [
    ['ประเภท', t.name], ['ชื่อองค์กร', val('org_name')], ['ผู้รับผิดชอบ', val('contact_name') + (val('contact_role') ? ' (' + val('contact_role') + ')' : '')],
    ['เบอร์โทร', val('contact_phone')], ['พื้นที่', val('province') + (val('districts') ? ' · ' + val('districts') : '')],
    ['ความสามารถ', $$('[name=capabilities]:checked').map(c => c.value).join(', ')],
    ['หลักฐาน', files.length + ' ไฟล์, ' + links().length + ' ลิงก์'],
    ['ขอสิทธิ์', (form.querySelector('[name=requested_level]:checked') || {}).value + ' · ' + HM.LEVELS[(form.querySelector('[name=requested_level]:checked') || {}).value].name]];
  $('#review').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  for (let s = 1; s <= 5; s++) { const err = stepError(s); if (err) { go(s); return showError(err) } }
  const btn = $('#submit'); btn.disabled = true; btn.textContent = files.length ? 'กำลังอัปโหลดหลักฐาน…' : 'กำลังส่ง…';
  try {
    const payload = { action: 'apply', website: val('website'), org_type: type(), requested_level: form.querySelector('[name=requested_level]:checked').value,
      capabilities: $$('[name=capabilities]:checked').map(c => c.value), links: links(),
      agreements: Object.fromEntries(HM.AGREEMENTS.map(a => [a.key, $('#ag-' + a.key).checked ? 1 : 0])),
      files: await Promise.all(files.map(async f => ({ name: f.file.name, type: f.file.type, kind: f.kind, data: await readFile(f.file) }))) };
    ['org_name', 'reg_no', 'parent_agency', 'founded_year', 'members', 'about', 'contact_name', 'contact_role', 'contact_phone', 'contact_email', 'contact_line',
      'backup_name', 'backup_phone', 'province', 'districts', 'address', 'resources', 'availability', 'referee'].forEach(n => payload[n] = val(n));
    const r = await Api.call(payload);
    if (!r.ok) { showError(r.message || 'ส่งไม่สำเร็จ (' + r.error + ')'); return }
    form.hidden = true; $('#steps').hidden = true;
    $('#done').hidden = false;
    $('#done').innerHTML = `<div class="ticket"><h2>ส่งใบสมัครแล้ว</h2>
      <p>เก็บเลขใบสมัครและรหัสติดตามไว้ ใช้ตรวจสถานะและส่งข้อมูลเพิ่มเมื่อทีมงานขอ รหัสติดตามจะแสดงครั้งเดียว</p>
      <div class="codes"><div><span class="small muted">เลขใบสมัคร</span><b id="d-id">${esc(r.id)}</b></div><div><span class="small muted">รหัสติดตาม</span><b id="d-token">${esc(r.token)}</b></div></div>
      <div class="actions"><button type="button" class="btn sm" id="copy-codes">คัดลอกทั้งสองรหัส</button></div></div>
      <div class="notice info"><b>ขั้นต่อไป</b><span>ทีมงานจะโทรยืนยันกับผู้รับผิดชอบและตรวจหลักฐาน ระหว่างนี้องค์กรอยู่ที่ระดับ L0 ยังไม่เห็นข้อมูลผู้ประสบภัย</span></div>`;
    $('#copy-codes').addEventListener('click', ev => copyText('เลขใบสมัคร ' + r.id + ' รหัสติดตาม ' + r.token, ev.target));
    $('#t-id').value = r.id;
    $('#done').scrollIntoView({ block: 'start' });
  } catch (err) { showError('เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่') }
  finally { btn.disabled = false; btn.textContent = 'ส่งใบสมัคร' }
});
go(1);

/* ---------- ติดตามใบสมัคร ---------- */
const STATUS_HELP = {
  pending: 'ใบสมัครเข้าคิวแล้ว ทีมงานจะติดต่อกลับทางโทรศัพท์',
  reviewing: 'ทีมงานกำลังตรวจหลักฐานและโทรยืนยัน',
  need_info: 'ทีมงานต้องการข้อมูลเพิ่ม ตอบด้านล่างแล้วใบสมัครจะกลับเข้าคิวตรวจ',
  approved: 'องค์กรผ่านการตรวจสอบแล้ว ทีมงานจะส่งช่องทางเข้าใช้งานตามระดับสิทธิ์',
  rejected: 'ใบสมัครนี้ไม่ผ่าน สามารถยื่นใบสมัครใหม่พร้อมหลักฐานเพิ่มเติมได้',
  suspended: 'สิทธิ์ถูกระงับชั่วคราว ติดต่อทีมงานเพื่อชี้แจงหรืออุทธรณ์'
};
let tracked = null;
async function track(id, token) {
  $('#track-error').hidden = true; $('#t-go').disabled = true;
  try {
    const r = await Api.call({ action: 'status', id, token });
    if (!r.ok) { $('#track-error').textContent = r.message || 'ไม่พบใบสมัคร'; $('#track-error').hidden = false; $('#track-result').hidden = true; return }
    tracked = { id, token }; renderTrack(r.application);
  } catch (e) { $('#track-error').textContent = 'เชื่อมต่อไม่ได้ ลองอีกครั้ง'; $('#track-error').hidden = false }
  finally { $('#t-go').disabled = false }
}
function renderTrack(a) {
  const box = $('#track-result'); box.hidden = false;
  box.innerHTML = `<div class="detail">
    <section><div class="actions"><h3 class="grow">${esc(a.org_name)}</h3>${pill(a.status)}${lvTag(a.level)}</div>
      <p class="muted small mono">${esc(a.id)} · ${esc(HM.TYPES[a.org_type].name)} · ส่งเมื่อ ${fmtTime(a.created_at)}</p>
      <p>${esc(STATUS_HELP[a.status])}</p></section>
    ${a.status === 'need_info' ? `<section><div class="notice warn"><b>ทีมงานขอข้อมูลเพิ่ม</b><span>${esc(a.info_request)}</span></div>
      <form id="resubmit" class="detail">
        <label class="field">คำตอบของคุณ<textarea id="r-message" maxlength="1000"></textarea></label>
        <label class="field">ลิงก์หลักฐานเพิ่มเติม<small>บรรทัดละ 1 ลิงก์</small><textarea id="r-links" placeholder="https://"></textarea></label>
        <label class="field">แนบไฟล์เพิ่ม<input type="file" id="r-files" accept="application/pdf,image/jpeg,image/png,image/webp" multiple></label>
        <p class="error" id="r-error" role="alert" hidden></p>
        <div class="actions"><button class="btn primary" id="r-go">ส่งข้อมูลเพิ่ม</button></div></form></section>` : ''}
    <section><h3>ประวัติ</h3><ol class="timeline">${a.timeline.map(t => `<li><div><div>${pill(t.status)} ${t.status === 'approved' ? lvTag(t.level) : ''}</div>
      <div class="when">${fmtTime(t.ts)}</div>${t.note ? `<p class="small">${esc(t.note)}</p>` : ''}</div></li>`).join('')}</ol></section></div>`;
  const rf = $('#resubmit'); if (!rf) return;
  rf.addEventListener('submit', async e => {
    e.preventDefault();
    const err = m => { $('#r-error').textContent = m; $('#r-error').hidden = !m };
    const list = [...$('#r-files').files];
    const bad = list.find(f => !HM.FILE_TYPES.includes(f.type) || f.size > HM.LIMITS.fileBytes);
    if (bad) return err(bad.name + ': ต้องเป็น PDF/JPG/PNG/WEBP ไม่เกิน 5 MB');
    if (list.length > HM.LIMITS.files) return err('แนบได้ไม่เกิน ' + HM.LIMITS.files + ' ไฟล์ต่อครั้ง');
    const lk = $('#r-links').value.split(/\s+/).filter(Boolean);
    if (lk.some(u => !/^https?:\/\//i.test(u))) return err('ลิงก์ต้องขึ้นต้นด้วย https://');
    $('#r-go').disabled = true;
    try {
      const r = await Api.call({ action: 'resubmit', ...tracked, message: $('#r-message').value, links: lk,
        files: await Promise.all(list.map(async f => ({ name: f.name, type: f.type, kind: 'ข้อมูลเพิ่มเติม', data: await readFile(f) }))) });
      if (!r.ok) return err(r.message || 'ส่งไม่สำเร็จ');
      toast('ส่งข้อมูลเพิ่มแล้ว ใบสมัครกลับเข้าคิวตรวจ'); renderTrack(r.application);
    } catch (e2) { err('เชื่อมต่อไม่ได้ ลองอีกครั้ง') } finally { const b = $('#r-go'); if (b) b.disabled = false }
  });
}
$('#track-form').addEventListener('submit', e => { e.preventDefault(); const id = $('#t-id').value.trim().toUpperCase(), tk = $('#t-token').value.trim().toUpperCase(); if (id && tk) track(id, tk) });
