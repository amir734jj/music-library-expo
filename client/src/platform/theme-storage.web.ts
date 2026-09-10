import type { ThemePreference } from '@/providers/theme-provider';

const THEME_KEY = 'music-library.theme';

export const themeStorage = {
  async load(): Promise<ThemePreference> {
    if (typeof window === 'undefined') return 'system';
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  },
  async save(value: ThemePreference): Promise<void> {
    if (typeof window === 'undefined') return;
    if (value === 'system') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, value);
  },
};
