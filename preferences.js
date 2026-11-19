'use strict';
(function (root) {
  const key = 'jamal-aldin:preferences:v1';
  const defaults = Object.freeze({ theme: 'light', fontSize: 'medium', language: 'ar', city: '', country: '', prayerMethod: 'unset', timeFormat: '24', verseSize: 28, saveChats: true, alertFajr: false, alertDhuhr: false, alertAsr: false, alertMaghrib: false, alertIsha: false, alertAdhkar: false, alertDaily: false, alertSound: false });
  const choices = { theme: ['light', 'dark', 'system'], fontSize: ['small', 'medium', 'large'], language: ['ar'], prayerMethod: ['unset', 'mwl', 'egyptian', 'ummalqura', 'isna'], timeFormat: ['12', '24'] };
  function normalize(raw = {}) {
    const result = { ...defaults };
    if (!raw || typeof raw !== 'object') return result;
    for (const name of Object.keys(defaults)) {
      if (choices[name] && choices[name].includes(raw[name])) result[name] = raw[name];
      else if (typeof defaults[name] === 'boolean' && typeof raw[name] === 'boolean') result[name] = raw[name];
      else if (['city', 'country'].includes(name) && typeof raw[name] === 'string') result[name] = raw[name].slice(0, 80);
      else if (name === 'verseSize' && Number.isInteger(Number(raw[name])) && Number(raw[name]) >= 20 && Number(raw[name]) <= 44) result[name] = Number(raw[name]);
    }
    return result;
  }
  function createPreferences(storage, onChange = () => {}) {
    let value = { ...defaults };
    try { value = normalize(JSON.parse(storage?.getItem(key) || '{}')); } catch {}
    function update(next, reset = false) {
      value = normalize(next);
      let saved = false;
      try {
        if (!storage) throw Error('Storage unavailable');
        if (reset) storage.removeItem(key); else storage.setItem(key, JSON.stringify(value));
        saved = true;
      } catch {}
      onChange({ ...value });
      return { saved, value: { ...value } };
    }
    return { get: () => ({ ...value }), set: patch => update({ ...value, ...patch }), reset: () => update(defaults, true), reload: () => { try { value = normalize(JSON.parse(storage?.getItem(key) || '{}')); onChange({ ...value }); } catch {} } };
  }
  function formatTime(value, format = '24') {
    if (format !== '12' || !/^\d{2}:\d{2}$/.test(value)) return value;
    const [hours, minutes] = value.split(':').map(Number);
    return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'ص' : 'م'}`;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { defaults, key, normalize, createPreferences, formatTime }; return; }
  const system = root.matchMedia('(prefers-color-scheme: dark)');
  function apply(value) {
    const html = document.documentElement;
    html.dataset.theme = value.theme === 'system' ? (system.matches ? 'dark' : 'light') : value.theme;
    document.querySelector?.('meta[name="theme-color"]')?.setAttribute('content', html.dataset.theme === 'dark' ? '#10251F' : '#F7F4ED');
    html.style.setProperty('--ui-font-size', { small: '14px', medium: '16px', large: '18px' }[value.fontSize]);
    html.style.setProperty('--verse-font-size', `${value.verseSize}px`);
    root.dispatchEvent(new CustomEvent('jamal:preferenceschange', { detail: value }));
  }
  let storage;
  try { storage = root.localStorage; } catch {}
  const preferences = createPreferences(storage, apply);
  Object.defineProperty(root, 'JAMAL_PREFS', { value: { ...preferences, defaults, formatTime } });
  apply(preferences.get());
  system.addEventListener?.('change', () => apply(preferences.get()));
  root.addEventListener('storage', event => { if (event.key === key || event.key === null) preferences.reload(); });
})(globalThis);
