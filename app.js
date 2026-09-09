/* ============================================================
   Sales OS — Employee Manager v5
   Fields: id, firstName, lastName, age, email, phone
   ============================================================ */

const STORAGE_KEY = 'sales_os_employees_v3';
const SEED_VERSION = 'v3-2025';

const SEED = [
  { id: 'E001', firstName: 'สมชาย',  lastName: 'ใจดี',    age: 32, email: 'somchai@sales.co',  phone: '081-111-1111' },
  { id: 'E002', firstName: 'สมหญิง', lastName: 'รักดี',   age: 26, email: 'somying@sales.co',  phone: '082-222-2222' },
  { id: 'E003', firstName: 'มานี',   lastName: 'มีใจ',    age: 40, email: 'manee@sales.co',    phone: '083-333-3333' },
  { id: 'E004', firstName: 'มานพ',   lastName: 'ขยัน',    age: 28, email: 'manop@sales.co',    phone: '084-444-4444' },
  { id: 'E005', firstName: 'ปิยะ',   lastName: 'เก่งกล้า', age: 35, email: 'piya@sales.co',     phone: '085-555-5555' }
];

/* ---------- API ---------- */
const api = {
  _read() {
    const v = localStorage.getItem(STORAGE_KEY + '_ver');
    const raw = localStorage.getItem(STORAGE_KEY);
    // Force reseed: if version mismatch OR if data is empty (previous bug)
    if (v !== SEED_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      localStorage.setItem(STORAGE_KEY + '_ver', SEED_VERSION);
      return [...SEED];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
        return [...SEED];
      }
      return parsed;
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return [...SEED];
    }
  },
  _write(r) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); },
  list()         { return Promise.resolve(this._read()); },
  insertMany(emps) {
    const r = this._read();
    const exist = new Set(r.map(x => x.id));
    const dups = emps.filter(e => exist.has(e.id));
    if (dups.length) return Promise.reject(new Error(`รหัสซ้ำ: ${dups.map(d => d.id).join(', ')}`));
    emps.forEach(e => r.push(e));
    this._write(r);
    return Promise.resolve(emps);
  },
  insert(emp)    { return this.insertMany([emp]); },
  update(emp)    {
    const r = this._read();
    const i = r.findIndex(x => x.id === emp.id);
    if (i === -1) return Promise.reject(new Error('ไม่พบรหัสนี้'));
    r[i] = { ...r[i], ...emp };
    this._write(r);
    return Promise.resolve(r[i]);
  },
  remove(id)     {
    const r = this._read();
    const i = r.findIndex(x => x.id === id);
    if (i === -1) return Promise.reject(new Error('ไม่พบรหัสนี้'));
    const [del] = r.splice(i, 1); this._write(r); return Promise.resolve(del);
  }
};

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
const colorFor = (name = '') => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const initials = (first = '', last = '') =>
  ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '?';
