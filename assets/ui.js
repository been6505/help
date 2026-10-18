/* ตัวช่วยหน้าเว็บที่ใช้ร่วมกัน */
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = t => { t = Number(t); if (!t) return '–'; const d = new Date(t); return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) };
const lvTag = l => `<span class="lv" data-l="${esc(l)}"><i>${esc(l)}</i>${esc((HM.LEVELS[l] || {}).name || '')}</span>`;
const pill = s => `<span class="pill ${esc(s)}">${esc(HM.STATUSES[s] || s)}</span>`;
function toast(msg, bad) {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.append(box) }
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; box.append(t); setTimeout(() => t.remove(), 4500);
}
const store = {
  get(k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k) || '' } catch (e) { return '' } },
  set(k, v, remember) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); if (v) (remember ? localStorage : sessionStorage).setItem(k, v) } catch (e) { } }
};
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว') }
  catch (e) { const r = document.createRange(); const el = btn && btn.previousElementSibling; if (el) { r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r) } toast('กด Ctrl+C / คัดลอก เพื่อเก็บรหัส') }
}
/* อ่านไฟล์เป็น base64 สำหรับส่งไปเก็บใน Drive */
function readFile(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(file) });
}
function demoBar() {
  if (!DEMO) return;
  const bar = document.createElement('div'); bar.className = 'demo-bar';
  bar.innerHTML = '<div class="wrap"><span><b>โหมดทดลอง</b> · ยังไม่ได้เชื่อมฐานข้อมูล ข้อมูลทั้งหมดเป็นตัวอย่างและเก็บอยู่ในเบราว์เซอร์นี้เท่านั้น</span><button type="button" id="demo-reset">ล้างข้อมูลทดลอง</button></div>';
  $('.top').after(bar);
  $('#demo-reset').addEventListener('click', () => { Api.resetDemo(); toast('คืนค่าข้อมูลตัวอย่างแล้ว'); setTimeout(() => location.reload(), 600) });
}
