import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { PlayerDock } from '@/components/player-dock';
import { AppProvider } from '@/providers/app-provider';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppProvider>
        <AppTabs />
        <PlayerDock />
      </AppProvider>
    </ThemeProvider>
  );
}
