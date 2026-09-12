import type { ClientLogLevel, ClientLogRequest } from '@music-library/core';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

declare const ErrorUtils: {
  getGlobalHandler?(): (error: Error, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: Error, isFatal?: boolean) => void): void;
} | undefined;

interface NativePromiseRejectionEvent {
  reason?: unknown;
}

const CLIENT_LOG_URL = 'https://music-library2.coolify.hesamian.com/api/client-logs';

class DesktopLogger {
  readonly supported = false;
  private installed = false;

  async initialize(): Promise<string | null> {
    await this.info('Client initialized');
    return Promise.resolve(null);
  }

  installGlobalHandlers(): void {
    if (this.installed || typeof ErrorUtils === 'undefined') return;
    this.installed = true;
    const previous = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      void this.write('error', error.message, isFatal ? 'fatal-js-error' : 'js-error', error.stack);
      previous?.(error, isFatal);
    });
    const runtime = globalThis as typeof globalThis & {
      addEventListener?: (
        type: string,
        listener: (event: NativePromiseRejectionEvent) => void,
      ) => void;
    };
    runtime.addEventListener?.('unhandledrejection', (event) => {
      const reason = event.reason;
      const error = reason instanceof Error ? reason : new Error(String(reason));
      void this.write('error', error.message, 'unhandled-rejection', error.stack);
    });
  }

  location(): Promise<string | null> {
    return Promise.resolve(null);
  }

  info(_message: string): Promise<void> {
    return this.write('info', _message);
  }

  error(_message: string): Promise<void> {
    return this.write('error', _message);
  }

  private async write(
    level: ClientLogLevel,
    message: string,
    context?: string,
    stack?: string,
  ): Promise<void> {
    const event: ClientLogRequest = {
      context,
      level,
      message,
      platform: Platform.OS,
      stack,
      timestamp: new Date().toISOString(),
      version: Constants.expoConfig?.version,
    };
    await fetch(CLIENT_LOG_URL, {
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => undefined);
  }
}

export const desktopLogger = new DesktopLogger();
