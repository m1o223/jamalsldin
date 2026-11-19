'use strict';
// Browser-only conversation UI. No request, AI inference, upload or transcription.
(function (root) {
  const core = root.JAMAL_CHAT;
  const el = id => document.getElementById(id);
  const page = el('page-ai');
  const layout = el('chat-layout');
  const scroll = el('chat-scroll');
  const messages = el('chat-messages');
  const input = el('chat-input');
  const composer = el('chat-composer');
  const inputMeasure = el('chat-input-measure');
  const history = el('chat-history');
  const attachmentMenu = el('chat-attachment-menu');
  const drafts = new Map();
  const positions = new Map();
  const messageURLs = new Set();
  const draftURLs = new Set();
  let store;
  let loading;
  let repository;
  let renderedId;
  let entered = false;
  let activation = 0;
  let timer;
  let viewportFrame;
  let inputFocused = false;
  let stickDuringComposer = false;
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const reduceMotion = () => root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nearBottom = () => scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 96;
  const currentDraft = () => {
    const id = store.active().id;
    if (!drafts.has(id)) drafts.set(id, { text: '', attachments: [] });
    return drafts.get(id);
  };
  function feedback(text = '') {
    el('chat-feedback').textContent = text;
    el('chat-feedback').hidden = !text;
  }
  function revoke(urls) { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); }
  function localURL(blob, urls) {
    const url = URL.createObjectURL(blob);
    urls.add(url);
    return url;
  }
  function pauseAudio(container) { container.querySelectorAll('audio').forEach(audio => audio.pause()); }
  function updateControls() {
    const pending = voice.phase() !== 'idle';
    const ready = Boolean(store?.active());
    const draft = ready ? currentDraft() : { attachments: [] };
    el('chat-send').disabled = !ready || pending || (!input.value.trim() && !draft.attachments.length);
    el('chat-send').setAttribute('aria-label', !input.value.trim() && draft.attachments.some(item => item.kind === 'audio') ? 'إرسال الرسالة الصوتية محلياً' : 'إرسال الرسالة محلياً');
    el('chat-mic').disabled = !ready || pending || draft.attachments.some(item => item.kind === 'audio');
    el('chat-plus').disabled = !ready || pending;
    input.readOnly = pending || !ready;
  }
  function bottom(smooth = false) {
    scroll.scrollTo({ top: scroll.scrollHeight, behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
    el('chat-latest').hidden = true;
  }
  function resizeInput(preserveBottom = true) {
    const pinned = preserveBottom && nearBottom();
    const expanded = inputFocused || input.value.length > 0;
    const visibleHeight = root.visualViewport?.height || root.innerHeight;
    const headerHeight = el('ai-title').parentElement?.offsetHeight || 64;
    // Leave room for the button row, footer notice and conversation on short screens.
    const max = Math.max(26, Math.min(144, visibleHeight * .24, visibleHeight - headerHeight - 152));
    inputMeasure.style.width = `${Math.max(1, (composer.clientWidth || layout.clientWidth || 300) - 36)}px`;
    inputMeasure.textContent = input.value + '\u200b';
    const textHeight = expanded ? Math.min(max, Math.max(Math.min(48, max), inputMeasure.scrollHeight)) : 26;
    const height = expanded ? textHeight + 72 : 60;
    if (composer.style.height !== `${height}px`) stickDuringComposer = pinned && !reduceMotion();
    composer.classList.toggle('is-expanded', expanded);
    composer.style.height = `${height}px`;
    input.style.height = `${textHeight}px`;
    input.style.overflowY = inputMeasure.scrollHeight > textHeight ? 'auto' : 'hidden';
    if (pinned) bottom();
  }
  function saveDraft() {
    if (!store || !renderedId) return;
    const draft = drafts.get(renderedId);
    if (draft) draft.text = input.value;
    positions.set(renderedId, scroll.scrollTop);
  }
  function renderAttachment(item, urls) {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-attachment chat-attachment--${item.kind}`;
    if (item.kind === 'image') {
      const image = document.createElement('img');
      image.src = localURL(item.blob, urls);
      image.alt = item.name;
      image.width = 180; image.height = 128;
      image.onerror = () => { image.hidden = true; };
      wrapper.append(image);
    }
    if (item.kind === 'audio') {
      const label = document.createElement('span');
      label.textContent = 'رسالة صوتية محلية';
      const audio = document.createElement('audio');
      audio.controls = true; audio.preload = 'metadata';
      audio.setAttribute('aria-label', 'تشغيل التسجيل الصوتي المحلي');
      audio.src = localURL(item.blob, urls);
      audio.onerror = () => feedback('تعذّر تشغيل هذا التسجيل في المتصفح الحالي.');
      wrapper.append(label, audio);
    } else {
      const name = document.createElement('span');
      name.className = 'chat-attachment-name';
      name.textContent = item.name;
      const size = document.createElement('bdi');
      size.className = 'chat-attachment-size';
      size.textContent = `${Math.max(1, Math.round(item.blob.size / 1024))} KB`;
      wrapper.append(name, size);
    }
    return wrapper;
  }
  function renderDrafts() {
    pauseAudio(el('chat-drafts'));
    revoke(draftURLs);
    el('chat-drafts').replaceChildren();
    const draft = currentDraft();
    el('chat-drafts').hidden = !draft.attachments.length;
    draft.attachments.forEach(item => {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-draft-item';
      wrapper.append(renderAttachment(item, draftURLs));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'chat-remove';
      remove.textContent = 'حذف';
      remove.setAttribute('aria-label', `حذف ${item.kind === 'audio' ? 'التسجيل الصوتي' : item.name}`);
      remove.addEventListener('click', () => {
        draft.attachments = draft.attachments.filter(attachment => attachment.id !== item.id);
        renderDrafts();
        el(item.kind === 'audio' ? 'chat-mic' : 'chat-plus').focus({ preventScroll: true });
      });
      wrapper.append(remove);
      el('chat-drafts').append(wrapper);
    });
    updateControls();
  }
  function appendMessage(message, animate = false) {
    const bubble = document.createElement('article');
    bubble.className = 'chat-message chat-message--user';
    bubble.setAttribute('aria-label', 'رسالة منك');
    if (message.text) {
      const text = document.createElement('p');
      text.dir = 'auto'; text.textContent = message.text;
      bubble.append(text);
    }
    message.attachments.forEach(item => bubble.append(renderAttachment(item, messageURLs)));
    messages.append(bubble);
    if (animate && !reduceMotion() && bubble.animate) bubble.animate([{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
  }
  function renderThread() {
    pauseAudio(layout);
    revoke(messageURLs);
    messages.setAttribute('aria-live', 'off');
    messages.replaceChildren();
    const thread = store.active();
    renderedId = thread.id;
    thread.messages.forEach(message => appendMessage(message));
    const topic = root.JAMAL_PRAYER_DATA.topics[thread.topic];
    el('ai-context').hidden = !topic;
    el('ai-topic-title').textContent = topic?.title || '';
    el('ai-topic').textContent = topic?.prompt || '';
    el('chat-welcome').hidden = thread.messages.length > 0;
    input.value = currentDraft().text;
    renderDrafts();
    resizeInput();
    scroll.scrollTop = positions.get(thread.id) ?? scroll.scrollHeight;
    el('chat-latest').hidden = true;
    requestAnimationFrame(() => messages.setAttribute('aria-live', 'polite'));
    updateControls();
    renderPrivacyNote();
  }
  function renderPrivacyNote() {
    const saving = root.JAMAL_PREFS?.get().saveChats !== false;
    el('chat-local-note').textContent = !saving ? 'الحفظ متوقف. الرسائل الجديدة لهذه الجلسة فقط، والسجل السابق باقٍ.' : store?.isTemporary() ? 'هذه المحادثة مؤقتة لهذه الجلسة. ابدأ محادثة جديدة لحفظ الرسائل.' : 'محفوظة على هذا الجهاز فقط';
  }
  function newStore() {
    return core.createChatStore({ repository, makeId, canPersist: () => root.JAMAL_PREFS?.get().saveChats !== false, onWarning: () => feedback('تعذّر حفظ التحديث على الجهاز. تبقى المحادثة متاحة خلال هذه الجلسة.') });
  }
  async function initialize() {
    if (loading) return loading;
    loading = (async () => {
      try { repository = await core.openRepository(root.indexedDB); }
      catch { feedback('الحفظ المحلي غير متاح. ستبقى المحادثات والمرفقات خلال هذه الجلسة فقط.'); }
      store = newStore();
      await store.load();
    })();
    return loading;
  }
  function closeAttachments() {
    attachmentMenu.hidden = true;
    el('chat-plus').setAttribute('aria-expanded', 'false');
  }
  function renderHistory() {
    el('chat-history-list').replaceChildren();
    store.list().filter(thread => thread.messages.length || thread.id === store.active().id).forEach(thread => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-history-item';
      button.textContent = thread.title;
      if (thread.id === store.active().id) button.setAttribute('aria-current', 'true');
      button.addEventListener('click', () => {
        voice.cancel(); saveDraft();
        store.select(thread.id); renderThread(); history.close();
        el('ai-title').focus({ preventScroll: true });
      });
      el('chat-history-list').append(button);
    });
  }
  el('chat-menu').addEventListener('click', async () => {
    await initialize();
    if (!entered) return;
    input.blur(); closeAttachments(); renderHistory();
    history.showModal();
    if (!reduceMotion() && history.animate) history.animate([{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 180, easing: 'ease-out' });
  });
  el('chat-history-close').addEventListener('click', () => history.close());
  history.addEventListener('click', event => { if (event.target === history) history.close(); });
  el('chat-new').addEventListener('click', () => {
    voice.cancel(); saveDraft(); store.create(); renderThread(); history.close();
    el('ai-title').focus({ preventScroll: true });
  });
  el('chat-plus').addEventListener('click', () => {
    attachmentMenu.hidden = !attachmentMenu.hidden;
    el('chat-plus').setAttribute('aria-expanded', String(!attachmentMenu.hidden));
    if (!attachmentMenu.hidden) el('chat-add-image').focus();
  });
  document.addEventListener('pointerdown', event => {
    if (!attachmentMenu.contains(event.target) && !el('chat-plus').contains(event.target)) closeAttachments();
  });
  layout.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !attachmentMenu.hidden) { closeAttachments(); el('chat-plus').focus(); }
  });
  [['chat-add-image', 'chat-image-input'], ['chat-add-file', 'chat-file-input']].forEach(([button, picker]) => {
    el(button).addEventListener('click', () => { closeAttachments(); el(picker).click(); });
    el(picker).addEventListener('change', () => {
      if (!store || !entered) { el(picker).value = ''; return; }
      const draft = currentDraft();
      for (const file of el(picker).files) {
        const total = draft.attachments.reduce((sum, item) => sum + item.blob.size, 0);
        if (draft.attachments.length >= 5 || file.size > 20 * 1024 * 1024 || total + file.size > 30 * 1024 * 1024) {
          feedback('يمكن إضافة حتى ٥ مرفقات، بحد ٢٠ ميغابايت للملف و٣٠ ميغابايت للمرفقات معاً.');
          continue;
        }
        if (picker === 'chat-image-input' && !file.type.startsWith('image/')) { feedback('اختر ملف صورة لإضافته كصورة.'); continue; }
        draft.attachments.push({ id: makeId(), name: file.name, kind: file.type.startsWith('image/') ? 'image' : 'file', blob: file });
      }
      el(picker).value = ''; renderDrafts(); el('chat-plus').focus({ preventScroll: true });
    });
  });
  input.addEventListener('input', () => {
    if (store?.active()) currentDraft().text = input.value;
    resizeInput(); updateControls();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); el('chat-composer').requestSubmit(); }
  });
  el('chat-composer').addEventListener('submit', event => {
    event.preventDefault();
    if (!store?.active() || voice.phase() !== 'idle') return;
    const pinned = nearBottom();
    const draft = currentDraft();
    const message = store.send(input.value, draft.attachments);
    if (!message) return;
    input.value = ''; draft.text = ''; draft.attachments = [];
    el('chat-welcome').hidden = true;
    appendMessage(message, true);
    renderDrafts(); resizeInput(false);
    if (pinned) bottom(true);
    else el('chat-latest').hidden = false;
  });
  scroll.addEventListener('scroll', () => { if (nearBottom()) el('chat-latest').hidden = true; });
  ['wheel', 'touchstart', 'pointerdown'].forEach(type => scroll.addEventListener(type, () => { stickDuringComposer = false; }));
  composer.addEventListener('transitionend', event => {
    if (event.target === composer && event.propertyName === 'height') {
      if (stickDuringComposer) bottom();
      stickDuringComposer = false;
    }
  });
  el('chat-latest').addEventListener('click', () => bottom(true));
  function durationText(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  const voice = core.createVoiceRecorder({
    getUserMedia: root.navigator.mediaDevices?.getUserMedia?.bind(root.navigator.mediaDevices), Recorder: root.MediaRecorder,
    onState: phase => {
      clearInterval(timer);
      layout.classList.toggle('is-recording', phase !== 'idle');
      el('chat-recording').hidden = phase === 'idle';
      el('chat-recording-label').textContent = phase === 'requesting' ? 'بانتظار إذن الميكروفون' : phase === 'stopping' ? 'جارٍ تجهيز المعاينة' : 'جارٍ التسجيل';
      el('chat-recording-stop').disabled = phase !== 'recording';
      el('chat-recording-stop').hidden = phase !== 'recording';
      el('chat-recording-time').textContent = '00:00';
      if (phase === 'recording') timer = setInterval(() => {
        el('chat-recording-time').textContent = durationText(voice.elapsed());
        if (voice.elapsed() >= 5 * 60 * 1000) { voice.stop(); feedback('توقّف التسجيل بعد خمس دقائق. راجعه قبل الإرسال.'); }
      }, 250);
      updateControls();
    },
    onReady: ({ blob, duration }) => {
      if (!entered) return;
      const draft = currentDraft();
      if (draft.attachments.length >= 5 || draft.attachments.reduce((sum, item) => sum + item.blob.size, blob.size) > 30 * 1024 * 1024) { feedback('لا توجد مساحة كافية ضمن مرفقات الرسالة. احذف مرفقاً ثم أعد التسجيل.'); return; }
      draft.attachments.push({ id: makeId(), name: 'تسجيل صوتي', kind: 'audio', blob, duration });
      renderDrafts(); feedback('التسجيل جاهز للمعاينة. لم يُرسل بعد.');
    }, onError: feedback
  });
  el('chat-mic').addEventListener('click', () => { closeAttachments(); feedback(); voice.start(); });
  el('chat-recording-stop').addEventListener('click', voice.stop);
  el('chat-recording-cancel').addEventListener('click', voice.cancel);
  function viewport() {
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(() => {
      if (!entered) return;
      const pinned = nearBottom();
      const view = root.visualViewport;
      layout.style.setProperty('--chat-height', `${view?.height || root.innerHeight}px`);
      layout.style.setProperty('--chat-offset', `${view?.offsetTop || 0}px`);
      layout.classList.toggle('is-keyboard-open', root.innerHeight - (view?.height || root.innerHeight) > 120);
      const previousHeight = composer.style.height;
      resizeInput(false);
      if (pinned && composer.style.height !== previousHeight) stickDuringComposer = !reduceMotion();
      if (pinned) bottom();
    });
  }
  root.visualViewport?.addEventListener('resize', viewport);
  root.visualViewport?.addEventListener('scroll', viewport);
  root.addEventListener('resize', viewport);
  root.addEventListener('pageshow', viewport);
  input.addEventListener('focus', () => { inputFocused = true; resizeInput(); viewport(); });
  input.addEventListener('blur', () => { inputFocused = false; resizeInput(); });
  if (root.ResizeObserver) new ResizeObserver(() => {
    layout.style.setProperty('--chat-footer-height', `${el('chat-footer').offsetHeight}px`);
    if (stickDuringComposer) bottom();
  }).observe(el('chat-footer'));
  async function enter(topic) {
    const token = ++activation;
    entered = true; viewport();
    await initialize();
    if (token !== activation || !entered) return;
    if (topic) {
      const thread = store.list().find(item => item.topic === topic);
      if (thread) { saveDraft(); store.select(thread.id); }
      else { saveDraft(); store.create(topic, root.JAMAL_PRAYER_DATA.topics[topic].title); }
      const draft = currentDraft();
      if (!store.active().messages.length && !draft.text) draft.text = root.JAMAL_PRAYER_DATA.topics[topic].prompt;
    }
    if (renderedId !== store.active().id) renderThread();
    else {
      input.value = currentDraft().text;
      resizeInput();
      const context = root.JAMAL_PRAYER_DATA.topics[store.active().topic];
      el('ai-context').hidden = !context;
      el('ai-topic-title').textContent = context?.title || '';
      el('ai-topic').textContent = context?.prompt || '';
      updateControls();
    }
  }
  function leave() {
    entered = false; activation++;
    inputFocused = false; resizeInput(false);
    voice.cancel(); saveDraft(); pauseAudio(layout); closeAttachments();
    if (history.open) history.close();
  }
  root.addEventListener('jamal:routechange', event => {
    if (event.detail.route === 'ai') enter(event.detail.topic);
    else leave();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { voice.cancel(); pauseAudio(layout); } });
  root.addEventListener('pagehide', () => { voice.cancel(); saveDraft(); pauseAudio(layout); });
  root.addEventListener('jamal:preferenceschange', () => { renderPrivacyNote(); if (entered) resizeInput(); });
  Object.defineProperty(root, 'JAMAL_CHAT_UI', { value: {
    async clearHistory() {
      voice.cancel();
      if (loading) await loading;
      if (store) await store.flush();
      if (!repository) repository = await core.openRepository(root.indexedDB);
      await repository.clear();
      pauseAudio(layout); revoke(messageURLs); revoke(draftURLs);
      drafts.clear(); positions.clear(); messages.replaceChildren(); el('chat-drafts').replaceChildren();
      input.value = ''; renderedId = null;
      store = newStore(); await store.load(); loading = Promise.resolve();
      renderThread();
    }
  } });
  updateControls();
  if (getRoute() === 'ai') enter(getAITopic());
})(globalThis);
