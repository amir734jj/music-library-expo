import { invoke } from '@tauri-apps/api/core';
import type { ClientLogLevel, ClientLogRequest } from '@music-library/core';
import Constants from 'expo-constants';

const isTauri = typeof window !== 'undefined'
  && ('__TAURI_INTERNALS__' in window
    || window.location.protocol === 'tauri:'
    || window.location.hostname === 'tauri.localhost');

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

class DesktopLogger {
  readonly supported = isTauri;
  private installed = false;

  async initialize(): Promise<string | null> {
    if (!this.supported) return null;
    const path = await this.location();
    await this.info(`Desktop client started at ${window.location.href}`);
    return path;
  }

  installGlobalHandlers(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    window.addEventListener('error', (event) => {
      void this.write('ERROR', `Unhandled error: ${event.message}`, 'window-error', event.error?.stack);
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      void this.write(
        'ERROR',
        `Unhandled promise rejection: ${errorText(reason)}`,
        'unhandled-rejection',
        reason instanceof Error ? reason.stack : undefined,
      );
    });
  }

  location(): Promise<string | null> {
    return this.supported ? invoke<string>('desktop_log_location') : Promise.resolve(null);
  }

  info(message: string): Promise<void> {
    return this.write('INFO', message);
  }

  error(message: string): Promise<void> {
    return this.write('ERROR', message);
  }

  private async write(
    level: 'ERROR' | 'INFO',
    message: string,
    context?: string,
    stack?: string,
  ): Promise<void> {
    const local = this.supported
      ? invoke<void>('write_desktop_log', { level, message }).catch(() => undefined)
      : Promise.resolve();
    const event: ClientLogRequest = {
      context,
      level: level.toLowerCase() as ClientLogLevel,
      message,
      platform: this.supported ? 'desktop' : 'web',
      stack,
      timestamp: new Date().toISOString(),
      version: Constants.expoConfig?.version,
    };
    const endpoint = this.supported
      ? 'https://music-library2.coolify.hesamian.com/api/client-logs'
      : `${window.location.origin}/api/client-logs`;
    await Promise.all([
      local,
      fetch(endpoint, {
        body: JSON.stringify(event),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }).catch(() => undefined),
    ]);
  }
}

export const desktopLogger = new DesktopLogger();
