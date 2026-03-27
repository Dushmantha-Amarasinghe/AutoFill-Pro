/**
 * AutoFill Pro — Background Service Worker
 * by Refora Technologies
 */

// ─── Context Menu ────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: 'afp-fill',
    title: 'AutoFill Pro — Fill This Form',
    contexts: ['page', 'editable']
  });
  // Set onboarding flag for first-time users
  if (details.reason === 'install') {
    chrome.storage.local.set({ afp_onboarding: 'new' });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'afp-fill' && tab?.id) {
    triggerFillOnTab(tab.id);
  }
});

// ─── Keyboard Command ─────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'trigger-autofill' && tab?.id) {
    triggerFillOnTab(tab.id);
  }
});

// ─── Helper: inject content script and trigger fill ──────────────────────────
async function triggerFillOnTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['crypto-utils.js', 'storage-api.js', 'content.js']
    });
    await chrome.tabs.sendMessage(tabId, { action: 'triggerFill' });
  } catch (e) {
    console.warn('[AutoFill Pro BG] Could not inject into tab:', e.message);
  }
}

// ─── Message Router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {

    case 'triggerFillOnTab': {
      const tabId = request.tabId;
      if (tabId) triggerFillOnTab(tabId);
      sendResponse({ success: true });
      break;
    }

    case 'openDashboard': {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html'), active: true });
      sendResponse({ success: true });
      break;
    }

    case 'scanPage': {
      // Injected by popup to detect forms on the current tab
      chrome.scripting.executeScript({
        target: { tabId: request.tabId },
        files: ['crypto-utils.js', 'storage-api.js', 'content.js']
      }).then(() => {
        chrome.tabs.sendMessage(request.tabId, { action: 'scanFields' }, (res) => {
          sendResponse(res || { count: 0 });
        });
      }).catch(() => sendResponse({ count: 0 }));
      return true; // async
    }

    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true;
});