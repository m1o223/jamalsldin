'use strict';
// Local design navigation only. No authentication, storage, or external requests.
// Display-only fixture. Replace this object when a real prayer-time source is added.
// These values have no city, calculation method, clock, or countdown behind them.
const PRAYER_PREVIEW = Object.freeze({
  times: Object.freeze({ fajr: '05:15', dhuhr: '12:30', asr: '15:45', maghrib: '18:10', isha: '19:40' }),
  nextPrayer: Object.freeze({ key: 'asr', name: 'العصر' }),
  remaining: '01:20'
});
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
let lastMain = 'home';
let readyFrame;

emailButton.addEventListener('click', () => {
  options.hidden = true;
  panel.hidden = false;
  emailButton.setAttribute('aria-expanded', 'true');
  continueButton.focus({ preventScroll: true });
});

function getRoute() {
  const route = window.location.hash.slice(1) || window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (Object.hasOwn(detailNames, route) && !ACCOUNT_STATE.user) return 'login';
  return mainRoutes.includes(route) || Object.hasOwn(detailNames, route) || route === 'login' ? route : 'start';
}

function currentHeading() {
  if (currentRoute === 'quran') {
    return document.querySelector('#page-quran [data-quran-view]:not([hidden]) [data-view-heading]');
  }
  return mainRoutes.includes(currentRoute)
    ? document.getElementById(`${currentRoute}-title`)
    : detailTitle;
}

function renderScreen() {
  const route = getRoute();
  if (route === currentRoute) return;
  const wasHidden = shell.hidden;
  const interior = route !== 'start' && route !== 'login';
  currentRoute = route;
  startScreen.hidden = interior;
  shell.hidden = !interior;
  document.body.classList.toggle('is-internal', interior);
  accountReturn.hidden = route !== 'login';
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
}

function navigate(route) {
  if (route === currentRoute) return;
  window.history.pushState(null, '', `#${route}`);
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
window.addEventListener('hashchange', renderScreen);
window.addEventListener('popstate', renderScreen);
renderScreen();
