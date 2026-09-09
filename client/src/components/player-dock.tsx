import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Spacing } from '@/constants/theme';
import { useApp } from '@/providers/app-provider';

export function PlayerDock() {
  const { clearError, currentTrack, error, isBuffering, isPlaying, stop, togglePlayback } = useApp();
  if (!currentTrack && !error) return null;
  return <View style={styles.container}>{error && <View style={styles.feedback}><ThemedText numberOfLines={2} style={styles.feedbackText}>{error}</ThemedText><Pressable accessibilityLabel="Dismiss message" onPress={clearError} style={styles.stop}><ThemedText style={styles.feedbackClose}>X</ThemedText></Pressable></View>}{currentTrack && <ThemedView type="backgroundElement" style={styles.dock}><View style={styles.liveMarker} /><View style={styles.copy}><ThemedText numberOfLines={1} style={styles.title}>{currentTrack.title}</ThemedText><ThemedText numberOfLines={1} style={styles.subtitle} themeColor="textSecondary">{currentTrack.artist || currentTrack.stationName || (currentTrack.isLive ? 'Live station' : 'Saved track')}</ThemedText></View><Pressable accessibilityLabel={isPlaying ? 'Pause' : 'Play'} onPress={togglePlayback} style={styles.control}><ThemedText style={styles.controlText}>{isBuffering ? '...' : isPlaying ? 'II' : '>'}</ThemedText></Pressable><Pressable accessibilityLabel="Stop playback" onPress={() => void stop()} style={styles.stop}><ThemedText style={styles.stopText}>X</ThemedText></Pressable></ThemedView>}</View>;
}

const styles = StyleSheet.create({
  control: { alignItems: 'center', backgroundColor: Palette.accent, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  controlText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  container: { alignItems: 'center', bottom: 88, gap: Spacing.two, left: Spacing.three, position: 'absolute', right: Spacing.three, zIndex: 20 },
  copy: { flex: 1, minWidth: 0 },
  dock: { alignItems: 'center', borderColor: Palette.line, borderRadius: 6, borderWidth: 1, elevation: 8, flexDirection: 'row', gap: Spacing.three, maxWidth: 620, padding: 12, shadowColor: '#000000', shadowOpacity: 0.14, shadowRadius: 14, width: '100%' },
  feedback: { alignItems: 'center', backgroundColor: Palette.danger, borderRadius: 4, flexDirection: 'row', gap: Spacing.two, maxWidth: 620, paddingHorizontal: 12, paddingVertical: 8, width: '100%' },
  feedbackClose: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  feedbackText: { color: '#FFFFFF', flex: 1, fontSize: 13, fontWeight: '700' },
  liveMarker: { backgroundColor: Palette.gold, borderRadius: 4, height: 8, width: 8 },
  stop: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  stopText: { fontSize: 12, fontWeight: '900' },
  subtitle: { fontSize: 12 },
  title: { fontSize: 14, fontWeight: '800' },
});