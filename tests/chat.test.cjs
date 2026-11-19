'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../chat-core.js');
const rootPath = path.join(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
function repository() {
  const records = new Map();
  let active;
  return { list: async () => structuredClone([...records.values()]), save: async thread => { records.set(thread.id, structuredClone(thread)); }, active: async () => active, select: async id => { active = id; } };
}
class Recorder {
  static instances = [];
  static isTypeSupported(type) { return type === 'audio/mp4'; }
  constructor(stream, options) { this.stream = stream; this.mimeType = options?.mimeType || 'audio/mp4'; this.state = 'inactive'; Recorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['local audio'], { type: this.mimeType }) });
    queueMicrotask(() => this.onstop?.());
  }
}
function stream() { const track = { stopped: false, stop() { this.stopped = true; } }; return { track, getTracks: () => [track] }; }
async function modelAndVoice() {
  const repo = repository();
  let sequence = 0;
  const makeId = () => String(++sequence);
  const store = core.createChatStore({ repository: repo, makeId });
  await store.load();
  assert.equal(store.send('  '), null);
  const first = store.active().id;
  store.send('<script>literal text</script>');
  const attachment = { id: 'image', kind: 'image', name: 'صورة.png', blob: new Blob(['image'], { type: 'image/png' }) };
  store.send('', [attachment]);
  const second = store.create().id;
  store.send('محادثة أخرى');
  await store.flush();
  const restored = core.createChatStore({ repository: repo, makeId });
  await restored.load();
  assert.equal(restored.active().id, second);
  assert.equal(restored.select(first).messages.length, 2);
  assert.equal(restored.active().messages[0].text, '<script>literal text</script>');
  assert.equal(await restored.active().messages[1].attachments[0].blob.text(), 'image');
  assert.ok(restored.list().every(thread => thread.messages.every(message => message.role === 'user')), 'no fake assistant replies');
  let warning = 0;
  const failing = core.createChatStore({ repository: { list: async () => [], active: async () => null, save: async () => { throw Error('quota'); }, select: async () => {} }, makeId, onWarning: () => warning++ });
  await failing.load(); failing.send('يبقى في الذاكرة'); await failing.flush();
  assert.ok(warning > 0); assert.equal(failing.active().messages.length, 1);
  let clock = 1000;
  const ready = [], errors = [], phases = [];
  let device = stream();
  const voice = core.createVoiceRecorder({ getUserMedia: async () => device, Recorder, now: () => clock, onReady: item => ready.push(item), onError: text => errors.push(text), onState: phase => phases.push(phase) });
  await voice.start();
  assert.equal(voice.phase(), 'recording');
  assert.equal(Recorder.instances.at(-1).mimeType, 'audio/mp4', 'codec negotiated for Safari-compatible MP4');
  clock = 3600; voice.stop();
  assert.equal(device.track.stopped, true, 'mic stopped before preview');
  await tick();
  assert.equal(ready.length, 1); assert.equal(ready[0].duration, 2600);
  assert.equal(await ready[0].blob.text(), 'local audio');
  device = stream(); await voice.start(); voice.cancel(); await tick();
  assert.equal(device.track.stopped, true); assert.equal(ready.length, 1, 'cancel never prepares or sends a message');
  let grant;
  const pendingDevice = stream();
  const pending = core.createVoiceRecorder({ getUserMedia: () => new Promise(resolve => { grant = resolve; }), Recorder, onReady: () => assert.fail('cancelled permission request must not produce audio') });
  const permission = pending.start(); pending.cancel(); grant(pendingDevice); await permission;
  assert.equal(pendingDevice.track.stopped, true, 'late permission after leaving is immediately released');
  const denied = core.createVoiceRecorder({ getUserMedia: async () => { throw Object.assign(Error('denied'), { name: 'NotAllowedError' }); }, Recorder, onError: text => errors.push(text) });
  await denied.start(); assert.match(errors.at(-1), /لم يُسمح/);
  const unsupported = core.createVoiceRecorder({ onError: text => errors.push(text) });
  await unsupported.start(); assert.match(errors.at(-1), /غير مدعوم/);
  assert.ok(phases.includes('requesting') && phases.includes('stopping'));
}
async function interfaceFlow() {
  let focused;
  const listeners = new Map(), frames = [];
  class Element {
    constructor(id = '', tagName = '') {
      this.id = id; this.tagName = tagName; this.children = []; this.events = {}; this.hidden = false;
      this.value = ''; this.attributes = {}; this.scrollTop = 0; this.scrollHeight = 26; this.clientHeight = 500;
      this.offsetHeight = 140; this.style = { setProperty(key, value) { this[key] = value; } };
      const classes = new Set();
      this.classList = { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) }; this.open = false;
    }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, callback) { this.events[type] = callback; }
    fire(type = 'click', extra = {}) { return this.events[type]?.({ target: this, currentTarget: this, preventDefault() {}, ...extra }); }
    focus() { focused = this; } blur() {}
    click() { return this.fire(); }
    showModal() { this.open = true; } close() { this.open = false; }
    requestSubmit() { this.fire('submit'); }
    pause() { this.paused = true; }
    contains(target) { return this === target || this.children.some(child => child.contains?.(target)); }
    querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
    scrollTo(options) { this.scrollTop = options.top; }
  }
  const html = fs.readFileSync(path.join(rootPath, 'index.html'), 'utf8');
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
  const el = id => elements.get(id);
  el('chat-scroll').scrollHeight = 1000;
  el('chat-scroll').scrollTop = 500;
  el('chat-attachment-menu').hidden = true;
  let serial = 0;
  const device = stream();
  let route = 'ai';
  const viewport = { height: 700, offsetTop: 0, addEventListener(type, callback) { this[type] = callback; } };
  const context = {
    JAMAL_CHAT: { ...core, openRepository: async () => repository() }, JAMAL_PRAYER_DATA: require('../prayer-data.js'),
    Blob, URL, Date, Intl, Map, Set, crypto: { randomUUID: () => String(++serial) },
    navigator: { mediaDevices: { getUserMedia: async () => device } }, MediaRecorder: Recorder,
    visualViewport: viewport, innerHeight: 700,
    matchMedia: () => ({ matches: true }),
    getRoute: () => route, getAITopic: () => null,
    document: {
      hidden: false, getElementById: el,
      createElement: tag => new Element('', tag), createElementNS: (_namespace, tag) => new Element('', tag),
      addEventListener(type, callback) { listeners.set('document:' + type, callback); }
    },
    addEventListener(type, callback) { listeners.set(type, callback); },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {},
    setInterval: () => 1, clearInterval() {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(rootPath, 'chat.js'), 'utf8'), context);
  const flush = async () => { await tick(); frames.splice(0).forEach(callback => callback()); };
  await flush();
  assert.equal(el('chat-send').disabled, true);
  assert.equal(el('chat-welcome').hidden, false);
  assert.equal(el('chat-composer').style.height, '60px');
  el('chat-input').fire('focus'); await flush();
  assert.equal(el('chat-composer').classList.contains('is-expanded'), true);
  assert.equal(el('chat-composer').style.height, '120px', 'focus expands before typing');
  assert.equal(el('chat-send').disabled, true, 'focus alone cannot enable send');
  el('chat-input').fire('blur');
  assert.equal(el('chat-composer').style.height, '60px', 'empty blur collapses');
  el('chat-input-measure').scrollHeight = 390;
  el('chat-input').value = 'رسالة طويلة\n'.repeat(60); el('chat-input').fire('input');
  assert.equal(el('chat-composer').style.height, '216px');
  assert.equal(el('chat-input').style.overflowY, 'auto');
  el('chat-input').fire('blur');
  assert.equal(el('chat-composer').classList.contains('is-expanded'), true, 'unsent draft stays expanded after blur');
  el('chat-input').value = ''; el('chat-input-measure').scrollHeight = 26; el('chat-input').fire('input');
  assert.equal(el('chat-composer').style.height, '60px');
  el('chat-input').fire('focus');
  el('chat-input').value = 'رسالة محلية'; el('chat-input').fire('input');
  assert.equal(el('chat-send').disabled, false);
  el('chat-composer').fire('submit'); await flush();
  assert.equal(el('chat-welcome').hidden, true);
  assert.equal(el('chat-messages').children.length, 1);
  assert.equal(el('chat-messages').children[0].children[0].textContent, 'رسالة محلية');
  assert.equal(el('chat-send').disabled, true);
  assert.equal(el('chat-input').value, '');
  assert.equal(el('chat-composer').style.height, '120px', 'send with retained focus stays expanded');
  el('chat-input').fire('blur');
  assert.equal(el('chat-composer').style.height, '60px');
  await el('chat-menu').fire();
  assert.equal(el('chat-history').open, true);
  el('chat-new').fire(); await flush();
  assert.equal(el('chat-welcome').hidden, false);
  await el('chat-menu').fire();
  const previous = el('chat-history-list').children.find(button => button.textContent === 'رسالة محلية');
  assert.ok(previous); previous.fire(); await flush();
  assert.equal(el('chat-messages').children.length, 1);
  el('chat-plus').fire(); assert.equal(el('chat-attachment-menu').hidden, false);
  el('chat-file-input').files = [Object.assign(new Blob(['local file'], { type: 'application/pdf' }), { name: 'مرفق.pdf' })];
  el('chat-file-input').fire('change');
  assert.equal(el('chat-drafts').hidden, false);
  assert.equal(el('chat-send').disabled, false, 'attachments can be sent without text');
  const remove = el('chat-drafts').children[0].children[1]; remove.fire();
  assert.equal(el('chat-drafts').hidden, true);
  assert.equal(el('chat-send').disabled, true);
  el('chat-mic').fire(); await flush();
  assert.equal(el('chat-recording').hidden, false);
  el('chat-recording-stop').fire(); await flush();
  assert.equal(device.track.stopped, true);
  assert.equal(el('chat-drafts').children.length, 1, 'audio remains a draft before explicit send');
  assert.equal(el('chat-messages').children.length, 1);
  el('chat-composer').fire('submit'); await flush();
  assert.equal(el('chat-messages').children.length, 2);
  assert.equal(el('chat-composer').style.height, '60px', 'unfocused send leaves an empty capsule');
  assert.equal(el('chat-messages').children[1].children[0].children[1].tagName, 'audio');
  el('chat-scroll').scrollTop = 100;
  el('chat-input').value = 'قراءة رسائل قديمة'; el('chat-input').fire('input');
  el('chat-composer').fire('submit'); await flush();
  assert.equal(el('chat-scroll').scrollTop, 100, 'send does not pull reader to bottom');
  assert.equal(el('chat-latest').hidden, false);
  viewport.height = 380; viewport.offsetTop = 12; viewport.resize(); await flush();
  assert.equal(el('chat-layout').style['--chat-height'], '380px');
  assert.equal(el('chat-layout').style['--chat-offset'], '12px');
  for (let i = 0; i < 3; i++) {
    el('chat-input').fire('focus'); viewport.height = 380; viewport.offsetTop = 12; viewport.resize(); await flush();
    assert.equal(el('chat-composer').style.height, '120px');
    el('chat-input').fire('blur'); viewport.height = 700; viewport.offsetTop = 0; viewport.resize(); await flush();
    assert.equal(el('chat-layout').style['--chat-height'], '700px');
    assert.equal(el('chat-layout').style['--chat-offset'], '0px');
    assert.equal(el('chat-composer').style.height, '60px');
    assert.equal(el('chat-send').disabled, true);
  }
  el('ai-title').parentElement = { offsetHeight: 111 };
  el('chat-input').fire('focus'); viewport.height = 300; viewport.resize(); await flush();
  assert.equal(el('chat-composer').style.height, '109px', 'short keyboard viewport leaves room outside the composer');
  viewport.height = 700; viewport.resize(); await flush();
  assert.equal(el('chat-composer').style.height, '120px', 'keyboard dismissal with focus keeps the empty field expanded');
  el('chat-input').fire('blur');
  assert.equal(el('chat-composer').style.height, '60px');
  listeners.get('jamal:routechange')({ detail: { route: 'ai', topic: 'wudu' } }); await flush();
  assert.equal(el('chat-input').value, 'أريد تعلّم الوضوء خطوة بخطوة');
  assert.equal(el('ai-topic-title').textContent, 'تعلّم الوضوء');
  assert.equal(el('chat-messages').children.length, 0, 'topic is a draft, never auto-sent');
  el('chat-mic').fire(); await flush();
  route = 'home'; listeners.get('jamal:routechange')({ detail: { route } }); await flush();
  assert.equal(el('chat-recording').hidden, true, 'leaving cancels recording');
  assert.equal(device.track.stopped, true);
}
(async () => {
  await modelAndVoice(); await interfaceFlow();
  console.log('PASS: local history/Blobs, voice lifecycle, attachments, focus expansion and empty blur, retained/long drafts, focused/unfocused send, repeated and short keyboard viewports, old-message scroll, microphone cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
