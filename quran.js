'use strict';
// Local metadata search and presentation only. No verse text, storage or requests.
(function (root) {
  function normalize(value) {
    return String(value).normalize('NFD').replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
      .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).trim();
  }
  function matches(surah, query) {
    const term = normalize(query);
    return !term || (/^\d+$/.test(term) ? surah.id === Number(term) : normalize(surah.name).includes(term));
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalize, matches };
    return;
  }
  const index = root.JAMAL_SURAH_INDEX;
  const byId = new Map(index.map(surah => [surah.id, surah]));
  const page = document.getElementById('page-quran');
  const list = document.getElementById('surah-list');
  const input = document.getElementById('surah-search');
  const search = document.getElementById('quran-search');
  const searchToggle = document.getElementById('quran-search-toggle');
  const tabs = [...document.querySelectorAll('.quran-tabs [role="tab"]')];
  const views = {
    index: document.getElementById('quran-index-view'),
    reader: document.getElementById('quran-reader-view'),
    bookmarks: document.getElementById('quran-bookmarks-view')
  };
  const format = new Intl.NumberFormat('ar', { useGrouping: false });
  let activeView = 'index';
  let savedScroll = 0;
  let returnFocus = null;
  let revision = 0;
  let animation;
  const rows = index.map(surah => {
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'surah-card';
    button.dataset.surah = String(surah.id);
    button.setAttribute('aria-label', `سورة ${surah.name}، ${format.format(surah.verses)} آية`);
    const number = document.createElement('span');
    number.className = 'surah-number';
    number.textContent = format.format(surah.id);
    const copy = document.createElement('span');
    copy.className = 'surah-copy';
    const name = document.createElement('span');
    name.className = 'surah-name';
    name.textContent = surah.name;
    const count = document.createElement('span');
    count.className = 'surah-count';
    count.textContent = `${format.format(surah.verses)} آية`;
    copy.append(name, count);
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', 'currentColor');
    arrow.setAttribute('stroke-width', '1.7');
    arrow.setAttribute('stroke-linecap', 'round');
    arrow.setAttribute('stroke-linejoin', 'round');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.classList.add('surah-arrow');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm14 7-5 5 5 5');
    arrow.append(path);
    button.append(number, copy, arrow);
    row.append(button);
    list.append(row);
    return { surah, row, button };
  });

  function filter() {
    let count = 0;
    rows.forEach(({ surah, row }) => {
      row.hidden = !matches(surah, input.value);
      if (!row.hidden) count++;
    });
    document.getElementById('surah-no-results').hidden = count !== 0;
    document.getElementById('surah-results').textContent = `عدد السور المعروضة: ${format.format(count)}`;
    document.getElementById('quran-search-clear').disabled = !input.value;
  }
  function closeSearch(focus = true) {
    input.value = '';
    filter();
    search.hidden = true;
    searchToggle.setAttribute('aria-expanded', 'false');
    if (focus) searchToggle.focus({ preventScroll: true });
  }
  function selectTab(tab) {
    const reading = tab === tabs[0];
    tabs.forEach(item => {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    });
    document.querySelector('.quran-tabs').dataset.tab = reading ? 'reading' : 'learning';
    document.getElementById('quran-reading').hidden = !reading;
    document.getElementById('quran-learning').hidden = reading;
    if (!reading) closeSearch(false);
  }
  function showView(name) {
    revision++;
    animation?.cancel();
    activeView = name;
    Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; });
    if (!root.matchMedia('(prefers-reduced-motion: reduce)').matches && views[name].animate) {
      animation = views[name].animate(
        [{ opacity: 0.65, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 160, easing: 'ease-out' }
      );
    }
  }
  function openView(name, trigger) {
    savedScroll = page.scrollTop;
    returnFocus = trigger;
    showView(name);
    page.scrollTop = 0;
    views[name].querySelector('[data-view-heading]').focus({ preventScroll: true });
  }
  function backToList() {
    showView('index');
    const expected = revision;
    requestAnimationFrame(() => {
      if (expected !== revision || activeView !== 'index') return;
      page.scrollTop = savedScroll;
      returnFocus?.focus({ preventScroll: true });
    });
  }
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-surah]');
    if (!button) return;
    const surah = byId.get(Number(button.dataset.surah));
    document.getElementById('surah-title').textContent = surah.name;
    document.getElementById('surah-number').textContent = format.format(surah.id);
    document.getElementById('surah-verses').textContent = format.format(surah.verses);
    openView('reader', button);
  });
  document.getElementById('surah-back').addEventListener('click', backToList);
  document.getElementById('bookmarks-back').addEventListener('click', backToList);
  document.getElementById('quran-bookmarks-toggle').addEventListener('click', event => {
    selectTab(tabs[0]);
    openView('bookmarks', event.currentTarget);
  });
  searchToggle.addEventListener('click', () => {
    if (!search.hidden) return closeSearch();
    selectTab(tabs[0]);
    search.hidden = false;
    searchToggle.setAttribute('aria-expanded', 'true');
    input.focus({ preventScroll: true });
  });
  input.addEventListener('input', filter);
  input.addEventListener('keydown', event => { if (event.key === 'Escape') closeSearch(); });
  document.getElementById('quran-search-clear').addEventListener('click', () => {
    input.value = '';
    filter();
    input.focus({ preventScroll: true });
  });
  document.getElementById('quran-search-close').addEventListener('click', () => closeSearch());
  tabs.forEach((tab, position) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - position;
      selectTab(tabs[next]);
      tabs[next].focus({ preventScroll: true });
    });
  });
  filter();
})(globalThis);
