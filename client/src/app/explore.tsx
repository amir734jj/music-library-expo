import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, ScreenHeader, SegmentControl } from '@/components/music-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { LibraryPanel, type LibraryMode } from '@/features/library-panel';
import { useApp } from '@/providers/app-provider';

export default function LibraryScreen() {
  const router = useRouter();
  const { desktopRippingSupported, deviceCacheSupported, exitOfflineMode, offlineTracks, sessionStatus, stationRipSubscriptions, user } = useApp();
  const [mode, setMode] = useState<LibraryMode>(deviceCacheSupported ? 'saved' : 'following');
  const isOffline = sessionStatus === 'offline';
  const onlineOptions: readonly { label: string; value: LibraryMode }[] = [
    ...(deviceCacheSupported ? [{ label: `Cached (${offlineTracks.length})`, value: 'saved' as const }] : []),
    ...(desktopRippingSupported ? [{ label: `Ripping (${stationRipSubscriptions.length})`, value: 'ripping' as const }] : []),
    { label: 'Following', value: 'following' },
    { label: 'Alerts', value: 'alerts' },
  ];
  const options = isOffline
    ? onlineOptions.filter((option) => option.value === 'saved')
    : onlineOptions;

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader
            eyebrow={isOffline ? 'Available without a connection' : user ? `Signed in as ${user.displayName || user.email}` : 'Your collection'}
            title={isOffline ? 'Cached locally' : 'Library'}
            trailing={isOffline ? <ActionButton label="Return to sign in" quiet onPress={() => { exitOfflineMode(); router.replace('/account'); }} /> : <View style={styles.status}><View style={[styles.statusDot, { backgroundColor: user ? Palette.accent : Palette.gold }]} /><ThemedText style={styles.statusText}>{user ? 'Synced' : 'Local only'}</ThemedText></View>}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            <View style={styles.tabs}><SegmentControl options={options} onChange={setMode} value={mode} /></View>
          </ScrollView>
          <View style={styles.workspace}>
            <LibraryPanel mode={mode} />
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