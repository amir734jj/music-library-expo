import type { ThemePreference } from '@/providers/theme-provider';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'music-library.theme';

export const themeStorage = {
  async load(): Promise<ThemePreference> {
    const value = await SecureStore.getItemAsync(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  },
  async save(value: ThemePreference): Promise<void> {
    if (value === 'system') await SecureStore.deleteItemAsync(THEME_KEY);
    else await SecureStore.setItemAsync(THEME_KEY, value);
  },
};
