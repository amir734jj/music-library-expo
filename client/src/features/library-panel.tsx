import type { ArtistSubscriptionSummary, UserAlertSummary } from '@music-library/core';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ActionButton, EmptyState, LoadingState, Row, SectionHeader } from '@/components/music-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/providers/app-provider';
import { api } from '@/services/api';

export type LibraryMode = 'alerts' | 'following' | 'ripping' | 'saved';

export function LibraryPanel({ mode }: { mode: LibraryMode }) {
  const router = useRouter();
  const theme = useTheme();
  const {
    cacheLocation,
    clearOfflineTracks,
    offlineTracks,
    playAllOfflineTracks,
    playOfflineTrack,
    removeOfflineTrack,
    sessionStatus,
    stationRipSubscriptions,
    toggleStationRipping,
    user,
  } = useApp();
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
    return <View><SectionHeader count={offlineTracks.length} title="Cached on this device" />{cacheLocation && <ThemedText style={styles.location} themeColor="textSecondary">{cacheLocation}</ThemedText>}<View style={styles.cacheActions}><ActionButton disabled={offlineTracks.length === 0} label="Play all" onPress={() => void playAllOfflineTracks()} /><ActionButton danger disabled={offlineTracks.length === 0} label="Clear cache" onPress={() => void clearOfflineTracks()} /></View>{offlineTracks.length === 0 && <EmptyState>Tracks you cache from Trending, station history, or desktop ripping appear here.</EmptyState>}{offlineTracks.map((track) => <Row key={track.key}><View style={styles.rowTop}><View style={styles.copy}><ThemedText numberOfLines={1} style={styles.title}>{track.name.replace(/\.[^.]+$/i, '')}</ThemedText><ThemedText themeColor="textSecondary">{track.stationName || 'Music Library'}  |  {(track.size / 1_048_576).toFixed(1)} MB</ThemedText></View><View style={styles.actions}><ActionButton label="Play" onPress={() => void playOfflineTrack(track)} /><ActionButton danger label="Remove" onPress={() => void removeOfflineTrack(track.key)} /></View></View></Row>)}</View>;
  }

  if (mode === 'ripping') {
    return <View><SectionHeader count={stationRipSubscriptions.length} title="Stations being ripped" />{stationRipSubscriptions.length === 0 && <EmptyState>Choose Rip beside a station to start collecting complete songs.</EmptyState>}{stationRipSubscriptions.map((subscription) => <Row key={subscription.stationId}><View style={styles.rowTop}><View style={styles.copy}><ThemedText style={styles.title}>{subscription.stationName}</ThemedText><ThemedText themeColor="textSecondary">Saving new tracks to Music/Music Library</ThemedText></View><ActionButton danger label="Stop ripping" onPress={() => void toggleStationRipping(subscription.stationId, subscription.stationName)} /></View></Row>)}</View>;
  }

  if (sessionStatus === 'restoring') return <LoadingState />;
  if (!user) {
    return (
      <View style={styles.signedOut}>
        <EmptyState>Sign in to follow artists and receive alerts.</EmptyState>
        <ActionButton label="Sign in or create an account" onPress={() => router.push('/account')} />
      </View>
    );
  }
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
  cacheActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginVertical: Spacing.three },
  copy: { flex: 1, minWidth: 180 },
  error: { color: Palette.danger, paddingVertical: Spacing.three },
  input: { borderBottomColor: Palette.line, borderBottomWidth: 1, flex: 1, fontSize: 16, minHeight: 42, minWidth: 180, paddingHorizontal: Spacing.two },
  location: { marginTop: Spacing.one },
  rowTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  signedOut: { alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 15, fontWeight: '800' },
});