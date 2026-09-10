import { check } from '@tauri-apps/plugin-updater';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;

class DesktopUpdater {
  private initialized = false;
  private readonly supported = typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window
      || window.location.protocol === 'tauri:'
      || window.location.hostname === 'tauri.localhost');

  async initialize(): Promise<void> {
    if (!this.supported || this.initialized) return;
    this.initialized = true;
    await this.checkAndInstall();
    window.setInterval(() => {
      this.checkAndInstall().catch((error: unknown) => console.error('Desktop update check failed', error));
    }, UPDATE_CHECK_INTERVAL_MS);
  }

  private async checkAndInstall(): Promise<void> {
    const update = await check();
    if (update) await update.downloadAndInstall();
  }
}

export const desktopUpdater = new DesktopUpdater();