import type { AuthenticationStorage, StoredAuthentication } from '@music-library/core';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'music-library.session';

export const authenticationStorage: AuthenticationStorage = {
  async load(): Promise<StoredAuthentication | null> {
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    if (!value) return null;
    try {
      return JSON.parse(value) as StoredAuthentication;
    } catch {
      await this.clear();
      return null;
    }
  },
  async save(value: StoredAuthentication): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value));
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
};