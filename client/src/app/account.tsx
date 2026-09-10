import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/music-ui';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { AuthPanel } from '@/features/auth-panel';
import { useApp } from '@/providers/app-provider';

export default function AccountScreen() {
  const { user } = useApp();

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader
            eyebrow={user ? `Signed in as ${user.displayName || user.email}` : 'Music Library account'}
            title={user ? 'Account' : 'Account access'}
          />
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