const fullName = (e) => `${e.firstName || ''} ${e.lastName || ''}`.trim();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- App State ---------- */
const state = {
  cache: [],
  search: '',
  view: 'home',
  staged: [],
  editMode: false,
  editingId: null
};

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, type = 'success') {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('error', type === 'error');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ============================================================
   ROUTING
   ============================================================ */
function setView(view) {
  state.view = view;
  $('viewHome').hidden = view !== 'home';
  $('viewInsert').hidden = view !== 'insert';
  const topbar = document.querySelector('.topbar');
  topbar.classList.toggle('show-back', view === 'insert');
  $('searchWrap').style.display = view === 'home' ? '' : 'none';
  if (view === 'insert') {
    resetInsertForm();
    renderStaged();
  } else {
    refresh();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ============================================================
   HOME VIEW
   ============================================================ */
function applySearch(rows) {
  if (!state.search) return rows;
  const q = state.search.toLowerCase();
  return rows.filter(x =>
    x.id.toLowerCase().includes(q) ||
    (x.firstName || '').toLowerCase().includes(q) ||
    (x.lastName || '').toLowerCase().includes(q) ||
    (x.email || '').toLowerCase().includes(q) ||
    (x.phone || '').toLowerCase().includes(q));
}

function renderTable(rows) {
  return rows.map(r => `
    <tr data-detail="${esc(r.id)}">
      <td><span class="emp-id">${esc(r.id)}</span></td>
      <td>
        <div class="emp-avatar">
          <div class="avatar-circle" style="background:${colorFor(r.firstName)}">${initials(r.firstName, r.lastName)}</div>
          <span class="emp-name">${esc(r.firstName)}</span>
        </div>
      </td>
      <td>${esc(r.lastName)}</td>
      <td>${r.age ?? '—'}</td>
      <td style="color:var(--ink-2)">${esc(r.email)}</td>
      <td style="color:var(--ink-2)">${esc(r.phone)}</td>
      <td class="text-center">
        <div class="row-actions">
          <button class="icon-btn" data-edit="${esc(r.id)}" title="แก้ไข">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="icon-btn" data-del="${esc(r.id)}" title="ลบ" style="color:var(--danger);border-color:#fecaca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCards(rows) {
  return rows.map(r => `
    <div class="emp-card">
      <div class="emp-card-id">${esc(r.id)}</div>
      <div class="emp-card-name">
        <span class="first">${esc(r.firstName)}</span>
        <span class="last">${esc(r.lastName)}</span>
      </div>
      <div class="emp-card-actions">
        <button class="icon-btn" data-edit="${esc(r.id)}" title="แก้ไข">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="icon-btn" data-del="${esc(r.id)}" title="ลบ" style="color:var(--danger);border-color:#fecaca">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function renderHome() {
  const rows = applySearch(state.cache);
  const tbody = $('empBody');
  const cards = $('empCards');
  const empty = $('emptyState');

  if (!rows.length) {
    tbody.innerHTML = '';
    cards.innerHTML = '';
    empty.hidden = false;
  } else {
    empty.hidden = true;
    tbody.innerHTML = renderTable(rows);
    cards.innerHTML = renderCards(rows);
  }
}

async function refresh() {
  state.cache = await api.list();
  renderHome();
}

/* ============================================================
   INSERT VIEW
   ============================================================ */
function resetInsertForm() {
  $('empForm').reset();
  document.querySelectorAll('.field-error').forEach(e => { e.textContent = ''; e.classList.remove('show'); });
  document.querySelectorAll('.field input').forEach(i => i.classList.remove('invalid'));
  $('emp_id').focus();
}

function readInsertForm() {
  return {
    id:        $('emp_id').value.trim(),
    firstName: $('emp_firstName').value.trim(),
    lastName:  $('emp_lastName').value.trim(),
    age:       Number($('emp_age').value) || 0,
    email:     $('emp_email').value.trim(),
    phone:     $('emp_phone').value.trim()
  };
}

function setFieldError(name, msg) {
  const el = $(`err_${name}`);
  const input = $(`emp_${name}`);
  if (msg) {
    el.textContent = msg;
    el.classList.add('show');
    input.classList.add('invalid');
  } else {
    el.textContent = '';
    el.classList.remove('show');
    input.classList.remove('invalid');
  }
}

function validateAll(data) {
  let ok = true;
  if (!data.id) { setFieldError('id', 'กรอกรหัส'); ok = false; }
  else {
    const inDb = state.cache.some(x => x.id === data.id);
    const inStaged = state.staged.some(x => x.id === data.id);
    if (inDb) { setFieldError('id', 'รหัสนี้มีอยู่ในฐานข้อมูลแล้ว'); ok = false; }
    else if (inStaged) { setFieldError('id', 'รหัสนี้ถูกเพิ่มในรายการแล้ว'); ok = false; }
    else setFieldError('id', '');
  }
  if (!data.firstName) { setFieldError('firstName', 'กรอกชื่อ'); ok = false; } else setFieldError('firstName', '');
  if (!data.lastName)  { setFieldError('lastName', 'กรอกนามสกุล'); ok = false; } else setFieldError('lastName', '');
  if (data.age && (data.age < 0 || data.age > 120)) { setFieldError('age', 'อายุ 0-120'); ok = false; } else setFieldError('age', '');
  if (data.phone && /[^\d\-\+\s]/.test(data.phone)) { setFieldError('phone', 'กรอกเฉพาะตัวเลข'); ok = false; } else setFieldError('phone', '');
  return ok;
}

function renderStaged() {
  const card = $('stagedCard');
  if (!state.staged.length) {
    card.hidden = true;
    $('btnSubmit').disabled = true;
    return;
  }
  card.hidden = false;
  $('btnSubmit').disabled = false;
  $('stagedCount').textContent = state.staged.length;
  $('stagedList').innerHTML = state.staged.map((s, i) => `
    <div class="staged-item">
      <div class="staged-num">${i + 1}</div>
      <div class="staged-info">
        <div class="id">${esc(s.id)}</div>
        <div class="name">${esc(s.firstName)} ${esc(s.lastName)}</div>
      </div>
      <div class="staged-actions">
        <button class="icon-btn" data-staged-edit="${i}" title="แก้ไข">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="icon-btn" data-staged-del="${i}" title="ลบ" style="color:var(--danger);border-color:#fecaca">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function loadStagedIntoForm(i) {
  const s = state.staged[i];
  $('emp_id').value = s.id;
  $('emp_firstName').value = s.firstName;
  $('emp_lastName').value = s.lastName;
  $('emp_age').value = s.age || '';
  $('emp_email').value = s.email;
  $('emp_phone').value = s.phone;
  state.staged.splice(i, 1);
  renderStaged();
  $('emp_id').focus();
}

function onAdd() {
  const data = readInsertForm();
  if (!validateAll(data)) return;
  state.staged.push(data);
  resetInsertForm();
  renderStaged();
  toast(`เพิ่ม ${data.id} เข้ารายการแล้ว`);
}

async function onSubmit() {
  if (!state.staged.length) return;
  const list = state.staged;
  const body = `
    <div class="summary-summary">
      <span class="badge">${list.length}</span>
      <span>รายการที่จะเพิ่มเข้าฐานข้อมูล</span>
    </div>
    <div class="summary-list">
      <table class="summary-table">
        <thead><tr><th>รหัส</th><th>ชื่อ</th><th>นามสกุล</th></tr></thead>
        <tbody>
          ${list.map(s => `<tr><td class="id">${esc(s.id)}</td><td>${esc(s.firstName)}</td><td>${esc(s.lastName)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  openConfirm({
    title: 'ยืนยันการเพิ่มพนักงาน',
    body,
    actions: [
      { label: 'ยกเลิก', kind: 'cancel', onClick: closeConfirm },
      { label: 'ยืนยัน', kind: 'primary', onClick: async () => {
          try {
            await api.insertMany(list);
            state.staged = [];
            closeConfirm();
            setView('home');
            toast(`เพิ่มพนักงาน ${list.length} คนเรียบร้อย`);
          } catch (e) {
            closeConfirm();
            toast(e.message, 'error');
          }
        }
      }
    ]
  });
}

/* ============================================================
   DETAIL POPUP
   ============================================================ */
function openDetail(id, editMode = false) {
  const emp = state.cache.find(x => x.id === id);
  if (!emp) return;
  state.editMode = editMode;
  state.editingId = id;
  renderDetailView(emp);
  $('detailModal').hidden = false;
  $('detailModal').style.display = 'grid';
  document.body.style.overflow = 'hidden';
}

function renderDetailView(emp) {
  $('detailTitle').textContent = state.editMode ? 'แก้ไขพนักงาน' : 'รายละเอียดพนักงาน';
  const body = $('detailBody');
  const foot = $('detailFoot');

  if (state.editMode) {
    body.innerHTML = `
      <div class="detail-edit-grid">
        <div class="field">
          <label>รหัสพนักงาน (ล็อค)</label>
          <input type="text" value="${esc(emp.id)}" readonly />
        </div>
        <div class="field-row">
          <div class="field">
            <label>ชื่อ</label>
            <input type="text" id="edit_firstName" value="${esc(emp.firstName)}" />
          </div>
          <div class="field">
            <label>นามสกุล</label>
            <input type="text" id="edit_lastName" value="${esc(emp.lastName)}" />
          </div>
        </div>
        <div class="field">
          <label>อายุ</label>
          <input type="number" id="edit_age" value="${emp.age || ''}" min="0" max="120" inputmode="numeric" />
        </div>
        <div class="field">
          <label>อีเมล</label>
          <input type="email" id="edit_email" value="${esc(emp.email)}" />
        </div>
        <div class="field">
          <label>เบอร์โทร</label>
          <input type="tel" id="edit_phone" value="${esc(emp.phone)}" maxlength="15" inputmode="tel" pattern="[0-9\-\+\s]*" />
        </div>
      </div>
    `;
    foot.innerHTML = `
      <button class="icon-btn-lg warning" id="editCancel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        ยกเลิก
      </button>
      <button class="icon-btn-lg success" id="editSave">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        บันทึก
      </button>
    `;
    $('editCancel').onclick = () => { state.editMode = false; renderDetailView(emp); };
    $('editSave').onclick = () => confirmEditSave(emp);
    // Block non-numeric/letter for edit inputs too
    $('edit_age').addEventListener('keydown', blockNonNumeric);
    $('edit_phone').addEventListener('keydown', blockNonTel);
  } else {
    body.innerHTML = `
      <div class="detail-grid">
        <div class="detail-field">
          <div class="lbl">รหัส</div>
          <div class="val id">${esc(emp.id)}</div>
        </div>
        <div class="detail-field">
          <div class="lbl">ชื่อ</div>
          <div class="val">${esc(emp.firstName)}</div>
        </div>
        <div class="detail-field">
          <div class="lbl">นามสกุล</div>
          <div class="val">${esc(emp.lastName)}</div>
        </div>
        <div class="detail-field">
          <div class="lbl">อายุ</div>
          <div class="val">${emp.age ?? '—'}</div>
        </div>
        <div class="detail-field">
          <div class="lbl">อีเมล</div>
          <div class="val">${esc(emp.email) || '—'}</div>
        </div>
        <div class="detail-field">
          <div class="lbl">เบอร์โทร</div>
          <div class="val">${esc(emp.phone) || '—'}</div>
        </div>
      </div>
    `;
    foot.innerHTML = `
      <button class="icon-btn-lg warning" id="detailEdit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        แก้ไข
      </button>
      <button class="icon-btn-lg danger" id="detailDelete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
        ลบ
      </button>
    `;
    $('detailEdit').onclick   = () => { state.editMode = true; renderDetailView(emp); };
    $('detailDelete').onclick = () => confirmDelete(emp);
  }
}

function confirmDelete(emp) {
  openConfirm({
    title: 'ยืนยันการลบ',
    body: `<p class="confirm-text">ลบพนักงาน <strong>${esc(emp.id)}</strong> — <strong>${esc(emp.firstName)} ${esc(emp.lastName)}</strong> ?</p>`,
    actions: [
      { label: 'ยกเลิก', kind: 'cancel', onClick: closeConfirm },
      { label: 'ลบ', kind: 'primary', onClick: async () => {
          try {
            await api.remove(emp.id);
            closeConfirm();
            closeDetail();
            await refresh();
            toast(`ลบ ${emp.id} แล้ว`);
          } catch (e) { closeConfirm(); toast(e.message, 'error'); }
        }
      }
    ]
  });
}

function confirmEditSave(emp) {
  const updated = {
    id: emp.id,
    firstName: $('edit_firstName').value.trim(),
    lastName:  $('edit_lastName').value.trim(),
    age: Number($('edit_age').value) || 0,
    email: $('edit_email').value.trim(),
    phone: $('edit_phone').value.trim()
  };
  if (!updated.firstName) return toast('กรอกชื่อ', 'error');
  if (!updated.lastName)  return toast('กรอกนามสกุล', 'error');
  if (updated.age && (updated.age < 0 || updated.age > 120)) return toast('อายุไม่ถูกต้อง', 'error');
  if (updated.phone && /[^\d\-\+\s]/.test(updated.phone)) return toast('เบอร์โทรต้องเป็นตัวเลข', 'error');

  openConfirm({
    title: 'ยืนยันการแก้ไข',
    body: `
      <p class="confirm-text">บันทึกการแก้ไขพนักงาน <strong>${esc(emp.id)}</strong> ?</p>
      <table class="summary-table" style="margin-top:12px">
        <thead><tr><th>รหัส</th><th>ชื่อ</th><th>นามสกุล</th></tr></thead>
        <tbody>
          <tr><td class="id">${esc(emp.id)}</td><td>${esc(updated.firstName)}</td><td>${esc(updated.lastName)}</td></tr>
        </tbody>
      </table>
    `,
    actions: [
      { label: 'ยกเลิก', kind: 'cancel', onClick: closeConfirm },
      { label: 'บันทึก', kind: 'primary', onClick: async () => {
          try {
            await api.update(updated);
            closeConfirm();
            closeDetail();
            await refresh();
            toast(`บันทึก ${emp.id} แล้ว`);
          } catch (e) { closeConfirm(); toast(e.message, 'error'); }
        }
      }
    ]
  });
}

function closeDetail() {
  $('detailModal').hidden = true;
  $('detailModal').style.display = '';
  document.body.style.overflow = '';
  state.editMode = false;
  state.editingId = null;
}

/* ============================================================
   CONFIRM POPUP
   ============================================================ */
function openConfirm({ title, body, actions }) {
  $('confirmTitle').textContent = title;
  $('confirmBody').innerHTML = body;
  $('confirmFoot').innerHTML = actions.map((a, i) => `
    <button class="icon-btn-lg ${a.kind || ''}" data-act="${i}">${esc(a.label)}</button>
  `).join('');
  actions.forEach((a, i) => {
    const btn = $('confirmFoot').querySelector(`[data-act="${i}"]`);
    if (btn) btn.onclick = a.onClick;
  });
  $('confirmModal').hidden = false;
  $('confirmModal').style.display = 'grid';
  document.body.style.overflow = 'hidden';
}
function closeConfirm() {
  $('confirmModal').hidden = true;
  $('confirmModal').style.display = '';
  if ($('detailModal').hidden) document.body.style.overflow = '';
}

/* ============================================================
   HOME CLICK HANDLER
   ============================================================ */
function onHomeClick(e) {
  const editBtn   = e.target.closest('[data-edit]');
  const delBtn    = e.target.closest('[data-del]');
  const detailEl  = e.target.closest('[data-detail]');
  if (editBtn) { e.stopPropagation(); openDetail(editBtn.getAttribute('data-edit'), true); return; }
  if (delBtn)  { e.stopPropagation(); const emp = state.cache.find(x => x.id === delBtn.getAttribute('data-del')); if (emp) confirmDelete(emp); return; }
  if (detailEl) { openDetail(detailEl.getAttribute('data-detail')); return; }
}

function onStagedClick(e) {
  const editBtn = e.target.closest('[data-staged-edit]');
  const delBtn  = e.target.closest('[data-staged-del]');
  if (editBtn) { loadStagedIntoForm(Number(editBtn.getAttribute('data-staged-edit'))); return; }
  if (delBtn)  {
    const i = Number(delBtn.getAttribute('data-staged-del'));
    state.staged.splice(i, 1);
    renderStaged();
  }
}

/* ============================================================
   INPUT BLOCKERS
   ============================================================ */
function blockNonNumeric(e) {
  if ([8, 9, 27, 13, 46, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
      (e.keyCode === 65 && e.ctrlKey) || (e.keyCode === 67 && e.ctrlKey) || (e.keyCode === 86 && e.ctrlKey) ||
      (e.keyCode === 88 && e.ctrlKey)) return;
  if (/\D/.test(e.key) && e.key.length === 1) e.preventDefault();
}
function blockNonTel(e) {
  if ([8, 9, 27, 13, 46, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
      (e.keyCode === 65 && e.ctrlKey) || (e.keyCode === 67 && e.ctrlKey) || (e.keyCode === 86 && e.ctrlKey) ||
      (e.keyCode === 88 && e.ctrlKey)) return;
  if (/[0-9\-\+\s]/.test(e.key)) return;
  e.preventDefault();
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  $('backBtn').onclick = () => setView('home');
  $('gotoInsert').onclick = () => setView('insert');

  $('searchBox').addEventListener('input', (e) => { state.search = e.target.value; renderHome(); });
  $('empBody').addEventListener('click', onHomeClick);
  $('empCards').addEventListener('click', onHomeClick);

  $('btnAdd').onclick = onAdd;
  $('btnSubmit').onclick = onSubmit;
  $('btnResetForm').onclick = resetInsertForm;
  $('stagedList').addEventListener('click', onStagedClick);

  $('emp_id').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    if (!v) setFieldError('id', 'กรอกรหัส');
    else if (state.cache.some(x => x.id === v)) setFieldError('id', 'รหัสนี้มีอยู่ในฐานข้อมูลแล้ว');
    else if (state.staged.some(x => x.id === v)) setFieldError('id', 'รหัสนี้ถูกเพิ่มในรายการแล้ว');
    else setFieldError('id', '');
  });
  $('emp_age').addEventListener('keydown', blockNonNumeric);
  $('emp_phone').addEventListener('keydown', blockNonTel);
  $('emp_phone').addEventListener('paste', (e) => {
    const t = e.clipboardData.getData('text');
    if (/[^0-9\-\+\s]/.test(t)) e.preventDefault();
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.onclick = () => {
      if (!$('detailModal').hidden) closeDetail();
      if (!$('confirmModal').hidden) closeConfirm();
    };
  });
  $('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeDetail();
  });
  $('confirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'confirmModal') closeConfirm();
  });

  setView('home');
});
