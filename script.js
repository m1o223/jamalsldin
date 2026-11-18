'use strict';
// Local design navigation only. No authentication or external requests.
const PRAYER_PREVIEW = globalThis.JAMAL_PRAYER_DATA.preview;
document.getElementById('upcoming-name').textContent = PRAYER_PREVIEW.nextPrayer.name;
document.getElementById('upcoming-time').textContent = PRAYER_PREVIEW.times[PRAYER_PREVIEW.nextPrayer.key];
document.getElementById('remaining-time').textContent = PRAYER_PREVIEW.remaining;
document.querySelectorAll('[data-prayer]').forEach(row => {
  row.querySelector('bdi').textContent = PRAYER_PREVIEW.times[row.dataset.prayer];
  row.classList.toggle('is-next', row.dataset.prayer === PRAYER_PREVIEW.nextPrayer.key);
});
const startScreen = document.getElementById('start-screen');
const shell = document.getElementById('internal-shell');
const track = document.getElementById('page-track');
const detail = document.getElementById('detail-page');
const detailTitle = document.getElementById('detail-title');
const options = document.getElementById('entry-options');
const emailButton = document.getElementById('email-option');
const panel = document.getElementById('email-panel');
const continueButton = document.getElementById('preview-continue');
const accountEntry = document.getElementById('account-entry');
const accountReturn = document.getElementById('account-return');
// No authentication provider exists yet. Only a future verified session may supply a user.
// Preview navigation never changes this state and does not persist a login flag.
const ACCOUNT_STATE = Object.freeze({ user: null });
const settingsEntry = document.getElementById('settings-entry');
function renderAccount() {
  const user = ACCOUNT_STATE.user;
  document.getElementById('account-label').textContent = user ? 'الملف الشخصي' : 'تسجيل الدخول';
  settingsEntry.hidden = !user;
  const photo = document.getElementById('account-photo');
  document.getElementById('account-icon').toggleAttribute('hidden', Boolean(user?.avatarUrl));
  photo.hidden = !user?.avatarUrl;
  if (user?.avatarUrl) photo.src = user.avatarUrl;
  else photo.removeAttribute('src');
}
renderAccount();
const navButtons = [...document.querySelectorAll('.nav-item[data-route]')];
const mainRoutes = ['home', 'quran', 'prayer', 'ai'];
const detailNames = { profile: 'الملف الشخصي', settings: 'الإعدادات' };
let currentRoute = null;
let currentRouteKey = null;
let lastMain = 'home';
let readyFrame;
let aiReturnRoute = 'home';

emailButton.addEventListener('click', () => {
  options.hidden = true;
  panel.hidden = false;
  emailButton.setAttribute('aria-expanded', 'true');
  continueButton.focus({ preventScroll: true });
});

function getRoute() {
  const route = window.location.hash.slice(1).split('?')[0] || window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (Object.hasOwn(detailNames, route) && !ACCOUNT_STATE.user) return 'login';
  return mainRoutes.includes(route) || Object.hasOwn(detailNames, route) || route === 'login' ? route : 'start';
}

function currentHeading() {
  if (currentRoute === 'prayer') {
    return document.querySelector('#page-prayer [data-prayer-view]:not([hidden]) [data-view-heading]');
  }
  if (currentRoute === 'quran') {
    return document.querySelector('#page-quran [data-quran-view]:not([hidden]) [data-view-heading]');
  }
  return mainRoutes.includes(currentRoute)
    ? document.getElementById(`${currentRoute}-title`)
    : detailTitle;
}

