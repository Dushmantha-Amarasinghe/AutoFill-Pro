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

  // Check if first-time user
  chrome.storage.local.get('afp_onboarding', (res) => {
    if (res.afp_onboarding === 'new') {
      setTimeout(() => startPopupTour(), 500);
    }
  });
}

async function loadData() {
  try {
    const appData = await StorageAPI.getData();
    profiles = appData.profiles || [];
    settings = appData.settings || {};
    const activeId = appData.activeProfileId || 'default';

    // Render profiles
    const selectItems = document.getElementById('profile-select-items');
    const selectDisplay = document.getElementById('profile-select-display');
    const hiddenInput = document.getElementById('profile-select');
    selectItems.innerHTML = '';
    
    profiles.forEach(p => {
      const o = document.createElement('div');
      o.textContent = p.name;
      o.dataset.value = p.id;
      if (p.id === activeId) {
        o.classList.add('same-as-selected');
        selectDisplay.textContent = p.name;
        hiddenInput.value = p.id;
      }
      o.addEventListener('click', async function(e) {
        e.stopPropagation();
        selectDisplay.textContent = p.name;
        hiddenInput.value = p.id;
        
        const same = selectItems.querySelector('.same-as-selected');
        if (same) same.classList.remove('same-as-selected');
        o.classList.add('same-as-selected');
        
        selectItems.classList.add('select-hide');
        selectDisplay.classList.remove('open');
        
        if (p.color) {
          profileDot.style.background = p.color;
          profileDot.style.boxShadow = `0 0 8px ${p.color}`;
        }
        await StorageAPI.setActiveProfile(p.id);
      });
      selectItems.appendChild(o);
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
document.getElementById('profile-select-display')?.addEventListener('click', function(e) {
  e.stopPropagation();
  const items = document.getElementById('profile-select-items');
  items.classList.toggle('select-hide');
  this.classList.toggle('open');
});

document.addEventListener('click', function(e) {
  const selectDisplay = document.getElementById('profile-select-display');
  const selectItems = document.getElementById('profile-select-items');
  if (selectDisplay && selectItems && e.target !== selectDisplay) {
    selectItems.classList.add('select-hide');
    selectDisplay.classList.remove('open');
  }
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

// ─── Popup Onboarding Tour ────────────────────────────────────────────────────
const POPUP_TOUR_STEPS = [
  {
    targetId: 'profile-select-container',
    title: '👤 Your Active Profile',
    body: 'This is the <strong>profile that gets used</strong> when filling forms. You can create multiple profiles — Work, Personal, University — and switch between them here.'
  },
  {
    targetId: 'btn-fill',
    title: '⚡ Fill This Page',
    body: 'Tap this button to <strong>instantly fill all form fields</strong> on the current page using your active profile data.'
  },
  {
    targetId: 'toggles',
    title: '⚙️ Smart Options',
    body: 'Toggle <strong>Auto-fill on page load</strong> to fill forms automatically, or enable <strong>Highlight fields</strong> to preview what gets filled.',
    targetClass: true
  },
  {
    targetId: 'btn-dashboard',
    title: '🗂️ Add Your Data',
    body: 'Head to <strong>Advanced Configuration</strong> to enter your name, email, phone and set up custom fields. This is where your data lives.',
    isLast: true
  }
];

let tourStep = 0;

function liftClear() {
  document.querySelectorAll('.tour-lifted').forEach(el => {
    el.classList.remove('tour-lifted');
  });
}

function startPopupTour() {
  tourStep = 0;
  document.getElementById('tour-overlay').classList.add('active');
  const tooltip = document.getElementById('tour-tooltip');
  tooltip.style.display = 'block';

  const dotsEl = document.getElementById('tour-dots');
  dotsEl.innerHTML = POPUP_TOUR_STEPS.map((_, i) =>
    `<div class="tour-dot${i === 0 ? ' active' : ''}"></div>`
  ).join('');

  document.getElementById('tour-skip').addEventListener('click', endPopupTour);
  document.getElementById('tour-next').addEventListener('click', advancePopupTour);

  renderPopupTourStep();
}

function renderPopupTourStep() {
  const step  = POPUP_TOUR_STEPS[tourStep];
  const total = POPUP_TOUR_STEPS.length;

  document.getElementById('tour-step-label').textContent = `Step ${tourStep + 1} of ${total}`;
  document.getElementById('tour-title').textContent      = step.title;
  document.getElementById('tour-body').innerHTML         = step.body;
  document.getElementById('tour-next').textContent       = step.isLast ? "Let's Go! →" : 'Next →';

  document.querySelectorAll('.tour-dot').forEach((d, i) =>
    d.classList.toggle('active', i === tourStep));

  // Remove previous lifted target
  liftClear();

  const targetEl = step.targetClass
    ? document.getElementsByClassName(step.targetId)[0]
    : document.getElementById(step.targetId);

  const tooltip = document.getElementById('tour-tooltip');
  tooltip.className = 'tour-tooltip'; // reset arrow class

  if (targetEl) {
    // Lift the target above the blurred overlay so it appears sharp
    targetEl.classList.add('tour-lifted');

    const r          = targetEl.getBoundingClientRect();
    const TOOLTIP_H  = 175;
    const GAP        = 12;
    const spaceBelow = window.innerHeight - r.bottom;

    if (spaceBelow >= TOOLTIP_H + GAP) {
      tooltip.classList.add('arrow-up');
      tooltip.style.top    = (r.bottom + GAP) + 'px';
      tooltip.style.bottom = 'auto';
    } else {
      tooltip.classList.add('arrow-down');
      tooltip.style.bottom = (window.innerHeight - r.top + GAP) + 'px';
      tooltip.style.top    = 'auto';
    }
  }
}

function advancePopupTour() {
  if (POPUP_TOUR_STEPS[tourStep].isLast) {
    chrome.storage.local.set({ afp_onboarding: 'dashboard' }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html'), active: true });
      window.close();
    });
    return;
  }
  tourStep++;
  renderPopupTourStep();
}

function endPopupTour() {
  chrome.storage.local.set({ afp_onboarding: 'done' });
  liftClear();
  document.getElementById('tour-overlay').classList.remove('active');
  const tooltip = document.getElementById('tour-tooltip');
  tooltip.style.opacity    = '0';
  tooltip.style.transition = 'opacity 0.2s';
  setTimeout(() => { tooltip.style.display = 'none'; tooltip.style.opacity = ''; }, 220);
}