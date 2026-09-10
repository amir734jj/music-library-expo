import type {
  AudioSource,
  LoginRequest,
  OfflineTrack,
  RegisterRequest,
  UserResponse,
} from '@music-library/core';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { authenticationStorage } from '@/platform/authentication-storage';
import { trackStorage } from '@/platform/track-storage';
import { api } from '@/services/api';
import { desktopRipper, type StationRipSubscription } from '@/services/desktop-ripper';

export interface PlayableItem {
  artist?: string | null;
  description: string;
  isLive: boolean;
  source: AudioSource;
  stationId?: string;
  stationName?: string;
  title: string;
}

interface AppContextValue {
  currentTrack: PlayableItem | null;
  clearError(): void;
  desktopRippingSupported: boolean;
  error: string | null;
  isBuffering: boolean;
  isPlaying: boolean;
  offlineTracks: OfflineTrack[];
  play(item: PlayableItem): Promise<void>;
  refreshOfflineTracks(): Promise<void>;
  removeOfflineTrack(key: string): Promise<void>;
  saveTrack(cachedTrackId: string, filename: string, stationName?: string): Promise<void>;
  sessionStatus: 'anonymous' | 'authenticated' | 'restoring';
  signIn(input: LoginRequest): Promise<void>;
  signOut(): Promise<void>;
  signUp(input: RegisterRequest): Promise<UserResponse>;
  stationRipSubscriptions: StationRipSubscription[];
  stop(): Promise<void>;
  togglePlayback(): void;
  toggleStationRipping(stationId: string, stationName: string): Promise<void>;
  user: UserResponse | null;
}

const AppContext = createContext<AppContextValue | null>(null);

function sourceUri(source: AudioSource): string {
  if (source.kind === 'blob') {
    return URL.createObjectURL(source.blob);
  }
  return source.uri;
}

