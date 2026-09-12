import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { PlayerDock } from '@/components/player-dock';
import { AppProvider } from '@/providers/app-provider';
import { AppThemeProvider, useThemePreference } from '@/providers/theme-provider';
import { desktopLogger } from '@/services/desktop-logger';

desktopLogger.installGlobalHandlers();

export default function TabLayout() {
  return <RootErrorBoundary><AppThemeProvider><ThemedApplication /></AppThemeProvider></RootErrorBoundary>;
}

interface RootErrorBoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends Component<PropsWithChildren, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const stack = [error.stack, info.componentStack].filter(Boolean).join('\n');
    void desktopLogger.reportError(error, 'react-error-boundary', stack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.crashContainer}>
        <Text accessibilityRole="header" style={styles.crashTitle}>Music Library stopped unexpectedly</Text>
        <Text style={styles.crashMessage}>The error was reported. Try reopening the app.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ error: null })}
          style={styles.retryButton}>
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }
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

const styles = StyleSheet.create({
  crashContainer: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  crashMessage: {
    color: '#4b5563',
    fontSize: 16,
    textAlign: 'center',
  },
  crashTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1677c8',
    borderRadius: 6,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
