/**
 * AutoFill Pro — Popup Script
 * by Refora Technologies
 */

// Elements
const profileSelect  = document.getElementById('profile-select');
const profileDot     = document.getElementById('profile-indicator');
const statusDot      = document.getElementById('status-dot');
const statusText     = document.getElementById('status-text');
const statusCard     = document.getElementById('status-card');
const btnFill        = document.getElementById('btn-fill');
const btnDashboard   = document.getElementById('btn-dashboard');
const btnRefresh     = document.getElementById('btn-refresh');
const toggleLoad     = document.getElementById('toggle-autofill-load');
const toggleSubmit   = document.getElementById('toggle-autosubmit');
const toggleHL       = document.getElementById('toggle-highlight');

let currentTab = null;
let settings   = {};
let profiles   = [];

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  await loadData();
  await scanPage();
}

async function loadData() {
  try {
    const appData = await StorageAPI.getData();
    profiles = appData.profiles || [];
    settings = appData.settings || {};
    const activeId = appData.activeProfileId || 'default';

    // Render profiles
    profileSelect.innerHTML = '';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      opt.selected = p.id === activeId;
      profileSelect.appendChild(opt);
    });

    // Update profile dot color
    const activeProfile = profiles.find(p => p.id === activeId) || profiles[0];
    if (activeProfile?.color) {
      profileDot.style.background = activeProfile.color;
      profileDot.style.boxShadow = `0 0 8px ${activeProfile.color}`;
    }

    // Apply toggles
    toggleLoad.checked   = !!settings.autofillOnLoad;
    toggleSubmit.checked = !!settings.autosubmit;
    toggleHL.checked     = settings.highlightBeforeFill !== false;
  } catch (e) {
    console.warn('Popup Data Load Error:', e);
  }
}

// Crypto fallback methods removed, relying entirely on StorageAPI

// ─── Page Scanner ─────────────────────────────────────────────────────────────
async function scanPage() {
  setStatus('scanning', 'Scanning page…', '');
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['crypto-utils.js', 'storage-api.js', 'content.js']
    });
    const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'scanFields' }).catch(() => null);
    const count = response?.count || 0;

    if (count > 0) {
      setStatus('active', `<strong>${count} fillable field${count > 1 ? 's' : ''} detected</strong>`, 'detected');
      btnFill.disabled = false;
    } else {
      setStatus('inactive', 'No form fields detected on this page', 'none');
      btnFill.disabled = false; // Still allow manual fill attempt
    }
  } catch (e) {
    setStatus('inactive', 'Cannot access this page (restricted)', 'none');
    btnFill.disabled = true;
  }
}

function setStatus(dotClass, html, cardClass) {
  statusDot.className  = 'status-dot ' + dotClass;
  statusText.innerHTML = html;
  statusCard.className = 'status-card ' + cardClass;
}

// ─── Fill Trigger ─────────────────────────────────────────────────────────────
btnFill.addEventListener('click', async () => {
  btnFill.disabled = true;
  const fillIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  btnFill.innerHTML = fillIcon + ' Filling…';

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'triggerFill' });
    const count = response?.filled || 0;

    if (count > 0) {
      btnFill.innerHTML = fillIcon + ` Filled ${count} field${count > 1 ? 's' : ''}!`;
      btnFill.classList.add('success');
      setTimeout(() => {
        btnFill.innerHTML = fillIcon + ' Fill This Page';
        btnFill.classList.remove('success');
        btnFill.disabled = false;
      }, 2500);
    } else {
      btnFill.innerHTML = fillIcon + ' Fill This Page';
      btnFill.disabled = false;
    }
  } catch (e) {
    btnFill.innerHTML = fillIcon + ' Fill This Page';
    btnFill.disabled = false;
  }
});

// ─── Profile Switch ───────────────────────────────────────────────────────────
profileSelect.addEventListener('change', async () => {
  const selectedId = profileSelect.value;
  const selected = profiles.find(p => p.id === selectedId);
  if (selected?.color) {
    profileDot.style.background = selected.color;
    profileDot.style.boxShadow = `0 0 8px ${selected.color}`;
  }
  await StorageAPI.setActiveProfile(selectedId);
});

// ─── Toggles ──────────────────────────────────────────────────────────────────
async function saveToggle() {
  settings.autofillOnLoad      = toggleLoad.checked;
  settings.autosubmit          = toggleSubmit.checked;
  settings.highlightBeforeFill = toggleHL.checked;
  await StorageAPI.saveSettings(settings);
}

toggleLoad.addEventListener('change', saveToggle);
toggleSubmit.addEventListener('change', saveToggle);
toggleHL.addEventListener('change', saveToggle);

// ─── Dashboard ────────────────────────────────────────────────────────────────
btnDashboard.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html'), active: true });
  window.close();
});

// ─── Refresh / Re-scan ────────────────────────────────────────────────────────
btnRefresh.addEventListener('click', () => {
  btnRefresh.style.transform = 'rotate(360deg)';
  btnRefresh.style.transition = 'transform 0.5s ease';
  setTimeout(() => { btnRefresh.style.transform = ''; }, 500);
  scanPage();
});

// ─── Start ────────────────────────────────────────────────────────────────────
init();