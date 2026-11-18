'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createTracker, localDay, prefix } = require('../prayer.js');
const data = require('../prayer-data.js');
const root = path.join(__dirname, '..');
const values = new Map();
const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
let date = new Date(2026, 10, 19, 23, 59);
let tracker = createTracker({ storage, now: () => date });
assert.equal(localDay(date), '2026-11-19');
assert.equal(tracker.sync().completed.length, 0);
for (const prayer of data.prayers) tracker.toggle(prayer.key);
assert.equal(tracker.sync().completed.length, 5);
assert.equal(tracker.toggle('asr').completed.length, 4);
tracker = createTracker({ storage, now: () => date });
assert.equal(tracker.sync().completed.length, 4, 'reload restores today');
date = new Date(2026, 10, 20, 0, 0);
assert.equal(tracker.sync().completed.length, 0, 'new local day starts empty');
assert.equal(tracker.toggle('asr').completed.length, 1);
assert.equal(JSON.parse(values.get(prefix + '2026-11-19')).completed.length, 4, 'yesterday is separate');
assert.equal(tracker.toggle('sunrise').completed.length, 1, 'only five obligatory prayers');
values.set(prefix + '2026-11-20', '{broken');
assert.equal(tracker.sync(true).completed.length, 0);
values.set(prefix + '2026-11-20', JSON.stringify({ completed: ['asr', 'asr', 'sunrise'] }));
assert.deepEqual(tracker.sync(true).completed, ['asr']);
const blocked = createTracker({ storage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
assert.equal(blocked.toggle('fajr').canSave, false);
assert.deepEqual(blocked.sync().completed, ['fajr']);

// Run the actual navigation and prayer event handlers together in an isolated DOM.
function mount(sharedStorage = storage) {
  let focused;
  const events = new Map();
  const frames = [];
  const timers = new Map();
  const clock = { time: Date.now() };
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock.time])); } }
  class Element {
    constructor(id = '') { this.id = id; this.hidden = false; this.dataset = {}; this.attributes = {}; this.children = []; this.events = {}; this.scrollTop = 0; this.inert = false; this.classList = { toggle() {}, add() {}, remove() {} }; }
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    toggleAttribute(key, value) { if (value) this.setAttribute(key, ''); else this.removeAttribute(key); }
    addEventListener(type, callback) { this.events[type] = callback; }
    focus() { focused = this; }
    fire(type = 'click') { this.events[type]?.({ target: this, currentTarget: this }); }
    querySelector() { return this.heading || this.time; }
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
  const el = id => elements.get(id);
  el('internal-shell').hidden = true;
  el('prayer-qibla').hidden = true;
  el('prayer-qibla').heading = new Element('qibla-heading');
  const nav = ['home', 'quran', 'prayer', 'ai'].map(route => { const button = new Element(); button.dataset.route = route; return button; });
  const aiButtons = ['wudu', 'salah'].map(topic => { const button = new Element(); button.dataset.prayerAi = topic; return button; });
  const homeRows = data.prayers.map(prayer => { const row = new Element(); row.dataset.prayer = prayer.key; row.time = new Element(); return row; });
  let url = new URL('https://example.test/prayer');
  let historyState = null;
  const historyStack = [];
  const context = {
    JAMAL_PRAYER_DATA: data, Intl, Date: ClockDate, Map, Set, URLSearchParams,
    localStorage: sharedStorage,
    document: {
      body: new Element(), hidden: false, getElementById: el,
      querySelectorAll: selector => selector === '[data-prayer]' ? homeRows : selector === '[data-prayer-ai]' ? aiButtons : nav,
      querySelector: selector => selector.includes('page-prayer') ? (el('prayer-qibla').hidden ? el('prayer-title') : el('prayer-qibla').heading) : el('quran-title'),
      createElement: () => new Element(), createElementNS: () => new Element(),
      addEventListener(type, callback) { events.set('document:' + type, callback); }
    },
    get location() { return { pathname: url.pathname, search: url.search, hash: url.hash }; },
    history: {
      get state() { return historyState; },
      pushState(state, _title, href) { historyStack.push({ url, state: historyState }); url = new URL(href, url); historyState = state; },
      back() { const previous = historyStack.pop(); if (previous) { url = previous.url; historyState = previous.state; context.dispatchEvent({ type: 'popstate' }); } }
    },
    addEventListener(type, callback) { const callbacks = events.get(type) || []; callbacks.push(callback); events.set(type, callbacks); },
    dispatchEvent(event) { (events.get(event.type) || []).forEach(callback => callback(event)); },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    matchMedia: () => ({ matches: true }), scrollTo() {},
    requestAnimationFrame: callback => frames.push(callback), cancelAnimationFrame() {},
    setTimeout: callback => { const id = Math.random(); timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id)
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['script.js', 'prayer.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  const flush = () => frames.splice(0).forEach(callback => callback());
  flush();
  return { el, context, nav, aiButtons, homeRows, flush, clock, timers, focused: () => focused };
}
values.clear();
let app = mount();
assert.equal(app.el('tracker-count').textContent, 'أكملت ٠ من ٥ صلوات');
const rows = app.el('prayer-checklist').children;
assert.equal(rows.length, 5);
rows.forEach((row, index) => {
  assert.equal(row.children[1].textContent, app.homeRows[index].time.textContent, 'same fixture as home');
  row.fire();
  assert.equal(row.attributes['aria-pressed'], 'true');
});
assert.equal(app.el('tracker-count').textContent, 'أكملت ٥ من ٥ صلوات');
rows[0].fire();
assert.equal(rows[0].attributes['aria-pressed'], 'false');
assert.equal(app.el('tracker-count').textContent, 'أكملت ٤ من ٥ صلوات');
app = mount();
assert.equal(app.el('tracker-count').textContent, 'أكملت ٤ من ٥ صلوات', 'DOM reload restores counter');
app.el('page-prayer').scrollTop = 632;
app.el('qibla-open').fire();
assert.equal(app.el('prayer-overview').hidden, true);
assert.equal(app.el('prayer-qibla').hidden, false);
assert.equal(app.el('page-prayer').scrollTop, 0);
app.el('qibla-back').fire(); app.flush();
assert.equal(app.el('page-prayer').scrollTop, 632);
assert.equal(app.focused(), app.el('qibla-open'));
for (const [index, topic] of ['wudu', 'salah'].entries()) {
  app.el('page-prayer').scrollTop = 800 + index * 200;
  app.aiButtons[index].fire(); app.flush();
  assert.equal(app.context.location.hash, '#ai?topic=' + topic);
  assert.equal(app.el('internal-shell').dataset.section, 'ai');
  assert.equal(app.nav[3].attributes['aria-current'], 'page');
  assert.equal(app.el('ai-title').textContent, 'جمال');
  assert.equal(app.el('ai-topic-title').textContent, data.topics[topic].title);
  assert.equal(app.el('bottom-nav').hidden, true);
  assert.equal(app.el('ai-topic').textContent, data.topics[topic].prompt);
  app.el('ai-back').fire(); app.flush();
  assert.equal(app.el('page-prayer').scrollTop, 800 + index * 200);
  assert.equal(app.focused(), app.aiButtons[index]);
  assert.equal(app.el('bottom-nav').hidden, false);
}
app.nav[3].fire();
assert.equal(app.el('ai-title').textContent, 'جمال', 'shared chat assistant title');
assert.equal(app.el('ai-context').hidden, true);
for (const navIndex of [0, 1]) {
  app.nav[navIndex].fire(); app.nav[3].fire();
  assert.equal(app.el('bottom-nav').hidden, true);
  app.el('ai-back').fire(); app.flush();
  assert.equal(app.el('internal-shell').dataset.section, navIndex === 0 ? 'home' : 'quran');
  assert.equal(app.el('bottom-nav').hidden, false);
}
assert.equal(app.el('settings-entry').hidden, true, 'preview stays guest');
const today = new Date(app.clock.time);
app.clock.time = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
[...app.timers.values()].at(-1)();
assert.equal(app.el('tracker-count').textContent, 'أكملت ٠ من ٥ صلوات', 'midnight timer resets the displayed day');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /disabled aria-describedby="wudu-video-note"/);
assert.match(html, /disabled aria-describedby="salah-video-note"/);
assert.ok(!html.includes('<iframe'), 'unreviewed videos never embedded');
assert.ok(!/navigator\.geolocation|DeviceOrientationEvent|fetch\(/.test(fs.readFileSync(path.join(root, 'prayer.js'), 'utf8')));
console.log('PASS: five prayer toggles, counter, reload, local-day isolation, invalid/blocked storage, shared times, Qibla return position, both AI topics and return, general AI, guest state, videos safely pending.');
