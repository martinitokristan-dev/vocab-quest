/**
 * "Install Vocab Quest" toast (PWA).
 *
 * - Android / Chrome / Edge: keeps the browser's install event and shows our own toast with an
 *   INSTALL button that opens the browser's install dialog.
 * - iPhone / iPad: Apple has no install event, so the toast explains Share -> Add to Home Screen.
 * - Shown only on the title and join screens (never while playing), only on touch devices,
 *   never when the game already runs as an installed app. "Not now" hides it for 3 days.
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'vq_install_dismissed_at';
const INSTALLED_KEY = 'vq_installed';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 1800;
const ALLOWED_SCREENS = new Set(['title', 'join']);

let deferred: InstallPromptEvent | null = null;
let currentScreen = '';
let toastEl: HTMLElement | null = null;
let showTimer: number | null = null;
let started = false;

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

function isTouch(): boolean {
  return (navigator.maxTouchPoints || 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches;
}

function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

function snoozed(): boolean {
  if (storageGet(INSTALLED_KEY) === '1') return true;
  const at = Number(storageGet(DISMISS_KEY) || 0);
  return at > 0 && Date.now() - at < SNOOZE_MS;
}

function canShow(): boolean {
  if (!ALLOWED_SCREENS.has(currentScreen)) return false;
  if (isStandalone() || snoozed() || !isTouch()) return false;
  return !!deferred || isIOS();
}

const SHARE_ICON = `<svg class="vq-install-share" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const PLUS_ICON = `<svg class="vq-install-share" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;

function buildToast(): HTMLElement {
  const ios = !deferred && isIOS();
  const el = document.createElement('div');
  el.className = 'vq-install-toast';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', 'Install Vocab Quest');
  // Compact card at the top of the screen, so the PLAY / HOW TO PLAY buttons stay free.
  el.innerHTML = `
    <div class="vq-install-card${ios ? ' is-ios' : ''}">
      <img class="vq-install-icon" src="/icons/icon-192.png" alt="" width="52" height="52" />
      <div class="vq-install-text">
        <div class="vq-install-title">Install Vocab Quest</div>
        ${ios
          ? `<div class="vq-install-sub">Tap ${SHARE_ICON} <b>Share</b>, then ${PLUS_ICON} <b>Add to Home Screen</b></div>`
          : `<div class="vq-install-sub">Play like an app. Faster, full screen!</div>`}
      </div>
      <div class="vq-install-actions">
        ${ios
          ? `<button type="button" class="vq-install-btn vq-install-primary" data-act="later">OK</button>`
          : `<button type="button" class="vq-install-btn vq-install-primary" data-act="install">INSTALL</button>`}
        ${ios ? '' : `<button type="button" class="vq-install-later" data-act="later-link">Not now</button>`}
      </div>
    </div>`;

  const later = () => {
    storageSet(DISMISS_KEY, String(Date.now()));
    hideToast();
  };
  el.querySelectorAll('[data-act="later"], [data-act="later-link"]').forEach((b) => b.addEventListener('click', later));
  el.querySelector('[data-act="install"]')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    if (!deferred || btn.disabled) return;
    btn.disabled = true;
    const event = deferred;
    deferred = null; // the browser allows prompt() only once per event
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') storageSet(INSTALLED_KEY, '1');
      else storageSet(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    hideToast();
  });
  return el;
}

function showToast() {
  if (toastEl || !canShow()) return;
  toastEl = buildToast();
  document.body.appendChild(toastEl);
  // next frame: start the slide-up animation
  requestAnimationFrame(() => requestAnimationFrame(() => toastEl?.classList.add('is-open')));
}

function hideToast() {
  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  const el = toastEl;
  toastEl = null;
  if (!el) return;
  el.classList.remove('is-open');
  el.classList.add('is-closing');
  window.setTimeout(() => el.remove(), 320);
}

function scheduleShow() {
  if (toastEl || showTimer !== null || !canShow()) return;
  showTimer = window.setTimeout(() => {
    showTimer = null;
    showToast();
  }, SHOW_DELAY_MS);
}

/** Call once at start-up. */
export function initInstallPrompt() {
  if (started) return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it; our toast decides when to ask
    deferred = e as InstallPromptEvent;
    scheduleShow();
  });
  window.addEventListener('appinstalled', () => {
    storageSet(INSTALLED_KEY, '1');
    deferred = null;
    hideToast();
  });
}

/** Call on every screen change: shows the toast on the title/join screens, hides it elsewhere. */
export function setInstallPromptScreen(screen: string) {
  if (screen === currentScreen) return;
  currentScreen = screen;
  if (ALLOWED_SCREENS.has(screen)) scheduleShow();
  else hideToast();
}
