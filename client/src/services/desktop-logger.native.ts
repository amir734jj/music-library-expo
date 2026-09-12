import type { ClientLogLevel, ClientLogRequest } from '@music-library/core';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { CLIENT_LOG_URL } from '@/constants/endpoints';

interface NativeErrorUtils {
  getGlobalHandler?(): (error: Error, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: Error, isFatal?: boolean) => void): void;
}

interface NativePromiseRejectionEvent {
  reason?: unknown;
}

const pendingCrash = new File(Paths.document, 'pending-client-crash.json');

class DesktopLogger {
  readonly supported = false;
  private initialized = false;
  private installed = false;

  async initialize(): Promise<string | null> {
    if (this.initialized) return null;
    this.initialized = true;
    await this.flushPendingCrash();
    await this.info('Client initialized');
    return null;
  }

  installGlobalHandlers(): void {
    if (this.installed) return;
    this.installed = true;
    const runtime = globalThis as typeof globalThis & {
      ErrorUtils?: NativeErrorUtils;
      addEventListener?: (
        type: string,
        listener: (event: NativePromiseRejectionEvent) => void,
      ) => void;
    };
    const errorUtils = runtime.ErrorUtils;
    if (errorUtils) {
      const previous = errorUtils.getGlobalHandler?.();
      errorUtils.setGlobalHandler((error, isFatal) => {
        void this.reportError(error, isFatal ? 'fatal-js-error' : 'js-error', error.stack, isFatal);
        previous?.(error, isFatal);
      });
    }
    runtime.addEventListener?.('unhandledrejection', (event) => {
      const reason = event.reason;
      const error = reason instanceof Error ? reason : new Error(String(reason));
      void this.write('error', error.message, 'unhandled-rejection', error.stack);
    });
    void this.initialize();
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

  reportError(
    error: Error,
    context: string,
    stack = error.stack,
    persist = false,
  ): Promise<void> {
    return this.write('error', `${error.name}: ${error.message}`, context, stack, persist);
  }

  private async write(
    level: ClientLogLevel,
    message: string,
    context?: string,
    stack?: string,
    persist = false,
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
    const serialized = JSON.stringify(event);
    if (persist) this.persistCrash(serialized);
    const delivered = await this.send(serialized);
    if (persist && delivered) this.deletePendingCrash(serialized);
  }

  private async flushPendingCrash(): Promise<void> {
    try {
      if (!pendingCrash.exists) return;
      const serialized = pendingCrash.textSync();
      if (await this.send(serialized)) this.deletePendingCrash(serialized);
    } catch {
      // A corrupt or unavailable crash file must not prevent the app from starting.
    }
  }

  private persistCrash(serialized: string): void {
    try {
      if (!pendingCrash.exists) pendingCrash.create({ intermediates: true });
      pendingCrash.write(serialized);
    } catch {
      // The live request below may still deliver the event.
    }
  }

  private deletePendingCrash(serialized: string): void {
    try {
      if (pendingCrash.exists && pendingCrash.textSync() === serialized) pendingCrash.delete();
    } catch {
      // A later launch can retry deletion and delivery.
    }
  }

  private async send(serialized: string): Promise<boolean> {
    try {
      const response = await fetch(CLIENT_LOG_URL, {
        body: serialized,
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const desktopLogger = new DesktopLogger();