export function AppProvider({ children }: PropsWithChildren) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const playerStatus = useAudioPlayerStatus(player);
  const [currentTrack, setCurrentTrack] = useState<PlayableItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blobUrl = useRef<string | null>(null);
  const [offlineTracks, setOfflineTracks] = useState<OfflineTrack[]>([]);
  const [sessionStatus, setSessionStatus] = useState<AppContextValue['sessionStatus']>('restoring');
  const [stationRipSubscriptions, setStationRipSubscriptions] = useState<StationRipSubscription[]>([]);
  const [user, setUser] = useState<UserResponse | null>(null);

  async function clearSession(): Promise<void> {
    player.pause();
    player.clearLockScreenControls();
    setCurrentTrack(null);
    setUser(null);
    setSessionStatus('anonymous');
    api.setAccessToken(null);
    await authenticationStorage.clear();
  }

  useEffect(() => {
    api.onUnauthorized(clearSession);
    setAudioModeAsync({
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch(() => undefined);

    authenticationStorage.load().then(async (stored) => {
      if (!stored || new Date(stored.expiresAt) <= new Date()) {
        await clearSession();
        return;
      }
      api.setAccessToken(stored.accessToken);
      try {
        setUser(await api.me());
        setSessionStatus('authenticated');
      } catch {
        await clearSession();
      }
    });
    refreshOfflineTracks().catch(() => undefined);
    const unsubscribe = desktopRipper.subscribe(setStationRipSubscriptions);
    desktopRipper.initialize().catch((initializeError: unknown) => {
      setError(initializeError instanceof Error ? initializeError.message : 'Desktop ripping could not start.');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentTrack || !playerStatus.playing || !user) {
      return;
    }

    const heartbeat = () => api.updatePlaybackActivity({
      isLiveStation: currentTrack.isLive,
      playbackDescription: currentTrack.description,
    }).catch(() => undefined);
    heartbeat();
    const interval = setInterval(heartbeat, 45_000);
    return () => clearInterval(interval);
  }, [currentTrack, playerStatus.playing, user]);

  useEffect(() => {
    const stationId = currentTrack?.isLive ? currentTrack.stationId : undefined;
    if (!stationId) return;

    let active = true;
    const refreshMetadata = async () => {
      try {
        const metadata = await api.stationNowPlaying(stationId);
        if (!active) return;
        const title = metadata.title || metadata.rawMetadata || metadata.stationName;
        const description = `${[metadata.artist, title].filter(Boolean).join(' - ')} on ${metadata.stationName}`;
        setCurrentTrack((playing) => {
          if (!playing?.isLive || playing.stationId !== stationId) return playing;
          if (playing.artist === metadata.artist
            && playing.description === description
            && playing.stationName === metadata.stationName
            && playing.title === title) return playing;
          return { ...playing, artist: metadata.artist, description, stationName: metadata.stationName, title };
        });
        player.setActiveForLockScreen(true, {
          albumTitle: metadata.stationName,
          artist: metadata.artist ?? metadata.stationName,
          title,
        }, { isLiveStream: true });
      } catch {
        // Keep playing when a station has not published metadata yet.
      }
    };

    void refreshMetadata();
    const interval = setInterval(() => void refreshMetadata(), 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentTrack?.isLive, currentTrack?.stationId, player]);

  async function signIn(input: LoginRequest): Promise<void> {
    setError(null);
    const response = await api.login(input);
    api.setAccessToken(response.accessToken);
    await authenticationStorage.save({
      accessToken: response.accessToken,
      expiresAt: response.expiresAt,
      userId: response.user.id,
    });
    setUser(response.user);
    setSessionStatus('authenticated');
  }

  async function signUp(input: RegisterRequest): Promise<UserResponse> {
    setError(null);
    const response = await api.register(input);
    return response.user;
  }

  async function signOut(): Promise<void> {
    await api.clearPlaybackActivity().catch(() => undefined);
    await clearSession();
  }

  async function play(item: PlayableItem): Promise<void> {
    setError(null);
    try {
      if (blobUrl.current) {
        URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = null;
      }
      const uri = sourceUri(item.source);
      if (item.source.kind === 'blob') blobUrl.current = uri;
      player.replace({ uri });
      player.setActiveForLockScreen(true, {
        albumTitle: item.stationName,
        artist: item.artist ?? item.stationName,
        title: item.title,
      }, { isLiveStream: item.isLive });
      player.play();
      setCurrentTrack(item);
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Playback could not start.');
    }
  }

  function togglePlayback(): void {
    if (!currentTrack) {
      return;
    }
    if (playerStatus.playing) {
      player.pause();
      api.clearPlaybackActivity().catch(() => undefined);
    } else {
      player.play();
    }
  }

  async function stop(): Promise<void> {
    player.pause();
    player.clearLockScreenControls();
    setCurrentTrack(null);
    if (blobUrl.current) {
      URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = null;
    }
    if (user) {
      await api.clearPlaybackActivity().catch(() => undefined);
    }
  }

  async function refreshOfflineTracks(): Promise<void> {
    setOfflineTracks(await trackStorage.list());
  }

  async function saveTrack(cachedTrackId: string, filename: string, stationName?: string): Promise<void> {
    setError(null);
    try {
      const response = await fetch(api.cachedTrackUrl(cachedTrackId));
      if (!response.ok) throw new Error('The cached track could not be downloaded.');
      await trackStorage.save({
        contentType: response.headers.get('content-type') ?? undefined,
        data: await response.blob(),
        filename,
        stationName,
      });
      await refreshOfflineTracks();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The track could not be saved.');
    }
  }

  async function removeOfflineTrack(key: string): Promise<void> {
    await trackStorage.delete(key);
    await refreshOfflineTracks();
  }

  async function toggleStationRipping(stationId: string, stationName: string): Promise<void> {
    setError(null);
    try {
      await desktopRipper.toggle(stationId, stationName);
    } catch (ripError) {
      setError(ripError instanceof Error ? ripError.message : 'The station ripping setting could not be changed.');
    }
  }

  return (
    <AppContext.Provider value={{
      clearError: () => setError(null),
      currentTrack,
      desktopRippingSupported: desktopRipper.supported,
      error,
      isBuffering: playerStatus.isBuffering,
      isPlaying: playerStatus.playing,
      offlineTracks,
      play,
      refreshOfflineTracks,
      removeOfflineTrack,
      saveTrack,
      sessionStatus,
      signIn,
      signOut,
      signUp,
      stationRipSubscriptions,
      stop,
      togglePlayback,
      toggleStationRipping,
      user,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider.');
  }
  return context;
}