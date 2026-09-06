/**
 * Toast notification utility
 * Pure extraction from main.ts showToast method
 */

export type ToastType = 'warning' | 'info' | 'success';

/**
 * Show a toast notification
 * @param title - Toast title
 * @param message - Toast message
 * @param type - Toast type (warning, info, success)
 * @param durationMs - Duration in milliseconds before auto-dismiss
 */
export function showToast(
  title: string,
  message: string,
  type: ToastType = 'warning',
  durationMs = 4000
): void {
  let container = document.getElementById('gameToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'gameToastContainer';
    container.className = 'game-toast-container';
    document.body.appendChild(container);
  }

  container.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = 'game-toast';

  let iconSvg = '';
  if (type === 'warning') {
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    `;
  } else if (type === 'success') {
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    `;
  } else {
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    `;
  }

  toast.innerHTML = `
    <div class="game-toast-icon-box toast-${type}">
      ${iconSvg}
    </div>
    <div class="game-toast-content">
      <div class="game-toast-title">${title}</div>
      <div class="game-toast-message">${message}</div>
    </div>
  `;

  const dismiss = () => {
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      toast.remove();
    }, 250);
  };

  toast.addEventListener('click', dismiss);
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      dismiss();
    }
  }, durationMs);
}
