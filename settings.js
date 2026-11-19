'use strict';
(function (root) {
  const el = id => document.getElementById(id);
  const preferences = root.JAMAL_PREFS;
  const page = el('settings-page');
  const index = el('settings-index');
  const details = el('settings-details');
  const dialog = el('settings-confirm');
  const titles = {
    account: 'الملف الشخصي', premium: 'الاشتراك / Premium', notifications: 'الإشعارات', prayer: 'مواقيت الصلاة والموقع', appearance: 'المظهر واللغة', quran: 'إعدادات القرآن', privacy: 'الخصوصية والبيانات', contact: 'التواصل معنا', report: 'الإبلاغ عن مشكلة', about: 'عن Jamal aldin', policy: 'سياسة الخصوصية', terms: 'شروط الاستخدام'
  };
  const paths = {
    account: 'M4 21v-2a8 8 0 0 1 16 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    premium: 'm3 6 4 4 5-7 5 7 4-4-2 14H5L3 6Zm3 10h12',
    notifications: 'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5l-2 4Zm5 3h4',
    prayer: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2m2-11v4h4',
    appearance: 'M12 3a9 9 0 1 0 9 9c-5 2-10-3-9-9Z',
    quran: 'M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z',
    privacy: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-3 9 2 2 4-4',
    contact: 'M3 5h18v14H3V5Zm1 1 8 7 8-7',
    report: 'm12 3 10 18H2L12 3Zm0 6v5m0 3v1',
    about: 'M12 8v1m0 3v5m9-5a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    policy: 'M6 3h9l4 4v14H5V3h1Zm3 7h6m-6 4h6m-6 4h4',
    terms: 'M6 3h12v18H6V3Zm3 5h6m-6 4h6m-6 4h4'
  };
  let current = null;
  let previousScroll = 0;
  let previousButton;
  let revision = 0;
  let animation;
  let confirmation;
  function status(text = '') { el('settings-status').textContent = text; el('settings-status').hidden = !text; }
  function icon(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path'); line.setAttribute('d', path); svg.append(line); return svg;
  }
  function animate(view) {
    animation?.cancel();
    if (!root.matchMedia('(prefers-reduced-motion: reduce)').matches && view.animate) animation = view.animate([{ opacity: .6, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
  }
  function open(section, button) {
    revision++; previousScroll = page.scrollTop; previousButton = button; current = section;
    index.hidden = true; details.hidden = false;
    document.querySelectorAll('[data-settings-section]').forEach(view => { view.hidden = view.dataset.settingsSection !== section; });
    el('settings-title').textContent = titles[section];
    page.scrollTop = 0; animate(details); el('settings-title').focus({ preventScroll: true }); status();
  }
  function back() {
    if (!current) { navigate(lastMain === 'ai' ? 'home' : lastMain); return; }
    current = null; const token = ++revision;
    index.hidden = false; details.hidden = true; el('settings-title').textContent = 'الإعدادات'; animate(index); status();
    requestAnimationFrame(() => { if (token !== revision) return; page.scrollTop = previousScroll; previousButton?.focus({ preventScroll: true }); });
  }
  [['الحساب', ['account', 'premium']], ['تفضيلاتك', ['notifications', 'prayer', 'appearance', 'quran']], ['الخصوصية والمساعدة', ['privacy', 'contact', 'report', 'about', 'policy', 'terms']]].forEach(([title, sections]) => {
    const group = document.createElement('section'); group.className = 'settings-group';
    const heading = document.createElement('h2'); heading.textContent = title; group.append(heading);
    sections.forEach(section => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'settings-row'; button.dataset.settingsOpen = section;
      const label = document.createElement('span'); label.textContent = titles[section];
      button.append(icon(paths[section]), label, icon('m14 7-5 5 5 5'));
      button.addEventListener('click', () => open(section, button)); group.append(button);
    }); el('settings-groups').append(group);
  });
  root.JAMAL_PRAYER_DATA.prayers.forEach(prayer => {
    const label = document.createElement('label'); label.className = 'settings-toggle'; label.textContent = prayer.name;
    const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.pref = 'alert' + prayer.key[0].toUpperCase() + prayer.key.slice(1); label.append(input); el('settings-prayer-alerts').append(label);
  });
  const controls = [...document.querySelectorAll('[data-pref]')];
  function render() {
    const value = preferences.get();
    controls.forEach(control => { if (control.type === 'checkbox') control.checked = value[control.dataset.pref]; else control.value = value[control.dataset.pref]; });
    el('settings-verse-value').textContent = `${value.verseSize}px`;
  }
  controls.forEach(control => control.addEventListener(control.tagName === 'INPUT' && ['text', 'range'].includes(control.type) ? 'input' : 'change', () => {
    const result = preferences.set({ [control.dataset.pref]: control.type === 'checkbox' ? control.checked : control.value });
    if (!result.saved) status('طُبّق التفضيل لهذه الجلسة، لكن تعذّر حفظه على الجهاز.'); else status();
  }));
  root.addEventListener('jamal:preferenceschange', render);
  function renderAccount() {
    const user = ACCOUNT_STATE.user;
    el('settings-account-name').textContent = user?.name || (user ? 'الملف الشخصي' : 'أنت تتصفح كضيف');
    el('settings-account-email').hidden = !user?.email; el('settings-account-email').textContent = user?.email || '';
    el('settings-login').hidden = Boolean(user); el('settings-logout').hidden = !user;
    el('settings-photo').hidden = !user?.avatarUrl;
    el('settings-avatar-icon').toggleAttribute('hidden', Boolean(user?.avatarUrl));
    if (user?.avatarUrl) el('settings-photo').src = user.avatarUrl;
    document.querySelectorAll('[data-settings-login]').forEach(button => { button.hidden = Boolean(user); });
    el('settings-edit-name').value = user?.name || ''; el('settings-edit-email').value = user?.email || '';
  }
  [el('settings-login'), ...document.querySelectorAll('[data-settings-login]')].forEach(button => button.addEventListener('click', () => navigate('login')));
  el('settings-back').addEventListener('click', back);
  function confirm(kind, title, description, disabled = false) {
    confirmation = kind;
    el('settings-confirm-title').textContent = title; el('settings-confirm-description').textContent = description;
    el('settings-confirm-yes').disabled = disabled; el('settings-confirm-yes').textContent = disabled ? 'غير متاح دون خدمة حسابات' : 'تأكيد';
    dialog.showModal(); el('settings-confirm-cancel').focus();
  }
  el('settings-clear-chats').addEventListener('click', () => confirm('chats', 'مسح سجل المحادثات؟', 'سيُحذف سجل محادثات جمال المحلي مع مرفقاته وتسجيلاته ومسوداته على هذا الجهاز. لن تُحذف تفضيلاتك أو متابعة صلواتك، ولن يُحذف أي حساب.'));
  el('settings-reset').addEventListener('click', () => confirm('reset', 'إعادة ضبط التفضيلات؟', 'ستعود تفضيلات المظهر واللغة والمواقيت والقراءة والتنبيهات وحفظ المحادثات إلى قيمها الافتراضية. لن يُحذف سجل المحادثات أو متابعة الصلاة أو بقية بيانات المتصفح.'));
  el('settings-delete-account').addEventListener('click', () => confirm('account', 'حذف الحساب', 'لا توجد خدمة حسابات متصلة لإتمام حذف حساب حقيقي. هذا الإجراء غير متاح حالياً، ومسح البيانات المحلية ليس حذفاً للحساب.', true));
  el('settings-confirm-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  el('settings-confirm-yes').addEventListener('click', async () => {
    const kind = confirmation; if (kind === 'account') return;
    el('settings-confirm-yes').disabled = true;
    try {
      if (kind === 'chats') { await root.JAMAL_CHAT_UI.clearHistory(); status('تم مسح سجل محادثات جمال المحلي على هذا الجهاز.'); }
      else { const result = preferences.reset(); status(result.saved ? 'أُعيدت التفضيلات المحلية إلى القيم الافتراضية.' : 'أُعيدت تفضيلات الجلسة، لكن تعذّر إزالة التفضيلات المحفوظة على الجهاز.'); }
      dialog.close();
    } catch { dialog.close(); status('تعذّر مسح السجل. لم يتم تأكيد حذفه؛ حاول مرة أخرى.'); }
  });
  root.addEventListener('jamal:routechange', event => { if (event.detail.route !== 'settings' && dialog.open) dialog.close(); });
  render(); renderAccount();
})(globalThis);
