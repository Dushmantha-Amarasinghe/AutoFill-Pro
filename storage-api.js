/**
 * AutoFill Pro — Storage API
 * Unified encrypted storage layer using chrome.storage.local
 * by Refora Technologies
 */

var StorageAPI = StorageAPI || (() => {
  const STORAGE_KEY = 'afp_data_v2';
  const HISTORY_MAX = 50;

  const DEFAULT_DATA = {
    profiles: [
      {
        id: 'default',
        name: 'My Profile',
        color: '#E8530A',
        fields: {
          firstName: '',
          lastName: '',
          email: '',
          mobile: '',
          nic: '',
          whatsapp: '',
          landphone: '',
          organization: '',
          jobTitle: '',
          city: '',
          country: ''
        },
        customFields: []
      }
    ],
    activeProfileId: 'default',
    settings: {
      autofill: true,
      autosubmit: false,
      highlightBeforeFill: true,
      autofillOnLoad: false
    },
    history: [],
    urlRules: []
  };

  // Generate a unique ID
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // Load and decrypt data from storage
  async function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, async (result) => {
        const raw = result[STORAGE_KEY];
        if (!raw) {
          resolve(JSON.parse(JSON.stringify(DEFAULT_DATA)));
          return;
        }
        try {
          const decrypted = await CryptoUtils.decrypt(raw);
          // Merge with defaults to handle schema upgrades
          resolve({
            ...JSON.parse(JSON.stringify(DEFAULT_DATA)),
            ...decrypted,
            settings: { ...DEFAULT_DATA.settings, ...(decrypted.settings || {}) }
          });
        } catch (e) {
          console.warn('[AutoFill Pro] Storage decrypt failed, resetting.', e);
          resolve(JSON.parse(JSON.stringify(DEFAULT_DATA)));
        }
      });
    });
  }

  // Encrypt and save data to storage
  async function save(data) {
    const encrypted = await CryptoUtils.encrypt(data);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: encrypted }, resolve);
    });
  }

  // --- Public API ---

  async function getData() {
    return load();
  }

  async function getProfiles() {
    const data = await load();
    return data.profiles;
  }

  async function getActiveProfile() {
    const data = await load();
    return data.profiles.find(p => p.id === data.activeProfileId) || data.profiles[0];
  }

  async function saveProfile(profile) {
    const data = await load();
    const idx = data.profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      data.profiles[idx] = profile;
    } else {
      data.profiles.push(profile);
    }
    await save(data);
  }

  async function deleteProfile(profileId) {
    const data = await load();
    if (data.profiles.length <= 1) return; // Keep at least one
    data.profiles = data.profiles.filter(p => p.id !== profileId);
    if (data.activeProfileId === profileId) {
      data.activeProfileId = data.profiles[0].id;
    }
    await save(data);
  }

  async function setActiveProfile(profileId) {
    const data = await load();
    data.activeProfileId = profileId;
    await save(data);
  }

  async function createProfile(name, color) {
    const data = await load();
    const newProfile = {
      ...JSON.parse(JSON.stringify(DEFAULT_DATA.profiles[0])),
      id: uid(),
      name: name || 'New Profile',
      color: color || '#E8530A'
    };
    data.profiles.push(newProfile);
    await save(data);
    return newProfile;
  }

  async function getSettings() {
    const data = await load();
    return data.settings;
  }

  async function saveSettings(settings) {
    const data = await load();
    data.settings = { ...data.settings, ...settings };
    await save(data);
  }

  async function addHistoryEntry(entry) {
    const data = await load();
    data.history.unshift({
      id: uid(),
      timestamp: new Date().toISOString(),
      ...entry
    });
    data.history = data.history.slice(0, HISTORY_MAX);
    await save(data);
  }

  async function clearHistory() {
    const data = await load();
    data.history = [];
    await save(data);
  }

  async function getUrlRules() {
    const data = await load();
    return data.urlRules || [];
  }

  async function saveUrlRules(rules) {
    const data = await load();
    data.urlRules = rules;
    await save(data);
  }

  async function exportData() {
    const data = await load();
    return CryptoUtils.encrypt(data);
  }

  async function importData(encryptedBase64) {
    const imported = await CryptoUtils.decrypt(encryptedBase64);
    await save(imported);
    return imported;
  }

  async function resetAll() {
    await chrome.storage.local.remove(STORAGE_KEY);
  }

  return {
    getData,
    getProfiles,
    getActiveProfile,
    saveProfile,
    deleteProfile,
    setActiveProfile,
    createProfile,
    getSettings,
    saveSettings,
    addHistoryEntry,
    clearHistory,
    getUrlRules,
    saveUrlRules,
    exportData,
    importData,
    resetAll,
    uid
  };
})();
