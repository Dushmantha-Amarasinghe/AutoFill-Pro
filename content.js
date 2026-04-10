/**
 * AutoFill Pro — Universal Content Script
 * Works on any website, any form, any language.
 * by Refora Technologies
 */

(async () => {
  // Prevent double-injection
  if (window.__afpInjected) return;
  window.__afpInjected = true;

  // Toast throttle — prevent spam for 'no fields' messages
  let _lastNoFieldsToast = 0;
  const NO_FIELDS_THROTTLE_MS = 30000; // only show 'no fields' toast once per 30 seconds

  // ─── Field Matching Score Weights ─────────────────────────────────────────
  const MATCH_THRESHOLD = 0.35;

  // Built-in field matcher configs
  const BUILT_IN_MATCHERS = [
    { key: 'firstName',   keywords: ['first name', 'firstname', 'given name', 'fname', 'first_name'] },
    { key: 'lastName',    keywords: ['last name', 'lastname', 'surname', 'family name', 'lname', 'last_name'] },
    { key: 'email',       keywords: ['email', 'e-mail', 'mail', 'email address'] },
    { key: 'nic',         keywords: ['nic', 'national id', 'identity', 'id number', 'passport', 'id card'] },
    { key: 'whatsapp',    keywords: ['whatsapp', 'whatsapp number', 'wa number'] },
    { key: 'landphone',   keywords: ['land', 'landline', 'land phone', 'telephone', 'home phone', 'office phone'] },
    { key: 'mobile',      keywords: ['mobile', 'phone', 'cell', 'cellular', 'contact', 'mobile number', 'phone number'] },
    { key: 'organization',keywords: ['organization', 'organisation', 'company', 'workplace', 'employer', 'institute', 'institution', 'school', 'university', 'college'] },
    { key: 'jobTitle',    keywords: ['job title', 'position', 'designation', 'role', 'occupation', 'profession'] },
    { key: 'city',        keywords: ['city', 'town', 'district', 'municipality'] },
    { key: 'country',     keywords: ['country', 'nation', 'region'] }
  ];

  // ─── Notification UI ──────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('afp-styles')) return;
    const style = document.createElement('style');
    style.id = 'afp-styles';
    style.textContent = `
      #afp-toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      .afp-toast {
        font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 500;
        padding: 12px 18px;
        border-radius: 12px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: #F4F0E8;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 240px;
        max-width: 340px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
        transform: translateX(110%);
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        opacity: 0;
        pointer-events: all;
        cursor: default;
      }
      .afp-toast.show {
        transform: translateX(0);
        opacity: 1;
      }
      .afp-toast.afp-success { background: rgba(18, 15, 10, 0.96); border-left: 3px solid #2BA82B; }
      .afp-toast.afp-error   { background: rgba(18, 15, 10, 0.96); border-left: 3px solid #D05040; }
      .afp-toast.afp-info    { background: rgba(18, 15, 10, 0.96); border-left: 3px solid #E8530A; }
      .afp-toast .afp-icon   { font-size: 16px; flex-shrink: 0; }
      .afp-toast .afp-close  { margin-left: auto; cursor: pointer; opacity: 0.5; font-size: 16px; line-height: 1; }
      .afp-toast .afp-close:hover { opacity: 1; }
      .afp-toast .afp-brand  { font-size: 10px; opacity: 0.35; display: block; margin-top: 2px; }

      .afp-highlight {
        outline: 2px solid rgba(232, 83, 10, 0.7) !important;
        outline-offset: 2px !important;
        background-color: rgba(232, 83, 10, 0.06) !important;
        transition: outline 0.2s ease, background-color 0.2s ease !important;
      }
      .afp-highlight-dropdown {
        outline: 2px solid rgba(245, 162, 25, 0.7) !important;
        outline-offset: 2px !important;
        background-color: rgba(245, 162, 25, 0.06) !important;
      }
      .afp-filled {
        outline: 2px solid #2BA82B !important;
        outline-offset: 2px !important;
        background-color: rgba(43, 168, 43, 0.05) !important;
        transition: outline 0.2s ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  let toastContainer = null;
  function getToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'afp-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(message, type = 'success', duration = 4000) {
    injectStyles();
    const icons = { success: '✅', error: '⚠️', info: '⚡' };
    const container = getToastContainer();

    const toast = document.createElement('div');
    toast.className = `afp-toast afp-${type}`;
    toast.innerHTML = `
      <span class="afp-icon">${icons[type] || '•'}</span>
      <span><span>${message}</span><span class="afp-brand">AutoFill Pro · Refora Technologies</span></span>
      <span class="afp-close" title="Dismiss">✕</span>
    `;
    container.appendChild(toast);
    toast.querySelector('.afp-close').addEventListener('click', () => dismissToast(toast));
    requestAnimationFrame(() => { setTimeout(() => toast.classList.add('show'), 10); });
    setTimeout(() => dismissToast(toast), duration);
  }

  function dismissToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }

  // ─── Field Text Extraction ─────────────────────────────────────────────────
  function getFieldLabel(el) {
    const labelTexts = [];

    // aria-label
    if (el.getAttribute('aria-label')) labelTexts.push(el.getAttribute('aria-label'));

    // explicit label
    const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
    if (labelEl) labelTexts.push(labelEl.innerText || labelEl.textContent);

    // placeholder
    if (el.placeholder) labelTexts.push(el.placeholder);

    // name attribute
    if (el.name) labelTexts.push(el.name.replace(/[_-]/g, ' '));

    // id attribute
    if (el.id) labelTexts.push(el.id.replace(/[_-]/g, ' '));

    // aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const refs = labelledBy.split(' ');
      refs.forEach(id => {
        const ref = document.getElementById(id);
        if (ref) labelTexts.push(ref.innerText || ref.textContent);
      });
    }

    // Walk up DOM tree looking for parent label or legend
    let parent = el.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const legend = parent.querySelector('legend');
      if (legend) labelTexts.push(legend.innerText || legend.textContent);
      if (parent.tagName === 'LABEL') labelTexts.push(parent.innerText || parent.textContent);
      // Preceding sibling text
      let sib = el.previousElementSibling;
      while (sib) {
        const sibText = (sib.innerText || sib.textContent || '').trim();
        if (sibText.length > 0 && sibText.length < 100) labelTexts.push(sibText);
        sib = sib.previousElementSibling;
      }
      parent = parent.parentElement;
    }

    return labelTexts.join(' ').toLowerCase().trim();
  }

  // ─── Fuzzy Score ──────────────────────────────────────────────────────────
  function scoreMatch(fieldText, keywords) {
    const text = fieldText.toLowerCase();
    let best = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) { best = Math.max(best, 1.0); break; }
      const words = kw.split(' ');
      const wordHits = words.filter(w => text.includes(w)).length;
      const score = wordHits / words.length;
      best = Math.max(best, score);
    }
    return best;
  }

  // ─── Value Dispatch (React/Vue/Angular compatible) ────────────────────────
  function setInputValue(el, value) {
    el.focus(); // Wake up custom dropdowns

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    
    if (el.tagName === 'TEXTAREA' && nativeTextareaSetter) {
      nativeTextareaSetter.set.call(el, value);
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.set.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Send Enter key to finalize selection on custom comboboxes/React-Select
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
    el.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13 }));

    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    // NEW: Handle Custom Comboboxes (like Zoom React Select)
    if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox') {
      setTimeout(() => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        const targetVal = value.toLowerCase().trim();
        for (const opt of options) {
          const text = (opt.textContent || opt.innerText || opt.getAttribute('aria-label') || '').toLowerCase().trim();
          if (text === targetVal || text.includes(targetVal)) {
            opt.click();
            opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            break;
          }
        }
      }, 200); // Give the DOM 200ms to render the dropdown list
    }
  }

  function setSelectValue(selectEl, targetValue) {
    const normalizedTarget = targetValue.toLowerCase().trim();
    let bestOption = null;
    let bestScore = 0;

    for (const option of selectEl.options) {
      if (option.value === '' || option.disabled) continue;
      const optText = (option.text + ' ' + option.value).toLowerCase();
      if (optText.includes(normalizedTarget) || normalizedTarget.includes(optText.replace(/\s+/g, ' ').trim())) {
        const score = optText === normalizedTarget ? 1 : 0.8;
        if (score > bestScore) { bestScore = score; bestOption = option; }
      }
    }

    if (!bestOption && normalizedTarget.length > 2) {
      // Partial match
      for (const option of selectEl.options) {
        if (option.value === '' || option.disabled) continue;
        const optText = option.text.toLowerCase();
        if (optText.startsWith(normalizedTarget.slice(0, 4))) {
          bestOption = option;
          break;
        }
      }
    }

    if (bestOption) {
      selectEl.value = bestOption.value;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  // ─── Core Fill Engine (public-facing wrapper) ────────────────────────────────
  async function fillForm(highlight = false, autoSubmit = false, isManualTrigger = false) {
    injectStyles();
    let profile;
    try {
      const currentUrl = window.location.href;
      const urlRules = await StorageAPI.getUrlRules().catch(() => []);
      let matchedProfileId = null;
      
      if (urlRules && Array.isArray(urlRules)) {
        for (const rule of urlRules) {
          if (rule.pattern && rule.profileId && currentUrl.includes(rule.pattern)) {
            matchedProfileId = rule.profileId;
            break;
          }
        }
      }

      if (matchedProfileId) {
        const profiles = await StorageAPI.getProfiles();
        profile = profiles.find(p => p.id === matchedProfileId);
      }
      
      if (!profile) {
        profile = await StorageAPI.getActiveProfile();
      }
    } catch (e) {
      showToast('Could not load profile data', 'error');
      return { filled: 0 };
    }

    if (!profile) {
      showToast('No profile found. Set up your info in AutoFill Pro!', 'error');
      return { filled: 0 };
    }

    const allValues = {
      ...profile.fields,
      ...(profile.customFields || []).reduce((acc, f) => {
        if (f.label && f.value) acc[f.label.toLowerCase()] = f;
        return acc;
      }, {})
    };

    // Collect all fillable fields
    const inputs = Array.from(document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"]), textarea, select'
    )).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled && !el.readOnly;
    });

    if (inputs.length === 0) {
      showToast('No fillable fields found on this page', 'info');
      return { filled: 0 };
    }

    let filledCount = 0;
    let skippedCount = 0;

    for (const el of inputs) {
      const fieldText = getFieldLabel(el);
      const isSelect = el.tagName === 'SELECT';

      // Skip if already filled (unless it's a select)
      if (!isSelect && el.value && el.value.trim() !== '') { skippedCount++; continue; }

      let filled = false;

      // 1. Try built-in matchers
      let bestMatch = null;
      let bestScore = MATCH_THRESHOLD;

      for (const matcher of BUILT_IN_MATCHERS) {
        const score = scoreMatch(fieldText, matcher.keywords);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = matcher.key;
        }
      }

      if (bestMatch && profile.fields[bestMatch]) {
        if (highlight) el.classList.add(isSelect ? 'afp-highlight-dropdown' : 'afp-highlight');
        await new Promise(r => setTimeout(r, highlight ? 300 : 0));

        if (isSelect) {
          filled = setSelectValue(el, profile.fields[bestMatch]);
        } else {
          setInputValue(el, profile.fields[bestMatch]);
          filled = true;
        }
      }

      // 2. Try custom fields if not yet filled
      if (!filled && profile.customFields && profile.customFields.length > 0) {
        for (const cf of profile.customFields) {
          if (!cf.label || !cf.value) continue;
          const cfKeywords = [cf.label.toLowerCase(), ...(cf.aliases || []).map(a => a.toLowerCase())];
          const score = scoreMatch(fieldText, cfKeywords);
          if (score >= MATCH_THRESHOLD) {
            if (highlight) el.classList.add(isSelect ? 'afp-highlight-dropdown' : 'afp-highlight');
            await new Promise(r => setTimeout(r, highlight ? 300 : 0));

            if (isSelect) {
              filled = setSelectValue(el, cf.value);
            } else {
              setInputValue(el, cf.value);
              filled = true;
            }
            break;
          }
        }
      }

      if (filled) {
        filledCount++;
        el.classList.remove('afp-highlight', 'afp-highlight-dropdown');
        el.classList.add('afp-filled');
        setTimeout(() => el.classList.remove('afp-filled'), 2500);
      }
    }

    if (filledCount > 0) {
      showToast(`Filled ${filledCount} field${filledCount > 1 ? 's' : ''}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`, 'success');

      // Log to history
      try {
        await StorageAPI.addHistoryEntry({
          url: window.location.hostname,
          title: document.title.slice(0, 60),
          fieldsFilled: filledCount,
          profileName: profile.name
        });
      } catch (e) { /* history logging is non-critical */ }

      if (autoSubmit) {
        setTimeout(() => tryAutoSubmit(), 1200);
      }
    } else {
      // Throttle 'no fields' toasts — only show if manually triggered or enough time has passed
      const now = Date.now();
      if (isManualTrigger || now - _lastNoFieldsToast > NO_FIELDS_THROTTLE_MS) {
        showToast('No matching fields found for your profile data', 'info');
        _lastNoFieldsToast = now;
      }
    }

    return { filled: filledCount };
  }

  // ─── Auto Submit ──────────────────────────────────────────────────────────
  function tryAutoSubmit() {
    const submitKeywords = ['register', 'submit', 'send', 'continue', 'next', 'sign up', 'signup', 'enroll', 'join'];
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], [type="submit"]'));
    
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase().trim();
      if (submitKeywords.some(kw => text.includes(kw))) {
        btn.click();
        showToast('Form submitted automatically', 'info');
        return;
      }
    }

    // Try form submit directly
    const form = document.querySelector('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  // ─── Field Scanner (for popup status) ─────────────────────────────────────
  function scanFields() {
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"]), textarea, select'
    );
    const visibleInputs = Array.from(inputs).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    return { count: visibleInputs.length };
  }

  function isUrlAllowedForAutoFill(currentUrl, userRules) {
    const defaultRules = [
      'zoom.us/webinar',
      'zoom.us/meeting',
      'docs.google.com/forms'
    ];
    
    // Check defaults
    for (const rule of defaultRules) {
      if (currentUrl.includes(rule)) return true;
    }
    
    // Check custom rules from dashboard
    if (userRules && Array.isArray(userRules)) {
      for (const rule of userRules) {
        if (rule.pattern && currentUrl.includes(rule.pattern)) return true;
      }
    }
    
    return false;
  }

  // ─── Auto-fill on Page Load ──────────────────────────────────────────────
  let _hasAutoFilledForPage = false; 

  async function tryAutoFill() {
    if (_hasAutoFilledForPage) return;
    try {
      const settings = await StorageAPI.getSettings();
      if (!settings.autofillOnLoad) {
        _hasAutoFilledForPage = true; // Mark done if disabled
        return;
      }

      // Check if URL is allowed (Zoom, Google Forms, or user-defined rule)
      const urlRules = await StorageAPI.getUrlRules().catch(() => []);
      if (!isUrlAllowedForAutoFill(window.location.href, urlRules)) {
        _hasAutoFilledForPage = true; // Mark done so we don't spam check disallowed pages
        return;
      }
      
      const fields = scanFields();
      if (fields.count > 0) {
        _hasAutoFilledForPage = true; // Prevent infinite fill loops
        fillForm(settings.highlightBeforeFill, settings.autosubmit, false);
      }
    } catch (e) { /* silent */ }
  }

  // ─── MutationObserver for SPAs ───────────────────────────────────────────
  let _lastUrl = location.href;
  let observerTimeout = null;
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(() => {
      // 1. Check for URL change (SPA navigation)
      const currentUrl = location.href;
      if (currentUrl !== _lastUrl) {
        _lastUrl = currentUrl;
        _hasAutoFilledForPage = false; // Reset for new page
      }

      // 2. If we haven't successfully auto-filled yet, try now
      // This handles slow-rendering SPAs like Zoom forms!
      if (!_hasAutoFilledForPage) {
        tryAutoFill();
      }
    }, 800);
  });

  // ─── Message Listener ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'triggerFill') {
      // Manual trigger — always shows toast, bypasses throttle
      StorageAPI.getSettings().then(settings => {
        fillForm(settings.highlightBeforeFill, settings.autosubmit, true).then(sendResponse);
      });
      return true;
    }

    if (request.action === 'scanFields') {
      sendResponse(scanFields());
      return false;
    }

    if (request.action === 'ping') {
      sendResponse({ alive: true });
      return false;
    }
  });

  // ─── Initialize ───────────────────────────────────────────────────────────
  injectStyles();
  setTimeout(tryAutoFill, 900);

  // Observe for SPA navigation
  observer.observe(document.body, { childList: true, subtree: true });

})();
