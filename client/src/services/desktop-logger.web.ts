import { invoke } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined'
  && ('__TAURI_INTERNALS__' in window || window.location.hostname === 'tauri.localhost');

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

class DesktopLogger {
  readonly supported = isTauri;

  async initialize(): Promise<string | null> {
    if (!this.supported) return null;
    const path = await this.location();
    await this.info(`Desktop client started at ${window.location.href}`);
    window.addEventListener('error', (event) => {
      void this.error(`Unhandled error: ${event.message} (${event.filename}:${event.lineno}:${event.colno})`);
    });
    window.addEventListener('unhandledrejection', (event) => {
      void this.error(`Unhandled promise rejection: ${errorText(event.reason)}`);
    });
    return path;
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

  private write(level: 'ERROR' | 'INFO', message: string): Promise<void> {
    return this.supported
      ? invoke<void>('write_desktop_log', { level, message }).catch(() => undefined)
      : Promise.resolve();
  }
}

export const desktopLogger = new DesktopLogger();
