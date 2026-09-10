import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { PlayerDock } from '@/components/player-dock';
import { AppProvider } from '@/providers/app-provider';
import { AppThemeProvider, useThemePreference } from '@/providers/theme-provider';

export default function TabLayout() {
  return <AppThemeProvider><ThemedApplication /></AppThemeProvider>;
}

function ThemedApplication() {
  const { scheme } = useThemePreference();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppProvider>
        <AppTabs />
        <PlayerDock />
      </AppProvider>
    </ThemeProvider>
  );
}
