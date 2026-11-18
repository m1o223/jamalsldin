'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const index = require('../quran-data.js');
const { matches } = require('../quran.js');
assert.equal(index.length, 114);
assert.deepEqual(index.map(surah => surah.id), Array.from({ length: 114 }, (_, i) => i + 1));
assert.equal(index.reduce((sum, surah) => sum + surah.verses, 0), 6236);
assert.deepEqual(index[0], { id: 1, name: 'الفاتحة', verses: 7 });
assert.deepEqual(index[1], { id: 2, name: 'البقرة', verses: 286 });
assert.deepEqual(index[113], { id: 114, name: 'الناس', verses: 6 });
const find = query => index.filter(surah => matches(surah, query)).map(surah => surah.id);
assert.deepEqual(find('الْفَاتِحَة'), [1]);
assert.deepEqual(find('الــبقرة'), [2]);
assert.deepEqual(find('الاسراء'), [17]);
assert.deepEqual(find('آل عمران'), [3]);
assert.deepEqual(find('١١٤'), [114]);
assert.deepEqual(find('۱۱۴'), [114]);
assert.deepEqual(find('002'), [2]);
assert.deepEqual(find('115'), []);
assert.deepEqual(find('غير موجودة'), []);
assert.equal(find('').length, 114);

// Exercise actual browser event handlers in a small DOM harness, without a network or storage API.
let focused;
class Element {
  constructor(id = '') {
    this.id = id; this.hidden = false; this.value = ''; this.dataset = {};
    this.children = []; this.attributes = {}; this.events = {}; this.scrollTop = 0;
    this.classList = { add() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { this.events[type] = callback; }
  focus() { focused = this; }
  closest() { return this; }
  querySelector() { return this.heading; }
  fire(type, extra = {}) { this.events[type]?.({ target: this, currentTarget: this, ...extra }); }
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
const el = id => elements.get(id);
const tabs = [el('quran-reading-tab'), el('quran-learning-tab')];
const tabbar = new Element();
for (const [view, heading] of [['index', 'quran-title'], ['reader', 'surah-title'], ['bookmarks', 'bookmarks-heading']]) {
  el(`quran-${view}-view`).heading = el(heading) || new Element(heading);
}
el('quran-search').hidden = true;
el('quran-reader-view').hidden = true;
el('quran-bookmarks-view').hidden = true;
const frames = [];
vm.runInNewContext(fs.readFileSync(path.join(root, 'quran.js'), 'utf8'), {
  JAMAL_SURAH_INDEX: index, Intl, Map,
  document: {
    getElementById: el,
    querySelectorAll: () => tabs,
    querySelector: () => tabbar,
    createElement: () => new Element(),
    createElementNS: () => new Element()
  },
  matchMedia: () => ({ matches: true }),
  requestAnimationFrame: callback => frames.push(callback)
});
const rows = el('surah-list').children;
const visible = () => rows.filter(row => !row.hidden);
assert.equal(rows.length, 114);
el('quran-search-toggle').fire('click');
assert.equal(el('quran-search').hidden, false);
el('surah-search').value = 'الْبَقَرَة';
el('surah-search').fire('input');
assert.equal(visible().length, 1);
assert.equal(visible()[0].children[0].dataset.surah, '2');
el('page-quran').scrollTop = 784;
const card = rows[1].children[0];
el('surah-list').fire('click', { target: card });
assert.equal(el('quran-index-view').hidden, true);
assert.equal(el('quran-reader-view').hidden, false);
assert.equal(el('surah-title').textContent, 'البقرة');
assert.equal(el('page-quran').scrollTop, 0);
el('surah-back').fire('click');
frames.splice(0).forEach(callback => callback());
assert.equal(el('page-quran').scrollTop, 784);
assert.equal(el('surah-search').value, 'الْبَقَرَة');
assert.equal(focused, card);
el('quran-bookmarks-toggle').fire('click');
assert.equal(el('quran-bookmarks-view').hidden, false);
el('bookmarks-back').fire('click');
frames.splice(0).forEach(callback => callback());
assert.equal(el('page-quran').scrollTop, 784);
el('surah-search').value = 'لا توجد سورة بهذا الاسم';
el('surah-search').fire('input');
assert.equal(el('surah-no-results').hidden, false);
el('quran-search-clear').fire('click');
assert.equal(visible().length, 114);
el('quran-search-close').fire('click');
assert.equal(el('quran-search').hidden, true);
assert.equal(el('surah-search').value, '');
tabs[1].fire('click');
assert.equal(el('quran-reading').hidden, true);
assert.equal(el('quran-learning').hidden, false);
tabs[1].fire('keydown', { key: 'ArrowRight', preventDefault() {} });
assert.equal(el('quran-reading').hidden, false);
assert.equal(tabs[0].attributes['aria-selected'], 'true');
// Rapid view changes must invalidate an old pending scroll restoration.
el('surah-list').fire('click', { target: card });
el('surah-back').fire('click');
el('quran-bookmarks-toggle').fire('click');
frames.splice(0).forEach(callback => callback());
assert.equal(el('quran-bookmarks-view').hidden, false);
assert.equal(el('page-quran').scrollTop, 0);
el('bookmarks-back').fire('click');
frames.splice(0).forEach(callback => callback());
tabs[1].fire('click');
el('quran-bookmarks-toggle').fire('click');
el('bookmarks-back').fire('click');
frames.splice(0).forEach(callback => callback());
assert.equal(el('quran-reading').hidden, false);
console.log('PASS: 114-surah metadata, Arabic/name/number search, tabs, empty bookmarks, reader return state, rapid view changes.');
