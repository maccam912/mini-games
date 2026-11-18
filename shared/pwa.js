const installButton = document.querySelector('[data-install]');
const fullscreenButton = document.querySelector('[data-fullscreen]');
const installedDisplay = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)');
const ios = /iP(?:ad|hone|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const safariVersion = navigator.userAgent.match(/Version\/(\d+).*Safari\//);
const macSafari = !ios && /Macintosh/.test(navigator.userAgent) && Number(safariVersion?.[1]) >= 17;
let installPrompt;
let installed = false;

function showMessage(title, message) {
  const dialog = document.createElement('dialog');
  dialog.className = 'pwa-dialog';
  dialog.setAttribute('aria-labelledby', 'pwa-dialog-title');
  const heading = document.createElement('h2');
  heading.id = 'pwa-dialog-title';
  heading.textContent = title;
  const details = document.createElement('p');
  details.textContent = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Got it';
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.append(heading, details, close);
  document.body.append(dialog);
  dialog.showModal();
}

function updateInstallButton() {
  if (!installButton) return;
  installButton.hidden = installed || installedDisplay.matches || navigator.standalone === true ||
    !(installPrompt || ios || macSafari);
}

window.addEventListener('beforeinstallprompt', event => {
  if (!installButton) return;
  event.preventDefault();
  installPrompt = event;
  updateInstallButton();
});

window.addEventListener('appinstalled', () => {
  installed = true;
  installPrompt = undefined;
  updateInstallButton();
});
installedDisplay.addEventListener('change', updateInstallButton);
installButton?.addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    updateInstallButton();
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      showMessage('Install game', 'Open your browser menu and look for its app installation option.');
    }
  } else if (ios) {
    showMessage('Install on your home screen', 'Open Share, then choose Add to Home Screen. If you see Open as Web App, turn it on and tap Add.');
  } else if (macSafari) {
    showMessage('Install on your Mac', 'Open Safari’s File menu, choose Add to Dock, then click Add.');
  }
});
updateInstallButton();

if (fullscreenButton) {
  const screen = document.documentElement;
  fullscreenButton.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  function updateFullscreenButton() {
    const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    const label = active ? 'Exit fullscreen' : 'Fullscreen';
    fullscreenButton.title = label;
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    const caption = fullscreenButton.querySelector('[data-fullscreen-label]');
    if (caption) caption.textContent = label;
  }
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        await (screen.requestFullscreen || screen.webkitRequestFullscreen).call(screen);
      }
    } catch {
      showMessage('Fullscreen unavailable', 'Open the game in its own browser tab to use fullscreen.');
    }
  });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
  updateFullscreenButton();
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .catch(error => console.warn('Offline game setup failed.', error));
}
