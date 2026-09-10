import { UserRole } from '@music-library/core';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader, SegmentControl } from '@/components/music-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { AdminPanel } from '@/features/admin-panel';
import { LibraryPanel, type LibraryMode } from '@/features/library-panel';
import { useApp } from '@/providers/app-provider';

type WorkspaceMode = LibraryMode | 'admin';

export default function LibraryScreen() {
  const { offlineTracks, user } = useApp();
  const [mode, setMode] = useState<WorkspaceMode>('saved');
  const isAdmin = user?.roles.includes(UserRole.Admin) ?? false;
  const options: readonly { label: string; value: WorkspaceMode }[] = [
    { label: `Saved (${offlineTracks.length})`, value: 'saved' },
    { label: 'Following', value: 'following' },
    { label: 'Alerts', value: 'alerts' },
    ...(isAdmin ? [{ label: 'Admin', value: 'admin' as const }] : []),
  ];

  useEffect(() => {
    if (mode === 'admin' && !isAdmin) setMode('saved');
  }, [isAdmin, mode]);

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader
            eyebrow={user ? `Signed in as ${user.displayName || user.email}` : 'Your collection'}
            title="Library"
            trailing={<View style={styles.status}><View style={[styles.statusDot, { backgroundColor: user ? Palette.accent : Palette.gold }]} /><ThemedText style={styles.statusText}>{user ? 'Synced' : 'Local only'}</ThemedText></View>}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            <View style={styles.tabs}><SegmentControl options={options} onChange={setMode} value={mode} /></View>
          </ScrollView>
          <View style={styles.workspace}>
            {(mode === 'saved' || mode === 'following' || mode === 'alerts') && <LibraryPanel mode={mode} />}
            {mode === 'admin' && isAdmin && <AdminPanel />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', gap: Spacing.four, maxWidth: 1180, paddingBottom: BottomTabInset + 140, paddingHorizontal: Spacing.four, paddingTop: 74, width: '100%' },
  page: { flex: 1 },
  safeArea: { flex: 1 },
  status: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  statusDot: { borderRadius: 4, height: 8, width: 8 },
  statusText: { fontSize: 12, fontWeight: '800' },
  tabs: { minWidth: 560 },
  tabScroll: { flexGrow: 1 },
  workspace: { minHeight: 380 },
});