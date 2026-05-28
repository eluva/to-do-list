/************************************************************
 *  TO‑DO APP – FRONTEND (vanilla JS)
 *  Структура:
 * 
 *    1. Конфигурация и утилиты
 *    2. Кастомные модальные окна
 *    3. I18n (мультиязычность)
 *    4. Тема (light/dark)
 *    5. Индикатор загрузки и API-обёртка
 *    6. Аутентификация + Google Firebase
 *    7. Папки (CRUD, drag‑and‑drop, цвета)
 *    8. Задачи (CRUD, drag‑and‑drop, оптимистичные обновления)
 *    9. Drag‑and‑drop инициализация
 *   10. Инициализация приложения
 ************************************************************/

// ========== 1. КОНФИГУРАЦИЯ И УТИЛИТЫ ==========

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCcNoiWjS9QKwq8-fqbeVLkp0LhiF1c4bU",
  authDomain: "to-do-listreg.firebaseapp.com",
  projectId: "to-do-listreg",
  storageBucket: "to-do-listreg.firebasestorage.app",
  messagingSenderId: "13755534184",
  appId: "1:13755534184:web:44c34e1a951d386f55a4dd",
  measurementId: "G-BLQ4MLYE1X"
};
firebase.initializeApp(firebaseConfig);
const firebaseAuth = firebase.auth();

const API_BASE = 'https://to-do-list-urp2.onrender.com/api';  

// Глобальное состояние
let token = localStorage.getItem('token');
let currentLang = localStorage.getItem('lang') || 'en';
let currentFolderId = null;

// Цвета для папок (null = тема по умолчанию)
const FOLDER_COLORS = [
  null,
  '#FF4D4D', '#FF8C42', '#FFD166', '#A0E426', '#06D6A0',
  '#0CB0A9', '#118AB2', '#4B9CD3', '#6C63FF', '#D16BA5',
  '#10573d', '#70C1B3', '#FF6B6B'
];

// Генератор временных id (для оптимистичных обновлений)
function tempId() {
  return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Определение светлый/тёмный цвет
function isLightColor(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

// Экранирование HTML
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[m]);
}

// ========== 2. КАСТОМНЫЕ МОДАЛЬНЫЕ ОКНА ==========
const modalOverlay    = document.getElementById('modalOverlay');
const modalMessage    = document.getElementById('modalMessage');
const modalInput      = document.getElementById('modalInput');
const modalButtons    = document.getElementById('modalButtons');
const modalColorPicker= document.getElementById('modalColorPicker');
const colorOptionsDiv = document.getElementById('colorOptions');

function showAlert(message) {
  return new Promise(resolve => {
    modalMessage.textContent = message;
    modalInput.classList.add('hidden');
    modalButtons.innerHTML = '<button class="modal-ok-btn">OK</button>';
    modalOverlay.classList.remove('hidden');
    modalButtons.querySelector('.modal-ok-btn').addEventListener('click', () => {
      modalOverlay.classList.add('hidden');
      resolve();
    });
  });
}

function showConfirm(message) {
  return new Promise(resolve => {
    modalMessage.textContent = message;
    modalInput.classList.add('hidden');
    modalButtons.innerHTML = `
      <button class="modal-cancel-btn">Cancel</button>
      <button class="modal-ok-btn">OK</button>
    `;
    modalOverlay.classList.remove('hidden');
    modalButtons.querySelector('.modal-cancel-btn').addEventListener('click', () => {
      modalOverlay.classList.add('hidden');
      resolve(false);
    });
    modalButtons.querySelector('.modal-ok-btn').addEventListener('click', () => {
      modalOverlay.classList.add('hidden');
      resolve(true);
    });
  });
}

function showPrompt(message, defaultValue = '') {
  return new Promise(resolve => {
    modalMessage.textContent = message;
    modalInput.classList.remove('hidden');
    modalInput.value = defaultValue;
    modalInput.focus();
    modalButtons.innerHTML = `
      <button class="modal-cancel-btn">Cancel</button>
      <button class="modal-ok-btn">OK</button>
    `;
    modalOverlay.classList.remove('hidden');
    modalButtons.querySelector('.modal-cancel-btn').addEventListener('click', () => {
      modalOverlay.classList.add('hidden');
      resolve(null);
    });
    modalButtons.querySelector('.modal-ok-btn').addEventListener('click', () => {
      modalOverlay.classList.add('hidden');
      resolve(modalInput.value.trim());
    });
    modalInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        modalOverlay.classList.add('hidden');
        resolve(modalInput.value.trim());
      }
    });
  });
}

