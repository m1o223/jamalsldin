'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createPreferences, normalize, key, formatTime } = require('../preferences.js');
const root = path.join(__dirname, '..');
const values = new Map([['unrelated-site-data', 'keep'], ['jamal-aldin:prayers:2026-11-19', 'keep']]);
const storage = { getItem: name => values.get(name) || null, setItem: (name, value) => values.set(name, value), removeItem: name => values.delete(name) };
const prefs = createPreferences(storage);
prefs.set({ theme: 'dark', fontSize: 'large', city: 'مدينة يدوية', country: 'دولة يدوية', prayerMethod: 'mwl', timeFormat: '12', verseSize: 40, alertFajr: true, saveChats: false });
const loaded = createPreferences(storage);
assert.equal(loaded.get().theme, 'dark'); assert.equal(loaded.get().city, 'مدينة يدوية');
assert.equal(loaded.get().alertFajr, true); assert.equal(loaded.get().verseSize, 40); assert.equal(loaded.get().saveChats, false);
assert.equal(normalize({ theme: 'bad', language: 'en', verseSize: 999 }).language, 'ar');
assert.equal(normalize({ verseSize: 999 }).verseSize, 28);
assert.equal(formatTime('15:45', '12'), '03:45 م'); assert.equal(formatTime('00:15', '12'), '12:15 ص'); assert.equal(formatTime('12:30', '12'), '12:30 م');
assert.equal(formatTime('15:45', '24'), '15:45');
loaded.reset(); assert.equal(values.has(key), false); assert.equal(values.size, 2, 'reset removes only the preference key');
assert.equal(createPreferences(null).set({ theme: 'dark' }).saved, false);
function luminance(hex) {
  return hex.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}
for (const [foreground, background] of [['163F36', 'F7F4ED'], ['F7F4ED', '10251F'], ['F7F4ED', '1B342B'], ['FFFFFF', '163F36']]) {
  const levels = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  assert.ok((levels[0] + .05) / (levels[1] + .05) >= 4.5, 'normal text contrast in both themes');
}

// Verify actual theme application and the device-theme listener independently of UI controls.
const html = { dataset: {}, style: { setProperty(name, value) { this[name] = value; } } };
const system = { matches: false, addEventListener(_type, listener) { this.listener = listener; } };
const browser = { localStorage: storage, document: { documentElement: html }, matchMedia: () => system, dispatchEvent() {}, addEventListener() {}, CustomEvent: class {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'preferences.js'), 'utf8'), browser);
browser.JAMAL_PREFS.set({ theme: 'system', fontSize: 'large' });
system.matches = true; system.listener(); assert.equal(html.dataset.theme, 'dark');
assert.equal(html.style['--ui-font-size'], '18px'); assert.equal(html.style['--verse-font-size'], '28px');
browser.JAMAL_PREFS.set({ verseSize: 40 }); assert.equal(html.style['--ui-font-size'], '18px'); assert.equal(html.style['--verse-font-size'], '40px');
browser.JAMAL_PREFS.set({ theme: 'light' }); assert.equal(html.dataset.theme, 'light');

