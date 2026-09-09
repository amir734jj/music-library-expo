import type { AuthenticationStorage, StoredAuthentication } from '@music-library/core';

const SESSION_KEY = 'music-library.session';

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export const authenticationStorage: AuthenticationStorage = {
  async load(): Promise<StoredAuthentication | null> {
    const value = storage()?.getItem(SESSION_KEY);
    if (!value) return null;
    try {
      return JSON.parse(value) as StoredAuthentication;
    } catch {
      await this.clear();
      return null;
    }
  },
  async save(value: StoredAuthentication): Promise<void> {
    storage()?.setItem(SESSION_KEY, JSON.stringify(value));
  },
  async clear(): Promise<void> {
    storage()?.removeItem(SESSION_KEY);
  },
};