// Редактирование папки (имя + цвет)
function showFolderEditModal(currentName, currentColor = null) {
  return new Promise(resolve => {
    modalMessage.textContent = 'Edit folder';
    modalInput.classList.remove('hidden');
    modalInput.value = currentName;
    modalInput.focus();

    modalColorPicker.classList.remove('hidden');
    colorOptionsDiv.innerHTML = '';
    let selectedColor = currentColor;

    FOLDER_COLORS.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      if (color === null) {
        swatch.classList.add('color-default');
        swatch.title = 'Default (theme border)';
      } else {
        swatch.style.backgroundColor = color;
      }
      if (color === selectedColor || (color === null && selectedColor === null)) {
        swatch.classList.add('selected');
      }
      swatch.addEventListener('click', () => {
        colorOptionsDiv.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        selectedColor = color;
      });
      colorOptionsDiv.appendChild(swatch);
    });

    modalButtons.innerHTML = `
      <button class="modal-cancel-btn">Cancel</button>
      <button class="modal-ok-btn">OK</button>
    `;
    modalOverlay.classList.remove('hidden');

    const close = (result) => {
      modalOverlay.classList.add('hidden');
      modalInput.classList.add('hidden');
      modalColorPicker.classList.add('hidden');
      resolve(result);
    };

    modalButtons.querySelector('.modal-cancel-btn').addEventListener('click', () => close(null));
    modalButtons.querySelector('.modal-ok-btn').addEventListener('click', () =>
      close({ name: modalInput.value.trim(), borderColor: selectedColor })
    );
    modalInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') close({ name: modalInput.value.trim(), borderColor: selectedColor });
    });
  });
}

// ========== 3. I18N (МУЛЬТИЯЗЫЧНОСТЬ) ==========
const langToggle = document.getElementById('langToggle');
const langMenu = document.getElementById('langMenu');
const currentLangText = document.getElementById('currentLangText');
const langOptions = document.querySelectorAll('.lang-option');

function setCurrentLangText(lang) {
  const map = { en: 'EN', ru: 'RU', kaa: 'KA' };
  currentLangText.textContent = map[lang] || lang.toUpperCase();
}
setCurrentLangText(currentLang);

langToggle.addEventListener('click', e => {
  e.stopPropagation();
  langMenu.classList.toggle('hidden');
  langToggle.classList.toggle('open');
});

langOptions.forEach(opt => {
  opt.addEventListener('click', e => {
    const lang = e.target.getAttribute('data-lang');
    applyLanguage(lang);
    langMenu.classList.add('hidden');
    langToggle.classList.remove('open');
    setCurrentLangText(lang);
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('.lang-dropdown')) {
    langMenu.classList.add('hidden');
    langToggle.classList.remove('open');
  }
});

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang]?.[key]) el.textContent = translations[lang][key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[lang]?.[key]) el.placeholder = translations[lang][key];
  });
  const noTaskMsg = document.querySelector('#taskList p[data-i18n="noTasks"]');
  if (noTaskMsg) noTaskMsg.textContent = translations[lang]?.noTasks || '';
  document.title = translations[lang]?.appTitle || 'To-Do';
}
applyLanguage(currentLang);

// ========== 4. ТЕМЫ ==========
const themeToggle = document.getElementById('themeToggle');
function setTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggle.textContent = isDark ? '☀️' : '🌙';
}
setTheme(localStorage.getItem('theme') === 'dark');
themeToggle.addEventListener('click', () => setTheme(!document.body.classList.contains('dark')));

// ========== 5. ИНДИКАТОР ЗАГРУЗКИ И API ==========
let loadingTimer = null;

function showLoading() {
  if (loadingTimer) return;
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  loadingTimer = setTimeout(() => {
    overlay.style.display = 'flex';
    loadingTimer = null;
  }, 700);  
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  if (loadingTimer) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }
  overlay.style.display = 'none';
}

async function apiCall(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  showLoading();
  try {
    const res = await fetch(API_BASE + url, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Request failed');
    }
    return await res.json();
  } finally {
    hideLoading();
  }
}

// ========== 6. АУТЕНТИФИКАЦИЯ ==========
const authBlock = document.getElementById('authBlock');
const appBlock = document.getElementById('appBlock');
const logoutBtn = document.getElementById('logoutBtn');