async function interfaceFlow() {
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const events = new Map(), frames = [], routes = [];
  class Element {
    constructor(id = '', tagName = 'DIV') { this.id = id; this.tagName = tagName; this.children = []; this.dataset = {}; this.events = {}; this.hidden = false; this.value = ''; this.scrollTop = 0; this.open = false; }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
    toggleAttribute() {}
    addEventListener(type, callback) { this.events[type] = callback; }
    fire(type = 'click') { return this.events[type]?.({ target: this }); }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const elements = new Map([...source.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
  const el = id => elements.get(id);
  const sections = [...source.matchAll(/data-settings-section="([^"]+)"/g)].map(match => { const view = new Element(); view.dataset.settingsSection = match[1]; view.hidden = true; return view; });
  const controls = [...source.matchAll(/<(input|select) data-pref="([^"]+)"([^>]*)>/g)].map(match => { const control = new Element('', match[1].toUpperCase()); control.dataset.pref = match[2]; control.type = /type="([^"]+)"/.exec(match[3])?.[1] || ''; return control; });
  const findControl = name => controls.find(control => control.dataset.pref === name) || el('settings-prayer-alerts').children.map(label => label.children[0]).find(control => control.dataset.pref === name);
  let cleared = 0;
  const service = createPreferences(storage, value => (events.get('jamal:preferenceschange') || []).forEach(callback => callback({ detail: value })));
  const context = {
    JAMAL_PREFS: service, JAMAL_PRAYER_DATA: require('../prayer-data.js'), JAMAL_CHAT_UI: { clearHistory: async () => { cleared++; } },
    ACCOUNT_STATE: { user: null }, lastMain: 'home', navigate: route => routes.push(route),
    document: {
      getElementById: el, createElement: tag => new Element('', tag.toUpperCase()), createElementNS: (_ns, tag) => new Element('', tag),
      querySelectorAll: selector => selector === '[data-settings-section]' ? sections : selector === '[data-pref]' ? [...controls, ...el('settings-prayer-alerts').children.map(label => label.children[0])] : []
    },
    matchMedia: () => ({ matches: true }), requestAnimationFrame: callback => frames.push(callback),
    addEventListener(type, callback) { const current = events.get(type) || []; current.push(callback); events.set(type, current); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'settings.js'), 'utf8'), context);
  assert.equal(el('settings-account-name').textContent, 'أنت تتصفح كضيف'); assert.equal(el('settings-logout').hidden, true);
  el('settings-login').fire(); assert.equal(routes.at(-1), 'login');
  const row = section => el('settings-groups').children.flatMap(group => group.children).find(button => button.dataset.settingsOpen === section);
  for (const section of sections) {
    el('settings-page').scrollTop = 380;
    row(section.dataset.settingsSection).fire();
    assert.equal(section.hidden, false);
    el('settings-back').fire(); frames.splice(0).forEach(callback => callback());
    assert.equal(el('settings-page').scrollTop, 380);
  }
  row('appearance').fire(); findControl('theme').value = 'dark'; findControl('theme').fire('change');
  assert.equal(createPreferences(storage).get().theme, 'dark', 'UI setting survives reload');
  row('privacy').fire();
  findControl('saveChats').checked = false; findControl('saveChats').fire('change'); assert.equal(service.get().saveChats, false);
  el('settings-clear-chats').fire(); assert.equal(cleared, 0); assert.equal(el('settings-confirm').open, true);
  el('settings-confirm-cancel').fire(); assert.equal(cleared, 0);
  el('settings-clear-chats').fire(); await el('settings-confirm-yes').fire(); assert.equal(cleared, 1);
  context.JAMAL_CHAT_UI.clearHistory = async () => { throw Error('unavailable'); };
  el('settings-clear-chats').fire(); await el('settings-confirm-yes').fire();
  assert.match(el('settings-status').textContent, /تعذّر مسح/);
  el('settings-reset').fire(); el('settings-confirm-cancel').fire(); assert.equal(service.get().theme, 'dark');
  el('settings-reset').fire(); await el('settings-confirm-yes').fire(); assert.equal(service.get().theme, 'light');
  assert.equal(values.get('unrelated-site-data'), 'keep'); assert.equal(values.get('jamal-aldin:prayers:2026-11-19'), 'keep');
  el('settings-delete-account').fire(); assert.equal(el('settings-confirm-yes').disabled, true, 'no fake account deletion');
  assert.ok(!/Notification\.requestPermission|geolocation|fetch\(|localStorage\.clear/.test(fs.readFileSync(path.join(root, 'settings.js'), 'utf8')));
}
interfaceFlow().then(() => console.log('PASS: preference persistence/validation/reset isolation, theme/device changes, separate UI/verse sizes, 12h format, all settings sections/back, guest access, confirmations, unavailable account deletion.')).catch(error => { console.error(error); process.exitCode = 1; });
