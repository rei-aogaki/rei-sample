'use strict';

/* ================================================================
   REI SAMPLE — Admin CMS JavaScript
   Cloudflare Workers API version
   ================================================================ */

const API_BASE = '/api';
const SESSION_KEY = 'rei_sample_token';
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ================================================================
   AUTH — Token-based (JWT from Workers)
   ================================================================ */

function getToken() { return sessionStorage.getItem(SESSION_KEY); }
function setToken(token) { sessionStorage.setItem(SESSION_KEY, token); }
function clearToken() { sessionStorage.removeItem(SESSION_KEY); }

function authHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function verifySession() {
  const token = getToken();
  if (!token) return false;
  // Verify token via dedicated endpoint (auth required)
  try {
    const res = await fetch(`${API_BASE}/auth/verify`, { headers: authHeaders() });
    return res.ok;
  } catch { return false; }
}

function showAdminPanel() {
  const login = $('#loginScreen');
  const panel = $('#adminPanel');
  if (login) login.style.display = 'none';
  if (panel) panel.style.display = 'flex';
  loadManageGrid();
}

function showLoginScreen() {
  const login = $('#loginScreen');
  const panel = $('#adminPanel');
  if (login) login.style.display = 'flex';
  if (panel) panel.style.display = 'none';
}

async function initAuth() {
  if (getToken()) {
    const valid = await verifySession();
    if (valid) { showAdminPanel(); return; }
    clearToken();
  }

  const form = $('#loginForm');
  const errorEl = $('#loginError');
  const passwordInput = $('#passwordInput');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = passwordInput?.value || '';
    const btn = $('#loginBtn');

    try {
      if (btn) { btn.disabled = true; btn.textContent = '...'; }

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Login failed');
      }

      const data = await res.json();
      setToken(data.token);
      showAdminPanel();

    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'INCORRECT PASSWORD';
        errorEl.style.animation = 'none';
        requestAnimationFrame(() => { errorEl.style.animation = 'shake 0.4s ease'; });
      }
      if (passwordInput) { passwordInput.value = ''; passwordInput.focus(); }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'ENTER'; }
    }
  });
}

function initLogout() {
  const btn = $('#logoutBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      clearToken();
      showLoginScreen();
    });
  }
}

/* ================================================================
   TOAST
   ================================================================ */

function showToast(message, type = 'info', duration = 3500) {
  const container = $('#toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, duration);
}

/* ================================================================
   NAVIGATION
   ================================================================ */

function initNavigation() {
  const links = $$('.sidebar-link[data-section]');
  const sections = { upload: $('#sectionUpload'), manage: $('#sectionManage') };

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.dataset.section;
      links.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      Object.values(sections).forEach((s) => s && s.classList.remove('active'));
      if (sections[id]) sections[id].classList.add('active');
      if (id === 'manage') loadManageGrid();
      closeMobileSidebar();
    });
  });

  const goBtn = $('#goUploadBtn');
  if (goBtn) {
    goBtn.addEventListener('click', () => {
      const ul = document.querySelector('.sidebar-link[data-section="upload"]');
      if (ul) ul.click();
    });
  }
}

/* ================================================================
   MOBILE SIDEBAR
   ================================================================ */

function initMobileSidebar() {
  const btn = $('#mobileMenuBtn');
  const sidebar = $('#adminSidebar');
  if (!btn || !sidebar) return;

  btn.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    btn.classList.toggle('open', open);
    if (open) {
      const ov = document.createElement('div');
      ov.id = 'sidebarOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:49;background:rgba(0,0,0,0.5);';
      ov.addEventListener('click', closeMobileSidebar);
      document.body.appendChild(ov);
    } else {
      removeSidebarOverlay();
    }
  });
}

function closeMobileSidebar() {
  const sidebar = $('#adminSidebar');
  const btn = $('#mobileMenuBtn');
  if (sidebar) sidebar.classList.remove('open');
  if (btn) btn.classList.remove('open');
  removeSidebarOverlay();
}

function removeSidebarOverlay() {
  const ov = $('#sidebarOverlay');
  if (ov) ov.remove();
}

/* ================================================================
   UPLOAD
   ================================================================ */

let uploadQueue = [];

function initUpload() {
  const area = $('#uploadArea');
  const fileInput = $('#fileInput');
  const submitBtn = $('#uploadSubmitBtn');
  const clearBtn = $('#queueClearBtn');
  if (!area) return;

  area.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    addFilesToQueue([...e.target.files]);
    e.target.value = '';
  });

  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', (e) => {
    if (!area.contains(e.relatedTarget)) area.classList.remove('drag-over');
  });
  area.addEventListener('drop', (e) => {
    e.preventDefault(); area.classList.remove('drag-over');
    addFilesToQueue([...e.dataTransfer.files].filter((f) => ALLOWED_TYPES.includes(f.type)));
  });

  submitBtn?.addEventListener('click', () => uploadAll());
  clearBtn?.addEventListener('click', () => {
    uploadQueue = uploadQueue.filter((q) => q.status === 'done');
    renderQueue();
  });
}

