import type { ArtistSubscriptionSummary, UserAlertSummary } from '@music-library/core';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ActionButton, EmptyState, LoadingState, Row, SectionHeader } from '@/components/music-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { trackStorage } from '@/platform/track-storage';
import { useApp } from '@/providers/app-provider';
import { api } from '@/services/api';

export type LibraryMode = 'alerts' | 'following' | 'saved';

export function LibraryPanel({ mode }: { mode: LibraryMode }) {
  const theme = useTheme();
  const { offlineTracks, play, removeOfflineTrack, sessionStatus, user } = useApp();
  const [alerts, setAlerts] = useState<UserAlertSummary[]>([]);
  const [artistName, setArtistName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<ArtistSubscriptionSummary[]>([]);

  async function load(): Promise<void> {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [subscriptionRows, alertRows] = await Promise.all([api.subscriptions(), api.alerts()]);
      setSubscriptions(subscriptionRows);
      setAlerts(alertRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your library.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [user]);

  async function addSubscription(): Promise<void> {
    if (!artistName.trim()) return;
    try {
      await api.createSubscription({ artistName: artistName.trim(), captureEnabled: true });
      setArtistName('');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not follow this artist.');
    }
  }

  if (mode === 'saved') {
    return <View><SectionHeader count={offlineTracks.length} title="Saved on this device" />{offlineTracks.length === 0 && <EmptyState>Tracks you save from Trending or station history appear here.</EmptyState>}{offlineTracks.map((track) => <Row key={track.key}><View style={styles.rowTop}><View style={styles.copy}><ThemedText numberOfLines={1} style={styles.title}>{track.name.replace(/\.mp3$/i, '')}</ThemedText><ThemedText themeColor="textSecondary">{track.stationName || 'Music Library'}  |  {(track.size / 1_048_576).toFixed(1)} MB</ThemedText></View><View style={styles.actions}><ActionButton label="Play" onPress={() => void trackStorage.resolve(track.key).then((source) => play({ description: track.name, isLive: false, source, stationName: track.stationName, title: track.name.replace(/\.mp3$/i, '') }))} /><ActionButton danger label="Remove" onPress={() => void removeOfflineTrack(track.key)} /></View></View></Row>)}</View>;
  }

  if (sessionStatus === 'restoring') return <LoadingState />;
  if (!user) return <EmptyState>Sign in from Account to follow artists and receive alerts.</EmptyState>;
  if (loading) return <LoadingState />;

  return (
    <View>
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      {mode === 'following' && <><SectionHeader count={subscriptions.length} title="Followed artists" /><ThemedView type="backgroundElement" style={styles.addRow}><TextInput onChangeText={setArtistName} placeholder="Artist name" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} value={artistName} /><ActionButton disabled={!artistName.trim()} label="Follow and capture" onPress={() => void addSubscription()} /></ThemedView>{subscriptions.length === 0 && <EmptyState>You are not following any artists yet.</EmptyState>}{subscriptions.map((subscription) => <Row key={subscription.id}><View style={styles.rowTop}><View style={styles.copy}><ThemedText style={styles.title}>{subscription.artistName}</ThemedText><ThemedText themeColor="textSecondary">{subscription.captureEnabled ? 'Automatic capture enabled' : 'Alerts only'}</ThemedText></View><ActionButton danger label="Unfollow" onPress={() => void api.deleteSubscription(subscription.id).then(load)} /></View></Row>)}</>}
      {mode === 'alerts' && <><SectionHeader count={alerts.length} title="Artist alerts" />{alerts.length === 0 && <EmptyState>No followed artists have been heard recently.</EmptyState>}{alerts.map((alert) => <Row key={alert.id}><ThemedText style={styles.title}>{alert.artistName}{alert.trackTitle ? ` - ${alert.trackTitle}` : ''}</ThemedText><ThemedText themeColor="textSecondary">{alert.stationName}  |  {new Date(alert.observedAt).toLocaleString()}</ThemedText></Row>)}</>}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  addRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three, padding: Spacing.three },
  copy: { flex: 1, minWidth: 180 },
  error: { color: Palette.danger, paddingVertical: Spacing.three },
  input: { borderBottomColor: Palette.line, borderBottomWidth: 1, flex: 1, fontSize: 16, minHeight: 42, minWidth: 180, paddingHorizontal: Spacing.two },
  rowTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  title: { fontSize: 15, fontWeight: '800' },
});