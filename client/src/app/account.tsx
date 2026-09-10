import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader, SegmentControl } from '@/components/music-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { AuthPanel } from '@/features/auth-panel';
import { useApp } from '@/providers/app-provider';
import { type ThemePreference, useThemePreference } from '@/providers/theme-provider';

const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
] as const;

export default function AccountScreen() {
  const { user } = useApp();
  const { preference, setPreference } = useThemePreference();

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader
            eyebrow={user ? `Signed in as ${user.displayName || user.email}` : 'Music Library account'}
            title={user ? 'Account' : 'Account access'}
          />
          <ThemedView type="backgroundElement" style={styles.appearance}>
            <ThemedText style={styles.appearanceTitle}>Appearance</ThemedText>
            <SegmentControl<ThemePreference> options={themeOptions} onChange={setPreference} value={preference} />
          </ThemedView>
          <ThemedView style={styles.account}>
            <AuthPanel />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  account: { maxWidth: 560, width: '100%' },
  appearance: { gap: Spacing.three, maxWidth: 560, padding: Spacing.four, width: '100%' },
  appearanceTitle: { fontSize: 17, fontWeight: '800' },
  content: {
    alignSelf: 'center',
    gap: Spacing.four,
    maxWidth: 1180,
    paddingBottom: BottomTabInset + 140,
    paddingHorizontal: Spacing.four,
    paddingTop: 74,
    width: '100%',
  },
  page: { flex: 1 },
  safeArea: { flex: 1 },
});