function addFilesToQueue(files) {
  const valid = files.filter((f) => {
    if (!ALLOWED_TYPES.includes(f.type)) { showToast(`Unsupported: ${f.name}`, 'error'); return false; }
    if (f.size > MAX_FILE_SIZE_BYTES) { showToast(`Too large: ${f.name}`, 'error'); return false; }
    return true;
  });
  if (!valid.length) return;

  valid.forEach((file) => {
    const id = Math.random().toString(36).slice(2);
    const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
    uploadQueue.push({ file, id, status: 'pending', progress: 0, previewUrl: null, title: defaultTitle });
  });
  renderQueue();
}

function renderQueue() {
  const section = $('#uploadQueue');
  const list = $('#queueList');
  if (!list) return;

  const pending = uploadQueue.filter((q) => q.status !== 'done');
  if (!pending.length && !uploadQueue.length) { if (section) section.style.display = 'none'; return; }
  if (section) section.style.display = 'block';

  list.innerHTML = '';
  uploadQueue.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'queue-item'; el.id = `queue-${item.id}`;

    const isEditable = item.status === 'pending';
    el.innerHTML = `
      ${item.previewUrl ? `<img class="queue-thumb" src="${escapeHtml(item.previewUrl)}" />` : '<div class="queue-thumb" style="background:#1c1c38;"></div>'}
      <div class="queue-info">
        ${isEditable
          ? `<input class="queue-title-input" id="title-${item.id}" type="text" value="${escapeHtml(item.title || item.file.name.replace(/\.[^/.]+$/, ''))}" placeholder="写真タイトル" maxlength="100" />`
          : `<div class="queue-filename">${escapeHtml(item.title || item.file.name)}</div>`
        }
        <div class="queue-progress-bar"><div class="queue-progress-fill" id="prog-${item.id}" style="width:${item.progress}%"></div></div>
        <div class="queue-filesize">${(item.file.size / 1024 / 1024).toFixed(1)} MB</div>
      </div>
      <span class="queue-status ${item.status}" id="st-${item.id}">${statusLabel(item.status)}</span>`;

    list.appendChild(el);

    if (!item.previewUrl && item.status === 'pending') {
      const reader = new FileReader();
      reader.onload = (e) => {
        item.previewUrl = e.target.result;
        const thumb = el.querySelector('.queue-thumb');
        if (thumb && thumb.tagName !== 'IMG') {
          const img = document.createElement('img');
          img.className = 'queue-thumb'; img.src = e.target.result;
          thumb.replaceWith(img);
        }
      };
      reader.readAsDataURL(item.file);
    }
  });
}

function statusLabel(s) {
  return { pending: 'PENDING', uploading: 'UPLOADING', done: '✓ DONE', error: '✗ ERROR' }[s] || s;
}

async function uploadAll() {
  const pending = uploadQueue.filter((q) => q.status === 'pending');
  if (!pending.length) { showToast('No files to upload.', 'info'); return; }

  const btn = $('#uploadSubmitBtn');
  if (btn) btn.disabled = true;

  let ok = 0, fail = 0;
  for (const item of pending) {
    try { await uploadFile(item); ok++; } catch { fail++; }
  }

  if (btn) btn.disabled = false;
  if (ok) {
    showToast(`${ok} photo(s) uploaded!`, 'success');
    setTimeout(() => {
      uploadQueue = uploadQueue.filter((q) => q.status !== 'done');
      renderQueue();
    }, 2000);
  }
  if (fail) showToast(`${fail} failed.`, 'error');
}

