import { UserRole } from '@music-library/core';
import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingState, ScreenHeader } from '@/components/music-ui';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { AdminPanel } from '@/features/admin-panel';
import { useApp } from '@/providers/app-provider';

export default function AdminScreen() {
  const { sessionStatus, user } = useApp();

  if (sessionStatus === 'restoring') {
    return <ThemedView style={styles.page}><LoadingState /></ThemedView>;
  }
  if (!user?.roles.includes(UserRole.Admin)) {
    return <Redirect href={user ? '/explore' : '/account'} />;
  }

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader eyebrow="Restricted administration" title="Administration" />
          <AdminPanel />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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