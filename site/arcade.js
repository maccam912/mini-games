const storageKey = 'pocket-cabinet:saved';
const rows = [...document.querySelectorAll('[data-game]')];
const saveButtons = [...document.querySelectorAll('[data-save]')];
const libraryHeading = document.querySelector('#library-heading');
const savedNav = document.querySelector('#saved-nav');
const arcadeNav = document.querySelector('#arcade-nav');
const feature = document.querySelector('.feature');
let saved = readSaved();

function readSaved() {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey));
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function render() {
  const savedView = location.hash === '#saved';
  document.body.classList.toggle('saved', savedView);
  if (feature) feature.hidden = savedView;
  arcadeNav.removeAttribute('aria-current');
  savedNav.removeAttribute('aria-current');
  (savedView ? savedNav : arcadeNav).setAttribute('aria-current', 'page');
  document.title = `Pocket Cabinet · ${savedView ? 'Saved games' : 'Arcade'}`;
  libraryHeading.textContent = savedView ? 'Saved games' : 'Game library';
  let count = 0;
  for (const row of rows) {
    row.hidden = savedView && !saved.has(row.dataset.game);
    if (!row.hidden) count++;
  }
  document.querySelector('#library-count').textContent = `${count} ${count === 1 ? 'game' : 'games'}`;
  document.querySelector('#saved-empty').hidden = !savedView || count > 0;
  for (const button of saveButtons) {
    const active = saved.has(button.dataset.save);
    button.hidden = false;
    button.setAttribute('aria-pressed', String(active));
    button.title = `${active ? 'Unsave' : 'Save'} ${button.dataset.title}`;
    button.setAttribute('aria-label', button.title);
    const label = button.querySelector('span');
    if (label) label.textContent = active ? 'Saved' : 'Save';
  }
}

savedNav.hidden = false;
document.addEventListener('click', event => {
  const button = event.target.closest('[data-save]');
  if (!button) return;
  const slug = button.dataset.save;
  if (saved.has(slug)) saved.delete(slug);
  else saved.add(slug);
  try { localStorage.setItem(storageKey, JSON.stringify([...saved])); } catch {}
  document.querySelector('#announcement').textContent =
    `${button.dataset.title} ${saved.has(slug) ? 'saved' : 'removed from saved games'}.`;
  render();
  if (button.closest('[hidden]')) (document.querySelector('.game-row:not([hidden]) [data-save]') ?? document.querySelector('.back-arcade')).focus();
});
window.addEventListener('hashchange', render);
window.addEventListener('pageshow', () => { saved = readSaved(); render(); });
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) { saved = readSaved(); render(); }
});
render();
