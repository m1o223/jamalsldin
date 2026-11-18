'use strict';
(function (root) {
  function openRepository(indexedDB) {
    return new Promise((resolve, reject) => {
      if (!indexedDB) return reject(new Error('Local storage unavailable'));
      const request = indexedDB.open('jamal-local-chat', 1);
      let abandoned = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('threads', { keyPath: 'id' });
        db.createObjectStore('meta');
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { abandoned = true; reject(new Error('Database blocked')); };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) { db.close(); return; }
        db.onversionchange = () => db.close();
        function transaction(store, mode, operation) {
          return new Promise((done, fail) => {
            const tx = db.transaction(store, mode);
            const result = operation(tx.objectStore(store));
            tx.oncomplete = () => done(result.result);
            tx.onerror = tx.onabort = () => fail(tx.error || new Error('Storage failed'));
          });
        }
        resolve({
          list: () => transaction('threads', 'readonly', store => store.getAll()),
          save: thread => transaction('threads', 'readwrite', store => store.put(thread)),
          active: () => transaction('meta', 'readonly', store => store.get('active')),
          select: id => transaction('meta', 'readwrite', store => store.put(id, 'active'))
        });
      };
    });
  }
  function createChatStore({ repository = null, makeId, now = () => Date.now(), onWarning = () => {} }) {
    const threads = new Map();
    let activeId = null;
    let queue = Promise.resolve();
    const id = makeId || (() => root.crypto.randomUUID());
    function persist(thread) {
      if (!repository) return;
      // Snapshot before queuing: later sends/switches cannot overwrite an older transaction.
      const snapshot = { ...thread, messages: thread.messages.map(message => ({ ...message, attachments: message.attachments.map(item => ({ ...item })) })) };
      queue = queue.then(() => repository.save(snapshot)).catch(onWarning);
    }
    function select(threadId) {
      if (!threads.has(threadId)) return null;
      activeId = threadId;
      if (repository) queue = queue.then(() => repository.select(threadId)).catch(onWarning);
      return threads.get(activeId);
    }
    function create(topic = null, title = 'محادثة جديدة') {
      const thread = { id: id(), title, topic, createdAt: now(), updatedAt: now(), messages: [] };
      threads.set(thread.id, thread);
      persist(thread);
      select(thread.id);
      return thread;
    }
    async function load() {
      if (repository) {
        try {
          const records = await repository.list();
          records.forEach(record => {
            if (!record || typeof record.id !== 'string' || !Array.isArray(record.messages)) return;
            const messages = record.messages.filter(message => message?.role === 'user' && typeof message.id === 'string').map(message => ({
              id: message.id, role: 'user', text: typeof message.text === 'string' ? message.text : '',
              createdAt: Number(message.createdAt) || 0,
              attachments: Array.isArray(message.attachments) ? message.attachments.filter(item => item?.blob instanceof root.Blob && ['image', 'file', 'audio'].includes(item.kind)).map(item => ({
                id: String(item.id), kind: item.kind, name: String(item.name || 'مرفق'), blob: item.blob,
                duration: Number(item.duration) || 0
              })) : []
            }));
            threads.set(record.id, { id: record.id, title: typeof record.title === 'string' ? record.title : 'محادثة محلية', topic: ['wudu', 'salah'].includes(record.topic) ? record.topic : null, createdAt: Number(record.createdAt) || 0, updatedAt: Number(record.updatedAt) || 0, messages });
          });
          activeId = await repository.active();
        } catch (error) { onWarning(error); }
      }
      if (!threads.has(activeId)) activeId = [...threads.values()].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id || null;
      return activeId ? threads.get(activeId) : create();
    }
    function send(text, attachments = []) {
      text = text.trim();
      if (!text && !attachments.length) return null;
      const thread = threads.get(activeId);
      const message = { id: id(), role: 'user', text, attachments: attachments.map(item => ({ ...item })), createdAt: now() };
      thread.messages.push(message);
      thread.updatedAt = now();
      if (thread.messages.length === 1 && !thread.topic) thread.title = text.slice(0, 52) || (attachments.some(item => item.kind === 'audio') ? 'رسالة صوتية' : 'مرفقات');
      persist(thread);
      return message;
    }
    return { load, create, select, send, active: () => threads.get(activeId), list: () => [...threads.values()].sort((a, b) => b.updatedAt - a.updatedAt), flush: () => queue };
  }
  function createVoiceRecorder({ getUserMedia, Recorder, BlobType = root.Blob, now = () => Date.now(), onState = () => {}, onReady = () => {}, onError = () => {} }) {
    let generation = 0;
    let stream;
    let recorder;
    let phase = 'idle';
    let started = 0;
    const stopTracks = target => target?.getTracks().forEach(track => track.stop());
    function cancel() {
      generation++;
      const previous = recorder;
      recorder = null;
      if (previous && previous.state !== 'inactive') { try { previous.stop(); } catch {} }
      stopTracks(stream); stream = null;
      phase = 'idle'; onState(phase);
    }
    function fail(error) {
      cancel();
      const message = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
        ? 'لم يُسمح باستخدام الميكروفون. يمكنك متابعة الكتابة أو السماح به من إعدادات المتصفح.'
        : error?.name === 'NotFoundError' ? 'لم يتم العثور على ميكروفون. يمكنك متابعة الكتابة.'
          : 'تعذّر تسجيل الصوت في هذا المتصفح. يمكنك متابعة الكتابة.';
      onError(message);
    }
    async function start() {
      if (phase !== 'idle') return;
      if (!getUserMedia || !Recorder) { onError('تسجيل الصوت غير مدعوم في هذا المتصفح. يمكنك متابعة الكتابة.'); return; }
      const token = ++generation;
      phase = 'requesting'; onState(phase);
      try {
        const granted = await getUserMedia({ audio: true });
        if (token !== generation) { stopTracks(granted); return; }
        stream = granted;
        const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(type => Recorder.isTypeSupported?.(type));
        try { recorder = new Recorder(stream, mime ? { mimeType: mime } : undefined); }
        catch { recorder = new Recorder(stream); }
        const current = recorder;
        const chunks = [];
        let duration = 0;
        current.ondataavailable = event => { if (token === generation && event.data?.size) chunks.push(event.data); };
        current.onerror = event => { if (token === generation) fail(event.error); };
        current.onstop = () => {
          stopTracks(granted);
          if (token !== generation) return;
          duration ||= Math.max(0, now() - started);
          stream = null; recorder = null; phase = 'idle'; onState(phase);
          const blob = new BlobType(chunks, { type: current.mimeType || chunks[0]?.type || '' });
          if (blob.size) onReady({ blob, duration });
          else onError('لم يتم التقاط صوت. يمكنك المحاولة مرة أخرى أو متابعة الكتابة.');
        };
        current.start(1000);
        started = now();
        phase = 'recording'; onState(phase);
        current.finishDuration = () => { duration = Math.max(0, now() - started); };
      } catch (error) { if (token === generation) fail(error); }
    }
    function stop() {
      if (phase !== 'recording') return;
      recorder.finishDuration();
      phase = 'stopping'; onState(phase);
      try { recorder.stop(); stopTracks(stream); }
      catch (error) { fail(error); }
    }
    return { start, stop, cancel, phase: () => phase, elapsed: () => phase === 'recording' ? Math.max(0, now() - started) : 0 };
  }
  const api = { openRepository, createChatStore, createVoiceRecorder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.defineProperty(root, 'JAMAL_CHAT', { value: api });
})(globalThis);