function showApp() {
  authBlock.classList.add('hidden');
  appBlock.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  loadFolders();
}
function showAuth() {
  authBlock.classList.remove('hidden');
  appBlock.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  currentFolderId = null;
}
function logout() {
  localStorage.removeItem('token');
  token = null;
  showAuth();
}

document.getElementById('signInBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;
  if (!email || !pass) return await showAlert('Email and password required');
  try {
    const data = await apiCall('/auth/login', { method:'POST', body: JSON.stringify({ email, password: pass }) });
    token = data.token;
    localStorage.setItem('token', token);
    showApp();
  } catch(e) { await showAlert(e.message); }
});

document.getElementById('signUpBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;
  if (!email || !pass) return await showAlert('Email and password required');
  try {
    const data = await apiCall('/auth/register', { method:'POST', body: JSON.stringify({ email, password: pass }) });
    token = data.token;
    localStorage.setItem('token', token);
    showApp();
  } catch(e) { await showAlert(e.message); }
});

logoutBtn.addEventListener('click', logout);

// ========== GOOGLE SIGN-IN (Firebase) – адаптивный ==========
const googleSignInBtn = document.getElementById('googleSignInBtn');

if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // На телефонах всегда редирект (попап часто блокируется)
      await firebaseAuth.signInWithRedirect(provider);
    } else {
      // Десктоп: сначала пробуем попап, при неудаче – редирект
      try {
        const result = await firebaseAuth.signInWithPopup(provider);
        const idToken = await result.user.getIdToken();
        await handleGoogleToken(idToken);
      } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
          await firebaseAuth.signInWithRedirect(provider);
        } else {
          console.error(e);
          await showAlert('Google sign in failed: ' + e.message);
        }
      }
    }
  });
}

// Обработчик возврата после редиректа (вызывается при загрузке страницы)
async function handleGoogleRedirectResult() {
  try {
    const result = await firebaseAuth.getRedirectResult();
    if (result.user) {
      const idToken = await result.user.getIdToken();
      await handleGoogleToken(idToken);
    }
  } catch (e) {
    // Игнорируем ошибки (например, пользователь отменил вход)
    console.warn('Redirect sign-in error:', e.message);
  }
}

// Общая функция отправки токена на сервер
async function handleGoogleToken(idToken) {
  try {
    const data = await apiCall('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken })
    });
    token = data.token;
    localStorage.setItem('token', token);
    showApp();
  } catch (e) {
    await showAlert('Google sign in failed: ' + e.message);
  }
}

// Проверяем результат редиректа только если пользователь не авторизован
if (!token) {
  window.addEventListener('load', () => {
    handleGoogleRedirectResult();
  });
}

// ========== 7. ПАПКИ ==========
const folderListDiv = document.getElementById('folderList');
const addFolderBtn = document.getElementById('addFolderBtn');
const tasksBlock = document.getElementById('tasksBlock');

// Инлайн-создание папки
function showFolderInput() {
  const existingInput = document.querySelector('.folder-input-inline');
  if (existingInput) existingInput.remove();

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-input-inline';
  input.placeholder = translations[currentLang]?.folderPlaceholder || 'Folder name';
  folderListDiv.insertBefore(input, addFolderBtn);
  input.focus();

  const createFolder = async () => {
    const name = input.value.trim();
    input.remove();
    if (!name) return;

    const tempFolder = {
      _id: tempId(),
      name,
      borderColor: null,
      order: Date.now()
    };
    renderSingleFolder(tempFolder);

    try {
      await apiCall('/folders', { method:'POST', body: JSON.stringify({ name }) });
      loadFolders(); 
    } catch(e) {
      const tempEl = document.querySelector(`.folder-badge[data-id="${tempFolder._id}"]`);
      if (tempEl) tempEl.remove();
      await showAlert(e.message);
    }
  };

  input.addEventListener('keypress', e => { if (e.key === 'Enter') createFolder(); });
  input.addEventListener('blur', () => {
    setTimeout(() => { if (document.activeElement !== input) input.remove(); }, 100);
  });
}
addFolderBtn.addEventListener('click', showFolderInput);

