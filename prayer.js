'use strict';
// Daily selections stay on this device. No account, geolocation, sensors or API.
(function (root) {
  const keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const prefix = 'jamal-aldin:prayers:';
  function localDay(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function createTracker({ storage = null, now = () => new Date() } = {}) {
    let day = '';
    let completed = new Set();
    let canSave = Boolean(storage);
    const memory = new Map();
    function read() {
      let raw = memory.get(day) || null;
      if (storage) {
        try { raw = storage.getItem(prefix + day); canSave = true; }
        catch { canSave = false; }
      }
      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      completed = new Set(Array.isArray(parsed?.completed) ? parsed.completed.filter(key => keys.includes(key)) : []);
    }
    function snapshot() { return { day, completed: [...completed], canSave }; }
    function sync(force = false) {
      const today = localDay(now());
      if (today !== day || force) { day = today; read(); }
      return snapshot();
    }
    function toggle(key) {
      sync();
      if (!keys.includes(key)) return snapshot();
      if (completed.has(key)) completed.delete(key);
      else completed.add(key);
      const raw = JSON.stringify({ version: 1, completed: [...completed] });
      memory.set(day, raw);
      if (storage) {
        try { storage.setItem(prefix + day, raw); canSave = true; }
        catch { canSave = false; }
      }
      return snapshot();
    }
    sync();
    return { sync, toggle };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { localDay, createTracker, prefix };
    return;
  }
  let storage;
  try { storage = root.localStorage; } catch { storage = null; }
  const model = createTracker({ storage });
  const data = root.JAMAL_PRAYER_DATA;
  const format = new Intl.NumberFormat('ar', { useGrouping: false, numberingSystem: 'arab' });
  const checklist = document.getElementById('prayer-checklist');
  const rows = data.prayers.map(prayer => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prayer-check-row';
    button.dataset.prayerCheck = prayer.key;
    button.setAttribute('aria-pressed', 'false');
    const name = document.createElement('span');
    name.textContent = prayer.name;
    const time = document.createElement('bdi');
    time.textContent = root.JAMAL_PREFS ? root.JAMAL_PREFS.formatTime(data.preview.times[prayer.key], root.JAMAL_PREFS.get().timeFormat) : data.preview.times[prayer.key];
    const circle = document.createElement('span');
    circle.className = 'prayer-check-circle';
    circle.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm5 12 4 4 10-10');
    svg.append(path);
    circle.append(svg);
    button.append(name, time, circle);
    button.addEventListener('click', () => renderTracker(model.toggle(prayer.key)));
    checklist.append(button);
    return { key: prayer.key, button, time };
  });
  function renderTracker(state) {
    const today = document.getElementById('tracker-date');
    today.dateTime = state.day;
    today.textContent = new Intl.DateTimeFormat('ar', { calendar: 'gregory', dateStyle: 'long' }).format(new Date());
    rows.forEach(({ key, button }) => button.setAttribute('aria-pressed', String(state.completed.includes(key))));
    document.getElementById('tracker-count').textContent = `أكملت ${format.format(state.completed.length)} من ${format.format(5)} صلوات`;
    document.getElementById('tracker-storage-note').hidden = state.canSave;
  }
  renderTracker(model.sync());
  root.addEventListener('jamal:preferenceschange', event => {
    rows.forEach(({ key, time }) => { time.textContent = root.JAMAL_PREFS.formatTime(data.preview.times[key], event.detail.timeFormat); });
  });
  let midnightTimer;
  function refreshDay() {
    renderTracker(model.sync());
    clearTimeout(midnightTimer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnightTimer = setTimeout(refreshDay, midnight.getTime() - now.getTime() + 100);
  }
  refreshDay();
  root.addEventListener('focus', refreshDay);
  root.addEventListener('pageshow', refreshDay);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDay(); });
  root.addEventListener('storage', event => {
    if (event.key === null || event.key?.startsWith(prefix)) renderTracker(model.sync(true));
  });

  const page = document.getElementById('page-prayer');
  const overview = document.getElementById('prayer-overview');
  const qibla = document.getElementById('prayer-qibla');
  let scroll = 0;
  let trigger = null;
  let returnFromAI = false;
  let viewRevision = 0;
  let animation;
  function remember(button) { scroll = page.scrollTop; trigger = button; }
  function animate(view) {
    animation?.cancel();
    if (!root.matchMedia('(prefers-reduced-motion: reduce)').matches && view.animate) {
      animation = view.animate([{ opacity: .65, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' });
    }
  }
  function restore() {
    const revision = ++viewRevision;
    requestAnimationFrame(() => {
      if (revision !== viewRevision || overview.hidden) return;
      page.scrollTop = scroll;
      if (!page.inert) trigger?.focus({ preventScroll: true });
    });
  }
  document.getElementById('qibla-open').addEventListener('click', event => {
    remember(event.currentTarget);
    viewRevision++;
    overview.hidden = true;
    qibla.hidden = false;
    page.scrollTop = 0;
    animate(qibla);
    qibla.querySelector('[data-view-heading]').focus({ preventScroll: true });
  });
  document.getElementById('qibla-back').addEventListener('click', () => {
    qibla.hidden = true;
    overview.hidden = false;
    animate(overview);
    restore();
  });
  document.querySelectorAll('[data-prayer-ai]').forEach(button => button.addEventListener('click', () => {
    remember(button);
    returnFromAI = true;
    navigate('ai', button.dataset.prayerAi);
  }));
  root.addEventListener('jamal:routechange', event => {
    if (event.detail.route === 'prayer') {
      refreshDay();
      if (returnFromAI) { returnFromAI = false; restore(); }
    }
  });
})(globalThis);