function renderScreen() {
  const route = getRoute();
  const routeKey = window.location.pathname + window.location.search + window.location.hash;
  if (routeKey === currentRouteKey) return;
  currentRouteKey = routeKey;
  if (route === 'ai' && currentRoute !== 'ai') {
    const origin = window.history.state?.aiFrom;
    aiReturnRoute = ['home', 'quran', 'prayer'].includes(origin) ? origin
      : ['home', 'quran', 'prayer'].includes(currentRoute) ? currentRoute : getAITopic() ? 'prayer' : 'home';
  }
  if (route === 'ai') renderAIContext();
  const wasHidden = shell.hidden;
  const interior = route !== 'start' && route !== 'login';
  currentRoute = route;
  startScreen.hidden = interior;
  shell.hidden = !interior;
  document.body.classList.toggle('is-internal', interior);
  accountReturn.hidden = route !== 'login';
  document.getElementById('bottom-nav').hidden = route === 'ai';
  if (!interior) {
    cancelAnimationFrame(readyFrame);
    shell.classList.remove('is-ready');
    if (route === 'login') {
      options.hidden = false;
      panel.hidden = true;
      emailButton.setAttribute('aria-expanded', 'false');
      window.scrollTo(0, 0);
      accountReturn.focus({ preventScroll: true });
    }
    window.dispatchEvent(new CustomEvent('jamal:routechange', { detail: { route } }));
    return;
  }
  if (mainRoutes.includes(route)) lastMain = route;
  shell.dataset.section = lastMain;
  const isDetail = Object.hasOwn(detailNames, route);
  track.hidden = isDetail;
  detail.hidden = !isDetail;
  if (isDetail) detailTitle.textContent = detailNames[route];
  mainRoutes.forEach(name => {
    const page = document.getElementById(`page-${name}`);
    const active = !isDetail && route === name;
    page.inert = !active;
    page.setAttribute('aria-hidden', String(!active));
  });
  navButtons.forEach(button => {
    if (button.dataset.route === lastMain) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (wasHidden) {
    shell.classList.remove('is-ready');
    readyFrame = requestAnimationFrame(() => shell.classList.add('is-ready'));
    window.scrollTo(0, 0);
  }
  currentHeading().focus({ preventScroll: true });
  window.dispatchEvent(new CustomEvent('jamal:routechange', { detail: { route, topic: getAITopic() } }));
}

function getAITopic() {
  const query = window.location.hash ? (window.location.hash.split('?')[1] || '') : window.location.search;
  const parameters = new URLSearchParams(query);
  return Object.hasOwn(globalThis.JAMAL_PRAYER_DATA.topics, parameters.get('topic')) ? parameters.get('topic') : null;
}

function renderAIContext() {
  const topic = globalThis.JAMAL_PRAYER_DATA.topics[getAITopic()];
  document.getElementById('ai-title').textContent = 'جمال';
  document.getElementById('ai-context').hidden = !topic;
  document.getElementById('ai-topic-title').textContent = topic ? topic.title : '';
  document.getElementById('ai-topic').textContent = topic ? topic.prompt : '';
}

function navigate(route, topic = null) {
  const hash = `#${route}${route === 'ai' && Object.hasOwn(globalThis.JAMAL_PRAYER_DATA.topics, topic) ? `?topic=${topic}` : ''}`;
  if (window.location.hash === hash) return;
  window.history.pushState(route === 'ai' ? { chatEntry: true, aiFrom: currentRoute === 'ai' ? aiReturnRoute : currentRoute } : null, '', hash);
  renderScreen();
}

continueButton.addEventListener('click', () => navigate('home'));
accountEntry.addEventListener('click', () => navigate(ACCOUNT_STATE.user ? 'profile' : 'login'));
settingsEntry.addEventListener('click', () => {
  if (ACCOUNT_STATE.user) navigate('settings');
});
accountReturn.addEventListener('click', () => navigate('home'));
navButtons.forEach(button => button.addEventListener('click', () => navigate(button.dataset.route)));
document.getElementById('detail-back').addEventListener('click', () => navigate(lastMain));
document.getElementById('ai-back').addEventListener('click', () => {
  if (window.history.state?.chatEntry) window.history.back();
  else navigate(aiReturnRoute);
});
window.addEventListener('hashchange', renderScreen);
window.addEventListener('popstate', renderScreen);
renderScreen();
