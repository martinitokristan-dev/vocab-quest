import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';

interface SettingsModalProps {
  onClose: () => void;
}

/**
 * SettingsModal component - Renders the audio and game settings modal
 * Pure extraction from main.ts renderModals method
 */
export class SettingsModal {
  private container: HTMLElement;
  private props: SettingsModalProps;

  constructor(props: SettingsModalProps) {
    this.props = props;
    this.container = document.createElement('div');
    this.container.id = 'modalContainer';
    this.container.className = 'modal-overlay';
  }

  /**
   * Render the modal
   */
  render(): void {
    const settings = soundManager.getSettings();

    this.container.innerHTML = `
      <div class="modal-dialog modal-voxel-box">
        <div class="modal-header">
          <div class="modal-title minecraft-gold-title" style="font-family: var(--font-primary); font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>${Icons.refresh(22)}</span>
            <span>AUDIO & GAME SETTINGS</span>
          </div>
          <button id="closeSettingsBtn" class="modal-close-btn voxel-close-btn">✕</button>
        </div>

        <div class="settings-control-group">
          <div class="settings-slider-row">
            <div class="settings-slider-header">
              <span class="minecraft-label" style="font-family: var(--font-primary); font-size: 16px; font-weight: 600;">Master Volume</span>
              <span id="masterVolLabel" class="minecraft-value-badge">${Math.round(settings.masterVolume * 100)}%</span>
            </div>
            <input type="range" id="masterVolSlider" min="0" max="100" value="${Math.round(settings.masterVolume * 100)}" class="minecraft-range-slider" />
          </div>

          <div class="settings-slider-row">
            <div class="settings-slider-header">
              <span class="minecraft-label" style="font-family: var(--font-primary); font-size: 16px; font-weight: 600;">Sound Effects (SFX) Volume</span>
              <span id="sfxVolLabel" class="minecraft-value-badge">${Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input type="range" id="sfxVolSlider" min="0" max="100" value="${Math.round(settings.sfxVolume * 100)}" class="minecraft-range-slider" />
          </div>

          <div class="settings-slider-row">
            <div class="settings-slider-header">
              <span class="minecraft-label" style="font-family: var(--font-primary); font-size: 16px; font-weight: 600;">Background Music (BGM) Volume</span>
              <span id="bgVolLabel" class="minecraft-value-badge">${Math.round(settings.bgmVolume * 100)}%</span>
            </div>
            <input type="range" id="bgmVolSlider" min="0" max="100" value="${Math.round(settings.bgmVolume * 100)}" class="minecraft-range-slider" />
          </div>

          <div class="settings-toggle-row">
            <div>
              <span class="minecraft-label" style="font-family: var(--font-primary); font-weight: 700; color: #DC2626; display: block; font-size: 16px;">Mute All Audio</span>
              <span style="font-size: 13px; color: #64748B;">Silence sound effects and vocabulary narration</span>
            </div>
            <input type="checkbox" id="muteToggle" ${settings.muted ? 'checked' : ''} class="minecraft-checkbox" />
          </div>
        </div>

        <div style="display: flex; gap: 14px; margin-top: 8px;">
          <div id="testAudioBtnFrame" class="vocab-btn-frame" style="flex: 1;">
            <button id="testAudioBtn" class="vocab-btn vocab-btn-blue" style="height: 52px; font-size: 20px;">
              <span>${Icons.volume(20)}</span>
              <span>TEST SOUND</span>
            </button>
          </div>
          <div id="closeSettingsBtnBottomFrame" class="vocab-btn-frame" style="flex: 1;">
            <button id="closeSettingsBtnBottom" class="vocab-btn vocab-btn-green" style="height: 52px; font-size: 20px;">
              <span>${Icons.check(20)}</span>
              <span>SAVE & CLOSE</span>
            </button>
          </div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => this.attachEventListeners());
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const testFrame = document.getElementById('testAudioBtnFrame');
    const saveFrame = document.getElementById('closeSettingsBtnBottomFrame');
    testFrame?.addEventListener('mouseenter', () => soundManager.playHover());
    saveFrame?.addEventListener('mouseenter', () => soundManager.playHover());

    const masterSlider = document.getElementById('masterVolSlider') as HTMLInputElement;
    const sfxSlider = document.getElementById('sfxVolSlider') as HTMLInputElement;
    const bgmSlider = document.getElementById('bgmVolSlider') as HTMLInputElement;
    const muteCheckbox = document.getElementById('muteToggle') as HTMLInputElement;

    masterSlider?.addEventListener('input', () => {
      const val = Number(masterSlider.value) / 100;
      soundManager.saveSettings({ masterVolume: val });
      (document.getElementById('masterVolLabel') as HTMLElement).innerText = `${masterSlider.value}%`;
    });

    sfxSlider?.addEventListener('input', () => {
      const val = Number(sfxSlider.value) / 100;
      soundManager.saveSettings({ sfxVolume: val });
      (document.getElementById('sfxVolLabel') as HTMLElement).innerText = `${sfxSlider.value}%`;
    });

    bgmSlider?.addEventListener('input', () => {
      const val = Number(bgmSlider.value) / 100;
      soundManager.saveSettings({ bgmVolume: val });
      (document.getElementById('bgVolLabel') as HTMLElement).innerText = `${bgmSlider.value}%`;
    });

    muteCheckbox?.addEventListener('change', () => {
      soundManager.playClick();
      soundManager.saveSettings({ muted: muteCheckbox.checked });
    });

    testFrame?.addEventListener('click', () => {
      soundManager.playSuccess();
    });

    const closeSettings = () => {
      soundManager.playClick();
      this.props.onClose();
    };

    document.getElementById('closeSettingsBtn')?.addEventListener('click', closeSettings);
    saveFrame?.addEventListener('click', closeSettings);
  }

  /**
   * Mount the modal to the body
   */
  mount(): void {
    document.body.appendChild(this.container);
  }

  /**
   * Remove the modal from the DOM
   */
  destroy(): void {
    this.container.remove();
  }
}
