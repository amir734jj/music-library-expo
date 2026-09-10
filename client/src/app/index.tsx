import type { NowPlayingSummary, StationCachedTrackSummary, StationSummary, TrendingSummary, UserPlaybackActivitySummary } from '@music-library/core';
import { useDeferredValue, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, EmptyState, LoadingState, Row, ScreenHeader, SearchField, SectionHeader, SegmentControl } from '@/components/music-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { useApp } from '@/providers/app-provider';
import { api } from '@/services/api';

type DiscoverMode = 'air' | 'stations' | 'trending';
const DISCOVER_PAGE_SIZE = 20;
const LIVE_REFRESH_INTERVAL_MS = 5_000;
const modes = [
  { label: 'On air', value: 'air' },
  { label: 'Stations', value: 'stations' },
  { label: 'Trending', value: 'trending' },
] as const;

function trackName(artist: string | null, title: string | null, fallback: string): string {
  return [artist, title].filter(Boolean).join(' - ') || fallback;
}

function playedTime(observedAt: string, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(observedAt).getTime()) / 1_000));
  if (elapsedSeconds < 15) return 'Played just now';
  if (elapsedSeconds < 60) return `Played ${elapsedSeconds} seconds ago`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `Played ${elapsedMinutes} ${elapsedMinutes === 1 ? 'minute' : 'minutes'} ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Played ${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'} ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Played ${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`;
}

