import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { themeStorage } from '@/platform/theme-storage';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextValue {
  preference: ThemePreference;
  scheme: ResolvedTheme;
  setPreference(preference: ThemePreference): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const scheme: ResolvedTheme = preference === 'system'
    ? systemScheme === 'dark' ? 'dark' : 'light'
    : preference;

  useEffect(() => {
    themeStorage.load().then(setPreferenceState).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = scheme;
    document.documentElement.style.colorScheme = scheme;
  }, [scheme]);

  function setPreference(value: ThemePreference): void {
    setPreferenceState(value);
    themeStorage.save(value).catch(() => undefined);
  }

  return (
    <ThemeContext.Provider value={{ preference, scheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemePreference must be used within AppThemeProvider.');
  return context;
}