function renderSingleFolder(folder) {
  const badge = document.createElement('span');
  badge.className = 'folder-badge';
  badge.dataset.id = folder._id;
  badge.dataset.borderColor = folder.borderColor || '';
  if (folder.borderColor) badge.style.borderColor = folder.borderColor;

  const nameSpan = document.createElement('span');
  nameSpan.textContent = folder.name;
  nameSpan.style.pointerEvents = 'none';
  badge.appendChild(nameSpan);

  const actionsDiv = document.createElement('span');
  actionsDiv.className = 'folder-actions always-visible';

  const editBtn = document.createElement('button');
  editBtn.innerHTML = '&#9998;';
  editBtn.className = 'folder-action-btn edit';
  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (folder._id.startsWith('temp_')) {
      showAlert('Folder is being saved...');
      return;
    }
    renameFolder(folder);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '&times;';
  deleteBtn.className = 'folder-action-btn delete';
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (folder._id.startsWith('temp_')) {
      badge.remove();
      return;
    }
    deleteFolderConfirm(folder);
  });

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(deleteBtn);
  badge.appendChild(actionsDiv);
  badge.addEventListener('click', () => selectFolder(folder._id));
  folderListDiv.insertBefore(badge, addFolderBtn);
}

async function loadFolders() {
  try {
    const folders = await apiCall('/folders');
    while (folderListDiv.firstChild) {
      folderListDiv.removeChild(folderListDiv.firstChild);
    }
    folderListDiv.appendChild(addFolderBtn);

    if (folders.length === 0) {
      const placeholder = document.createElement('span');
      placeholder.style.opacity = '0.6';
      placeholder.textContent = translations[currentLang].noFolderSelected;
      folderListDiv.insertBefore(placeholder, addFolderBtn);
      selectFolder(null);
      return;
    }

    folders.forEach(folder => {
      const badge = document.createElement('span');
      badge.className = 'folder-badge' + (folder._id === currentFolderId ? ' active' : '');
      badge.dataset.id = folder._id;
      badge.dataset.borderColor = folder.borderColor || '';

      if (folder.borderColor) badge.style.borderColor = folder.borderColor;
      if (folder._id === currentFolderId && folder.borderColor) {
        badge.style.backgroundColor = folder.borderColor;
        badge.style.color = isLightColor(folder.borderColor) ? '#000' : '#fff';
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = folder.name;
      nameSpan.style.pointerEvents = 'none';
      badge.appendChild(nameSpan);

      const actionsDiv = document.createElement('span');
      actionsDiv.className = 'folder-actions always-visible';

      const editBtn = document.createElement('button');
      editBtn.innerHTML = '&#9998;';
      editBtn.className = 'folder-action-btn edit';
      editBtn.addEventListener('click', e => { e.stopPropagation(); renameFolder(folder); });

      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '&times;';
      deleteBtn.className = 'folder-action-btn delete';
      deleteBtn.addEventListener('click', e => { e.stopPropagation(); deleteFolderConfirm(folder); });

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      badge.appendChild(actionsDiv);
      badge.addEventListener('click', () => selectFolder(folder._id));
      folderListDiv.insertBefore(badge, addFolderBtn);
    });

    initFolderSortable();
  } catch(e) { await showAlert(e.message); }
}

function selectFolder(folderId) {
  currentFolderId = folderId;
  document.querySelectorAll('.folder-badge').forEach(b => {
    b.classList.remove('active');
    b.style.backgroundColor = '';
    b.style.color = '';
  });

  if (folderId) {
    tasksBlock.classList.remove('hidden');
    loadTasks(folderId);

    const activeBadge = document.querySelector(`.folder-badge[data-id="${folderId}"]`);
    if (activeBadge) {
      activeBadge.classList.add('active');
      const bc = activeBadge.dataset.borderColor;
      if (bc) {
        activeBadge.style.backgroundColor = bc;
        activeBadge.style.color = isLightColor(bc) ? '#000' : '#fff';
      }
    }
  } else {
    tasksBlock.classList.add('hidden');
    renderTasks([]);
  }
}

async function renameFolder(folder) {
  const result = await showFolderEditModal(folder.name, folder.borderColor || null);
  if (!result) return;
  const { name, borderColor } = result;
  if (name === '') return;

  const badge = document.querySelector(`.folder-badge[data-id="${folder._id}"]`);
  const oldName = folder.name;
  const oldColor = folder.borderColor;

  if (badge) {
    const nameSpan = badge.querySelector('span:first-child');
    if (nameSpan) nameSpan.textContent = name;
    badge.style.borderColor = borderColor || '';
    badge.dataset.borderColor = borderColor || '';
    if (folder._id === currentFolderId && borderColor) {
      badge.style.backgroundColor = borderColor;
      badge.style.color = isLightColor(borderColor) ? '#000' : '#fff';
    } else if (folder._id === currentFolderId) {
      badge.style.backgroundColor = '';
      badge.style.color = '';
    }
  }

  try {
    await apiCall(`/folders/${folder._id}`, { method:'PUT', body: JSON.stringify({ name, borderColor }) });
    folder.name = name;
    folder.borderColor = borderColor;
  } catch(e) {
    // откат
    if (badge) {
      const nameSpan = badge.querySelector('span:first-child');
      if (nameSpan) nameSpan.textContent = oldName;
      badge.style.borderColor = oldColor || '';
      badge.dataset.borderColor = oldColor || '';
      if (folder._id === currentFolderId && oldColor) {
        badge.style.backgroundColor = oldColor;
        badge.style.color = isLightColor(oldColor) ? '#000' : '#fff';
      } else if (folder._id === currentFolderId) {
        badge.style.backgroundColor = '';
        badge.style.color = '';
      }
    }
    await showAlert(e.message);
  }
}

async function deleteFolderConfirm(folder) {
  if (!(await showConfirm(`Delete folder "${folder.name}" and all its tasks?`))) return;
  const folderEl = [...folderListDiv.querySelectorAll('.folder-badge')].find(el => el.dataset.id === folder._id);

  const removeFromServer = async () => {
    try {
      await apiCall(`/folders/${folder._id}`, { method:'DELETE' });
      if (folderEl && folderEl.parentNode) folderEl.remove();
      if (currentFolderId === folder._id) selectFolder(null);
      loadFolders();
    } catch(e) {
      await showAlert(e.message);
      if (folderEl) folderEl.classList.remove('removing');
      loadFolders();
    }
  };

  if (folderEl) {
    folderEl.classList.add('removing');
    folderEl.addEventListener('animationend', removeFromServer, { once: true });
  } else {
    removeFromServer();
  }
}

// ========== 8. ЗАДАЧИ ==========
const taskListDiv = document.getElementById('taskList');
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');

async function loadTasks(folderId) {
  try {
    const tasks = await apiCall(`/tasks/folder/${folderId}`);
    renderTasks(tasks);
  } catch(e) { await showAlert(e.message); }
}

function renderTasks(tasks) {
  taskListDiv.innerHTML = '';
  if (!tasks.length) {
    taskListDiv.innerHTML = `<p style="opacity:0.6; padding:1rem 0;" data-i18n="noTasks">${translations[currentLang].noTasks}</p>`;
    return;
  }
  tasks.forEach(task => renderSingleTask(task));
  initTaskSortable();
}

function renderSingleTask(task) {
  const div = document.createElement('div');
  div.className = 'task-item' + (task.completed ? ' completed' : '');
  div.dataset.id = task._id;
  div.innerHTML = `
    <input type="checkbox" ${task.completed ? 'checked' : ''} class="task-checkbox" />
    <span class="task-text">${escapeHtml(task.title)}</span>
    <div class="task-actions">
      <button class="edit-btn">${translations[currentLang].edit}</button>
      <button class="delete-btn danger" data-task-id="${task._id}">${translations[currentLang].delete}</button>
    </div>
  `;

  const isTemp = task._id.startsWith('temp_');

  div.querySelector('.task-checkbox').addEventListener('change', e => {
    if (isTemp) {
      e.target.checked = !e.target.checked;
      return;
    }
    toggleTask(task._id, e.target.checked, e.target);
  });

  div.querySelector('.edit-btn').addEventListener('click', () => {
    if (isTemp) {
      showAlert('Please wait until the task is saved.');
      return;
    }
    editTask(task);
  });

  div.querySelector('.delete-btn').addEventListener('click', () => {
    if (isTemp) {
      div.remove();
      return;
    }
    deleteTask(task._id);
  });

  taskListDiv.appendChild(div);
}

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

async function addTask() {
  const title = taskInput.value.trim();
  if (!title || !currentFolderId) return;

  const tempTask = { _id: tempId(), title, completed: false, order: Date.now() };
  renderSingleTask(tempTask);
  taskInput.value = '';

  try {
    await apiCall(`/tasks/folder/${currentFolderId}`, { method:'POST', body: JSON.stringify({ title }) });
    loadTasks(currentFolderId); // обновить список (убрать временную, показать порядок)
  } catch(e) {
    const tempEl = document.querySelector(`.task-item[data-id="${tempTask._id}"]`);
    if (tempEl) tempEl.remove();
    await showAlert(e.message);
  }
}

async function toggleTask(taskId, completed, checkboxElement) {
  const taskItem = checkboxElement.closest('.task-item');
  if (taskItem) taskItem.classList.toggle('completed', completed);
  try {
    await apiCall(`/tasks/${taskId}`, { method:'PUT', body: JSON.stringify({ completed }) });
  } catch(e) {
    if (taskItem) {
      taskItem.classList.toggle('completed', !completed);
      checkboxElement.checked = !completed;
    }
    await showAlert(e.message);
  }
}

async function deleteTask(taskId) {
  if (!(await showConfirm('Delete task?'))) return;
  const taskEl = [...taskListDiv.querySelectorAll('.task-item')].find(el => el.dataset.id === taskId);

  if (taskEl) {
    taskEl.classList.add('removing');
    taskEl.addEventListener('animationend', () => {
      if (taskEl.parentNode) taskEl.remove();
      if (taskListDiv.children.length === 0) renderTasks([]);
    }, { once: true });
  }

  try {
    await apiCall(`/tasks/${taskId}`, { method:'DELETE' });
  } catch(e) {
    await showAlert(e.message);
    loadTasks(currentFolderId);
  }
}

async function editTask(task) {
  const newTitle = await showPrompt('Edit task:', task.title);
  if (newTitle === null || newTitle === '') return;

  const taskEl = [...taskListDiv.querySelectorAll('.task-item')].find(el => el.dataset.id === task._id);
  const oldTitle = task.title;
  if (taskEl) {
    const textSpan = taskEl.querySelector('.task-text');
    if (textSpan) textSpan.textContent = newTitle;
  }

  try {
    await apiCall(`/tasks/${task._id}`, { method:'PUT', body: JSON.stringify({ title: newTitle }) });
    task.title = newTitle;
  } catch(e) {
    if (taskEl) {
      const textSpan = taskEl.querySelector('.task-text');
      if (textSpan) textSpan.textContent = oldTitle;
    }
    await showAlert(e.message);
  }
}

// ========== 9. DRAG‑AND‑DROP ==========
let folderSortable = null;

function initFolderSortable() {
  if (folderSortable) { folderSortable.destroy(); folderSortable = null; }
  const folderList = document.getElementById('folderList');
  if (!folderList) return;

  folderSortable = new Sortable(folderList, {
    animation: 150,
    draggable: '.folder-badge',
    filter: '#addFolderBtn',
    onEnd: async () => {
      const items = [...folderList.querySelectorAll('.folder-badge[data-id]')]
        .filter(item => /^[a-f\d]{24}$/i.test(item.dataset.id));
      if (!items.length) return;
      const ordered = items.map((item, i) => ({ _id: item.dataset.id, order: i }));
      try {
        await apiCall('/folders/order', { method:'PUT', body: JSON.stringify({ folders: ordered }) });
      } catch(e) {
        await showAlert('Failed to update folder order: ' + e.message);
        loadFolders();
      }
    }
  });
}

let taskSortable = null;

function initTaskSortable() {
  if (taskSortable) { taskSortable.destroy(); taskSortable = null; }
  const taskList = document.getElementById('taskList');
  if (!taskList || !currentFolderId) return;

  taskSortable = new Sortable(taskList, {
    animation: 150,
    draggable: '.task-item',
    handle: '.task-item',
    onEnd: async () => {
      const items = [...taskList.querySelectorAll('.task-item[data-id]')]
        .filter(item => item.dataset.id && !item.dataset.id.startsWith('temp_') && /^[a-f\d]{24}$/i.test(item.dataset.id));
      if (!items.length) return;
      const ordered = items.map((item, i) => ({ _id: item.dataset.id, order: i }));
      try {
        await apiCall(`/tasks/folder/${currentFolderId}/order`, { method:'PUT', body: JSON.stringify({ tasks: ordered }) });
      } catch(e) {
        await showAlert('Failed to update order: ' + e.message);
        loadTasks(currentFolderId);
      }
    }
  });
}

// ========== 10. ИНИЦИАЛИЗАЦИЯ ==========
if (token) {
  apiCall('/folders').then(() => showApp()).catch(() => logout());
} else {
  showAuth();
}