export default function DiscoverScreen() {
  const {
    currentTrack,
    desktopRippingSupported,
    isPlaying,
    play,
    saveTrack,
    sessionStatus,
    stationRipSubscriptions,
    toggleStationRipping,
    user,
  } = useApp();
  const [activity, setActivity] = useState<UserPlaybackActivitySummary[]>([]);
  const [cachedTracks, setCachedTracks] = useState<StationCachedTrackSummary[]>([]);
  const [catalogRefreshAttempts, setCatalogRefreshAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<DiscoverMode>('air');
  const [now, setNow] = useState(Date.now());
  const [nowPlaying, setNowPlaying] = useState<NowPlayingSummary[]>([]);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationSummary | null>(null);
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [trending, setTrending] = useState<TrendingSummary[]>([]);
  const [visibleCount, setVisibleCount] = useState(DISCOVER_PAGE_SIZE);

  async function load(showSpinner = false, quietly = false): Promise<void> {
    if (sessionStatus === 'offline') return;
    if (showSpinner) setRefreshing(true);
    else if (!quietly) setLoading(true);
    setError(null);
    try {
      const [stationRows, onAirRows, trendingRows, activityRows] = await Promise.all([
        api.stations(deferredQuery), api.nowPlaying(deferredQuery), api.trending(deferredQuery), api.playbackActivity(),
      ]);
      setStations(stationRows);
      setNowPlaying(onAirRows);
      setTrending(trendingRows);
      setActivity(activityRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not reach the music library.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (sessionStatus === 'offline') return;
    const timeout = setTimeout(() => void load(), 180);
    return () => clearTimeout(timeout);
  }, [deferredQuery, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === 'offline' || loading || error || deferredQuery || stations.length > 0 || catalogRefreshAttempts >= 6) return;
    const timeout = setTimeout(() => {
      setCatalogRefreshAttempts((attempts) => attempts + 1);
      void load(false, true);
    }, 5_000);
    return () => clearTimeout(timeout);
  }, [catalogRefreshAttempts, deferredQuery, error, loading, sessionStatus, stations.length]);

  useEffect(() => {
    if (sessionStatus === 'offline') return;
    let active = true;
    let refreshingLiveData = false;
    const refreshLiveData = async () => {
      if (refreshingLiveData) return;
      refreshingLiveData = true;
      try {
        const activityRequest = api.playbackActivity();
        if (mode === 'air') {
          const [onAirResult, activityResult] = await Promise.allSettled([
            api.nowPlaying(deferredQuery),
            activityRequest,
          ]);
          if (active && onAirResult.status === 'fulfilled') setNowPlaying(onAirResult.value);
          if (active && activityResult.status === 'fulfilled') setActivity(activityResult.value);
          return;
        }
        if (mode === 'trending') {
          const [trendingResult, activityResult] = await Promise.allSettled([
            api.trending(deferredQuery),
            activityRequest,
          ]);
          if (active && trendingResult.status === 'fulfilled') setTrending(trendingResult.value);
          if (active && activityResult.status === 'fulfilled') setActivity(activityResult.value);
          return;
        }
        const [stationResult, activityResult, cachedTrackResult] = await Promise.allSettled([
          api.stations(deferredQuery),
          activityRequest,
          selectedStation ? api.stationCachedTracks(selectedStation.id) : Promise.resolve(null),
        ]);
        if (active && stationResult.status === 'fulfilled') {
          setStations(stationResult.value);
          setSelectedStation((selected) => {
            if (!selected) return null;
            return stationResult.value.find((station) => station.id === selected.id) ?? selected;
          });
        }
        if (active && activityResult.status === 'fulfilled') setActivity(activityResult.value);
        if (active && cachedTrackResult.status === 'fulfilled' && cachedTrackResult.value) {
          setCachedTracks(cachedTrackResult.value);
        }
      } catch {
        // Keep the last successful snapshot while a refresh is temporarily unavailable.
      } finally {
        refreshingLiveData = false;
      }
    };
    void refreshLiveData();
    const interval = setInterval(() => void refreshLiveData(), LIVE_REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [deferredQuery, mode, selectedStation?.id, sessionStatus]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setVisibleCount(DISCOVER_PAGE_SIZE);
  }, [deferredQuery, mode]);

  async function selectStation(station: StationSummary): Promise<void> {
    setSelectedStation(station);
    setCachedTracks(await api.stationCachedTracks(station.id).catch(() => []));
  }

  async function playStation(stationId: string, stationName: string, title: string, artist?: string | null): Promise<void> {
    const ticket = await api.createStreamTicket(stationId);
    await play({
      artist,
      description: `${trackName(artist ?? null, title, stationName)} on ${stationName}`,
      isLive: true,
      source: { isLive: true, kind: 'remote', uri: api.absoluteUrl(ticket.path) },
      stationId,
      stationName,
      title,
    });
  }

  const emptyCatalogMessage = catalogRefreshAttempts < 6
    ? 'The station catalog is still initializing.'
    : 'The station catalog is unavailable. An administrator can retry the directory import.';
  const isRipping = (stationId: string) => stationRipSubscriptions.some((subscription) => subscription.stationId === stationId);
  const ripAction = (stationId: string, stationName: string) => desktopRippingSupported && user
    ? <ActionButton label={isRipping(stationId) ? 'Ripping' : 'Rip'} quiet={!isRipping(stationId)} onPress={() => void toggleStationRipping(stationId, stationName)} />
    : null;
  const visibleActivity = activity.filter((listener) => listener.userId !== user?.id || (currentTrack && isPlaying));

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Palette.accent} />}>
          <ScreenHeader eyebrow="Independent radio index" title="Find what is playing" />
          <SearchField onChangeText={setQuery} placeholder="Search stations, artists, or tracks" value={query} />
          <SegmentControl options={modes} onChange={setMode} value={mode} />
          {error && <ThemedText style={styles.error}>{error}</ThemedText>}
          {loading ? <LoadingState /> : (
            <View style={styles.columns}>
              <View style={styles.primaryColumn}>
                {mode === 'air' && <><SectionHeader count={nowPlaying.length} title="On air now" />{nowPlaying.length === 0 && <EmptyState>{stations.length === 0 && !deferredQuery ? emptyCatalogMessage : 'No live metadata matched this search.'}</EmptyState>}{nowPlaying.slice(0, visibleCount).map((item) => <Row key={item.stationId}><View style={styles.rowTop}><View style={styles.rowCopy}><ThemedText numberOfLines={1} style={styles.itemTitle}>{trackName(item.artist, item.title, 'Metadata pending')}</ThemedText><ThemedText themeColor="textSecondary">{item.stationName}</ThemedText></View><View style={styles.actions}><ActionButton label="Listen" onPress={() => void playStation(item.stationId, item.stationName, item.title || item.stationName, item.artist)} />{ripAction(item.stationId, item.stationName)}</View></View><ThemedText style={styles.meta} themeColor="textSecondary">{playedTime(item.observedAt, now)}</ThemedText></Row>)}{nowPlaying.length > visibleCount && <View style={styles.loadMore}><ActionButton label="Load more" quiet onPress={() => setVisibleCount((count) => count + DISCOVER_PAGE_SIZE)} /></View>}</>}
                {mode === 'stations' && <><SectionHeader count={stations.length} title="Station directory" />{stations.length === 0 && <EmptyState>{deferredQuery ? 'No stations matched this search.' : emptyCatalogMessage}</EmptyState>}{stations.slice(0, visibleCount).map((station) => <Row key={station.id} onPress={() => void selectStation(station)} selected={selectedStation?.id === station.id}><View style={styles.rowTop}><View style={styles.rowCopy}><ThemedText style={styles.itemTitle}>{station.name}</ThemedText><ThemedText themeColor="textSecondary">{station.genre || 'Uncategorized'}</ThemedText></View><View style={styles.actions}><ActionButton label="Listen" onPress={() => void playStation(station.id, station.name, station.name)} />{ripAction(station.id, station.name)}</View></View></Row>)}{stations.length > visibleCount && <View style={styles.loadMore}><ActionButton label="Load more" quiet onPress={() => setVisibleCount((count) => count + DISCOVER_PAGE_SIZE)} /></View>}</>}
                {mode === 'trending' && <><SectionHeader count={trending.length} title="Trending across stations" />{trending.length === 0 && <EmptyState>{stations.length === 0 && !deferredQuery ? 'Trending will appear after stations are imported and probed.' : 'No trending tracks matched this search.'}</EmptyState>}{trending.slice(0, visibleCount).map((item, index) => <Row key={`${item.artist}-${item.title}-${index}`}><View style={styles.rowTop}><View style={styles.rank}><ThemedText style={styles.rankText}>{index + 1}</ThemedText></View><View style={styles.rowCopy}><ThemedText style={styles.itemTitle}>{trackName(item.artist, item.title, item.artist)}</ThemedText><ThemedText themeColor="textSecondary">{item.observationCount} plays on {item.stationCount} stations</ThemedText></View></View><View style={styles.actions}><ActionButton label="Play station" quiet onPress={() => void playStation(item.lastStationId, item.lastStationName, item.title || item.artist, item.artist)} />{item.cachedTrackId && <ActionButton label="Play cached" onPress={() => void play({ artist: item.artist, description: trackName(item.artist, item.title, item.artist), isLive: false, source: { isLive: false, kind: 'remote', uri: api.cachedTrackUrl(item.cachedTrackId!) }, stationName: item.lastStationName, title: item.title || item.artist })} />}{item.cachedTrackId && <ActionButton label="Save" quiet onPress={() => void saveTrack(item.cachedTrackId!, `${trackName(item.artist, item.title, item.artist)}.mp3`, item.lastStationName)} />}</View></Row>)}{trending.length > visibleCount && <View style={styles.loadMore}><ActionButton label="Load more" quiet onPress={() => setVisibleCount((count) => count + DISCOVER_PAGE_SIZE)} /></View>}</>}
              </View>
              <View style={styles.sideColumn}>
                <SectionHeader title={selectedStation ? selectedStation.name : 'Station detail'} />
                {!selectedStation ? <EmptyState>Select a station to inspect its recent cached tracks.</EmptyState> : <ThemedView type="backgroundElement" style={styles.detailPanel}><ThemedText themeColor="textSecondary">{selectedStation.genre || 'Uncategorized'}</ThemedText><View style={styles.actions}><ActionButton label="Listen" onPress={() => void playStation(selectedStation.id, selectedStation.name, selectedStation.name)} />{ripAction(selectedStation.id, selectedStation.name)}</View><SectionHeader count={cachedTracks.length} title="Recent captures" />{cachedTracks.map((track) => <View key={track.cachedTrackId} style={styles.miniRow}><ThemedText numberOfLines={1} style={styles.miniTitle}>{trackName(track.artist, track.title, track.artist)}</ThemedText><View style={styles.actions}><ActionButton label="Play" quiet onPress={() => void play({ artist: track.artist, description: trackName(track.artist, track.title, track.artist), isLive: false, source: { isLive: false, kind: 'remote', uri: api.cachedTrackUrl(track.cachedTrackId) }, stationName: selectedStation.name, title: track.title || track.artist })} /><ActionButton label="Save" quiet onPress={() => void saveTrack(track.cachedTrackId, `${trackName(track.artist, track.title, track.artist)}.mp3`, selectedStation.name)} /></View></View>)}</ThemedView>}
                <SectionHeader count={visibleActivity.length} title="Listening now" />
                {visibleActivity.length === 0 && <EmptyState>No listeners are currently sharing activity.</EmptyState>}
                {visibleActivity.map((listener) => <View key={listener.userId} style={styles.listenerRow}><View style={styles.presence} /><View style={styles.rowCopy}><ThemedText style={styles.listenerName}>{listener.userDisplayName}</ThemedText><ThemedText numberOfLines={2} style={styles.meta} themeColor="textSecondary">{listener.playbackDescription}</ThemedText></View></View>)}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  columns: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  content: { alignSelf: 'center', gap: Spacing.three, maxWidth: 1180, paddingBottom: BottomTabInset + 140, paddingHorizontal: Spacing.four, paddingTop: 74, width: '100%' },
  detailPanel: { gap: Spacing.three, padding: Spacing.three },
  error: { backgroundColor: '#FBE8E5', borderLeftColor: Palette.danger, borderLeftWidth: 3, color: Palette.danger, padding: Spacing.three },
  itemTitle: { fontSize: 16, fontWeight: '800' },
  loadMore: { alignItems: 'center', paddingTop: Spacing.three },
  listenerName: { fontSize: 13, fontWeight: '800' },
  listenerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.two },
  meta: { fontSize: 12 },
  miniRow: { borderTopColor: Palette.line, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two, paddingVertical: Spacing.two },
  miniTitle: { fontSize: 13, fontWeight: '700' },
  page: { flex: 1 },
  presence: { backgroundColor: Palette.accent, borderRadius: 4, height: 8, marginTop: 6, width: 8 },
  primaryColumn: { flex: 2, minWidth: 300 },
  rank: { alignItems: 'center', backgroundColor: Palette.gold, borderRadius: 3, height: 28, justifyContent: 'center', width: 28 },
  rankText: { color: Palette.ink, fontSize: 12, fontWeight: '900' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTop: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  safeArea: { flex: 1 },
  sideColumn: { flex: 1, minWidth: 270 },
});