async function uploadFile(item) {
  item.status = 'uploading';
  updateStatus(item);

  try {
    // Get dimensions
    const dims = await getImageDimensions(item.file);

    const formData = new FormData();
    formData.append('file', item.file);
    // Read title from input if available, else use stored title or filename
    const titleInput = document.getElementById(`title-${item.id}`);
    const titleValue = titleInput ? titleInput.value.trim() : '';
    const finalTitle = titleValue || item.title || item.file.name.replace(/\.[^/.]+$/, '');
    formData.append('title', finalTitle);
    formData.append('width', String(dims.width));
    formData.append('height', String(dims.height));

    // Use XMLHttpRequest for progress
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/photos`);

      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          item.progress = Math.round((e.loaded / e.total) * 100);
          const fill = document.getElementById(`prog-${item.id}`);
          if (fill) fill.style.width = `${item.progress}%`;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          item.status = 'done'; item.progress = 100;
          updateStatus(item); resolve();
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            reject(new Error(errJson.error || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });

  } catch (err) {
    item.status = 'error'; item.progress = 0;
    updateStatus(item);
    throw err;
  }
}

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(file);
  });
}

function updateStatus(item) {
  const el = document.getElementById(`st-${item.id}`);
  if (el) { el.className = `queue-status ${item.status}`; el.textContent = statusLabel(item.status); }
}

/* ================================================================
   MANAGE GRID
   ================================================================ */

let photoToDelete = null;

async function loadManageGrid() {
  const grid = $('#manageGrid');
  const loading = $('#manageLoading');
  const empty = $('#manageEmpty');
  const stat = $('#statTotal');
  if (!grid) return;

  if (loading) loading.style.display = 'flex';
  if (empty) empty.style.display = 'none';
  grid.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/photos`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const json = await res.json();
    const photos = json.data || [];

    if (loading) loading.style.display = 'none';
    if (stat) stat.textContent = String(photos.length);

    if (!photos.length) { if (empty) empty.style.display = 'flex'; return; }

    grid.style.display = 'grid';
    grid.innerHTML = '';

    photos.forEach((photo) => {
      const card = document.createElement('div');
      card.className = 'manage-card';
      card.innerHTML = `
        <img class="manage-card-img" src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.title)}" loading="lazy" />
        <div class="manage-card-overlay">
          <button class="delete-btn" data-id="${escapeHtml(photo.id)}">DELETE</button>
        </div>
        <div class="manage-card-meta"><p class="manage-card-name">${escapeHtml(photo.title || photo.id)}</p></div>`;

      card.querySelector('.delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        photoToDelete = photo.id;
        showDeleteModal();
      });

      grid.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    if (loading) loading.style.display = 'none';
    const msg = err?.message || 'Failed to load photos.';
    if (msg.includes('binding') || msg.includes('503')) {
      showToast('⚠️ D1/R2 binding not configured. See Cloudflare Dashboard > Bindings.', 'error', 6000);
    } else if (msg.includes('no such table')) {
      showToast('⚠️ DB table missing. Run: wrangler d1 execute rei-sample-db --file=./schema.sql', 'error', 8000);
    } else {
      showToast(`Failed to load photos: ${msg}`, 'error');
    }
  }
}

/* ================================================================
   DELETE MODAL
   ================================================================ */

function showDeleteModal() { const m = $('#deleteModal'); if (m) m.style.display = 'flex'; }
function hideDeleteModal() { const m = $('#deleteModal'); if (m) m.style.display = 'none'; photoToDelete = null; }

function initDeleteModal() {
  $('#modalCancelBtn')?.addEventListener('click', hideDeleteModal);
  $('#deleteModal')?.addEventListener('click', (e) => { if (e.target.id === 'deleteModal') hideDeleteModal(); });

  $('#modalConfirmBtn')?.addEventListener('click', async () => {
    if (!photoToDelete) return;
    const id = photoToDelete;
    hideDeleteModal();

    try {
      const res = await fetch(`${API_BASE}/photos/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      showToast('Photo deleted.', 'success');
      await loadManageGrid();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete.', 'error');
    }
  });
}

/* ================================================================
   LOGIN PARTICLES
   ================================================================ */

function initLoginParticles() {
  const container = $('#loginParticles');
  if (!container) return;

  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('span');
    const size = Math.random() * 3 + 1;
    dot.style.cssText = `
      position:absolute; left:${Math.random()*100}%; top:${Math.random()*100}%;
      width:${size}px; height:${size}px;
      background:${Math.random()>0.5?'#00d4ff':'#fff'};
      border-radius:50%; opacity:0;
      animation:loginFloat ${Math.random()*8+4}s ease-in-out ${Math.random()*4}s infinite;`;
    container.appendChild(dot);
  }

  if (!document.getElementById('loginPStyle')) {
    const s = document.createElement('style');
    s.id = 'loginPStyle';
    s.textContent = `
      @keyframes loginFloat { 0%{opacity:0;transform:translateY(0)} 20%{opacity:0.5} 80%{opacity:0.3} 100%{opacity:0;transform:translateY(-60px)} }
      @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }`;
    document.head.appendChild(s);
  }
}

/* ================================================================
   KEYBOARD
   ================================================================ */

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const m = $('#deleteModal');
      if (m && m.style.display !== 'none') hideDeleteModal();
    }
  });
}

/* ================================================================
   INIT
   ================================================================ */

function init() {
  initLoginParticles();
  initAuth();
  initLogout();
  initNavigation();
  initMobileSidebar();
  initUpload();
  initDeleteModal();
  initKeyboard();
}

document.addEventListener('DOMContentLoaded', init);
