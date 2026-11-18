'use strict';
// Local design navigation only. No authentication, storage, or external requests.
const startScreen = document.getElementById('start-screen');
const shell = document.getElementById('internal-shell');
const track = document.getElementById('page-track');
const detail = document.getElementById('detail-page');
const detailTitle = document.getElementById('detail-title');
const options = document.getElementById('entry-options');
const emailButton = document.getElementById('email-option');
const panel = document.getElementById('email-panel');
const continueButton = document.getElementById('preview-continue');
const moreButton = document.getElementById('more-button');
const sheet = document.getElementById('more-sheet');
const navButtons = [...document.querySelectorAll('.nav-item[data-route]')];
const mainRoutes = ['home', 'quran', 'prayer'];
const detailNames = { profile: 'الملف الشخصي', settings: 'الإعدادات' };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let currentRoute = null;
let lastMain = 'home';
let readyFrame;
let sheetAnimation;
let sheetRevision = 0;

emailButton.addEventListener('click', () => {
  options.hidden = true;
  panel.hidden = false;
  emailButton.setAttribute('aria-expanded', 'true');
  continueButton.focus({ preventScroll: true });
});

function getRoute() {
  const route = window.location.hash.slice(1) || window.location.pathname.replace(/^\/+|\/+$/g, '');
  return mainRoutes.includes(route) || Object.hasOwn(detailNames, route) ? route : 'start';
}

function currentHeading() {
  return mainRoutes.includes(currentRoute)
    ? document.getElementById(`${currentRoute}-title`)
    : detailTitle;
}

function renderScreen() {
  const route = getRoute();
  if (route === currentRoute) return;
  const wasHidden = shell.hidden;
  const interior = route !== 'start';
  currentRoute = route;
  startScreen.hidden = interior;
  shell.hidden = !interior;
  document.body.classList.toggle('is-internal', interior);
  if (!interior) {
    cancelAnimationFrame(readyFrame);
    shell.classList.remove('is-ready');
    ++sheetRevision;
    sheetAnimation?.cancel();
    if (sheet.open) sheet.close();
    moreButton.setAttribute('aria-expanded', 'false');
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
  if (!sheet.open) currentHeading().focus({ preventScroll: true });
}

function navigate(route) {
  if (route === currentRoute) return;
  window.history.pushState(null, '', `#${route}`);
  renderScreen();
}

function openMore() {
  ++sheetRevision;
  sheetAnimation?.cancel();
  if (!sheet.open) sheet.showModal();
  moreButton.setAttribute('aria-expanded', 'true');
  if (!reducedMotion.matches) {
    sheetAnimation = sheet.animate(
      [{ transform: 'translateY(100%)', opacity: .9 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' }
    );
  }
}

function closeMore(focusTarget = moreButton) {
  if (!sheet.open) return;
  const revision = ++sheetRevision;
  // Cancel any entry animation and close from its currently rendered position.
  const transform = getComputedStyle(sheet).transform;
  const opacity = getComputedStyle(sheet).opacity;
  sheetAnimation?.cancel();
  const finish = () => {
    if (revision !== sheetRevision) return;
    sheet.close();
    moreButton.setAttribute('aria-expanded', 'false');
    if (!shell.hidden) focusTarget.focus({ preventScroll: true });
  };
  if (reducedMotion.matches) { finish(); return; }
  sheetAnimation = sheet.animate(
    [{ transform, opacity }, { transform: 'translateY(100%)', opacity: .9 }],
    { duration: 220, easing: 'cubic-bezier(.4,0,1,1)' }
  );
  sheetAnimation.finished.then(finish).catch(() => {});
}

continueButton.addEventListener('click', () => navigate('home'));
navButtons.forEach(button => button.addEventListener('click', () => navigate(button.dataset.route)));
moreButton.addEventListener('click', openMore);
document.getElementById('close-more').addEventListener('click', () => closeMore());
sheet.addEventListener('cancel', event => { event.preventDefault(); closeMore(); });
sheet.addEventListener('click', event => {
  if (event.target !== sheet) return;
  const bounds = sheet.getBoundingClientRect();
  if (event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientX > bounds.right) closeMore();
});
document.querySelectorAll('.sheet-option[data-route]').forEach(button => {
  button.addEventListener('click', () => {
    navigate(button.dataset.route);
    closeMore(currentHeading());
  });
});
document.getElementById('detail-back').addEventListener('click', () => navigate(lastMain));
window.addEventListener('hashchange', renderScreen);
window.addEventListener('popstate', renderScreen);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && sheetAnimation?.playState === 'running') sheetAnimation.finish();
});
renderScreen();
