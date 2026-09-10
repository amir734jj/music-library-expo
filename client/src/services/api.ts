import type {
  ArtistSubscriptionSummary,
  CreateSubscriptionRequest,
  DirectoryImportSummary,
  GlobalConfigModel,
  LiveStreamTicket,
  LoginAuthenticationResponse,
  LoginRequest,
  NowPlayingSummary,
  ProbeStatusSummary,
  RegisterRequest,
  RegistrationAuthenticationResponse,
  StationCachedTrackSummary,
  StationSummary,
  TrendingCacheStatusSummary,
  TrendingSummary,
  UpdateGlobalConfigRequest,
  UpdatePlaybackActivityRequest,
  UpdateStationProbeRequest,
  UpdateUserRequest,
  UserAlertSummary,
  UserPlaybackActivitySummary,
  UserResponse,
} from '@music-library/core';
import Constants from 'expo-constants';
import { isArray } from 'lodash-es';
import { Platform } from 'react-native';

type QueryValue = boolean | number | string | null | undefined;
type Query = Readonly<Record<string, QueryValue>>;
const PRODUCTION_API_ORIGIN = 'https://music-library.coolify.hesamian.com';

interface RequestOptions {
  authenticated?: boolean;
  body?: unknown;
  keepalive?: boolean;
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT';
  query?: Query;
}

interface NestErrorBody {
  error?: string;
  message?: string | string[];
  statusCode?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: NestErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function resolveApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (configuredUrl) {
    return configuredUrl.endsWith('/api') ? configuredUrl : `${configuredUrl}/api`;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { hostname, origin, port, protocol } = window.location;
    if (hostname === 'tauri.localhost') {
      return `${PRODUCTION_API_ORIGIN}/api`;
    }
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '3000') {
      return `${protocol}//${hostname}:3000/api`;
    }
    if (protocol === 'http:' || protocol === 'https:') {
      return `${origin}/api`;
    }
  }

  const developmentHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (__DEV__) {
    return `http://${developmentHost || 'localhost'}:3000/api`;
  }
  return `${PRODUCTION_API_ORIGIN}/api`;
}

function errorMessage(body: NestErrorBody | undefined, status: number): string {
  if (isArray(body?.message)) {
    return body.message.join('\n');
  }
  return body?.message || body?.error || `Request failed (${status})`;
}

export class MusicLibraryApi {
  readonly baseUrl = resolveApiBaseUrl();
  private accessToken: string | null = null;
  private unauthorizedHandler: (() => void | Promise<void>) | null = null;

  setAccessToken(accessToken: string | null): void {
    this.accessToken = accessToken;
  }

  onUnauthorized(handler: () => void | Promise<void>): void {
    this.unauthorizedHandler = handler;
  }

  absoluteUrl(path: string): string {
    if (/^https?:\/\//i.test(path) || path.startsWith('file:') || path.startsWith('blob:')) {
      return path;
    }
    const origin = this.baseUrl.replace(/\/api$/, '');
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    const headers: Record<string, string> = {};
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.authenticated && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      keepalive: options.keepalive,
      method: options.method ?? 'GET',
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined) as NestErrorBody | undefined;
      if (response.status === 401 && options.authenticated) {
        await this.unauthorizedHandler?.();
      }
      throw new ApiError(errorMessage(body, response.status), response.status, body);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  login(input: LoginRequest) {
    return this.request<LoginAuthenticationResponse>('/auth/login', { body: input, method: 'POST' });
  }

  register(input: RegisterRequest) {
    return this.request<RegistrationAuthenticationResponse>('/auth/register', { body: input, method: 'POST' });
  }

  me() {
    return this.request<UserResponse>('/auth/me', { authenticated: true });
  }

  stations(query = '') {
    return this.request<StationSummary[]>('/stations', { query: { query } });
  }

  nowPlaying(query = '') {
    return this.request<NowPlayingSummary[]>('/now-playing', { query: { query } });
  }

  stationNowPlaying(stationId: string) {
    return this.request<NowPlayingSummary>(`/now-playing/${stationId}`);
  }

  createStreamTicket(stationId: string) {
    return this.request<LiveStreamTicket>(`/now-playing/${stationId}/stream-ticket`, { method: 'POST' });
  }

  trending(query = '') {
    return this.request<TrendingSummary[]>('/trending', { query: { query } });
  }

  stationCachedTracks(stationId: string) {
    return this.request<StationCachedTrackSummary[]>(`/stations/${stationId}/cached-tracks`);
  }

  cachedTrackUrl(cachedTrackId: string) {
    return `${this.baseUrl}/trending/${cachedTrackId}/download`;
  }

  subscriptions() {
    return this.request<ArtistSubscriptionSummary[]>('/subscriptions', { authenticated: true });
  }

  createSubscription(input: CreateSubscriptionRequest) {
    return this.request<ArtistSubscriptionSummary>('/subscriptions', {
      authenticated: true,
      body: input,
      method: 'POST',
    });
  }

  deleteSubscription(id: string) {
    return this.request<void>(`/subscriptions/${id}`, { authenticated: true, method: 'DELETE' });
  }

  alerts() {
    return this.request<UserAlertSummary[]>('/alerts', { authenticated: true });
  }

  requestCapture(stationId: string) {
    return this.request<void>(`/stations/${stationId}/capture`, { authenticated: true, method: 'POST' });
  }

  playbackActivity() {
    return this.request<UserPlaybackActivitySummary[]>('/playback-activity');
  }

  updatePlaybackActivity(input: UpdatePlaybackActivityRequest) {
    return this.request<void>('/playback-activity', { authenticated: true, body: input, method: 'PUT' });
  }

  clearPlaybackActivity(keepalive = false) {
    return this.request<void>('/playback-activity', { authenticated: true, keepalive, method: 'DELETE' });
  }

  adminUsers() {
    return this.request<UserResponse[]>('/admin/users', { authenticated: true });
  }

  updateAdminUser(id: string, input: UpdateUserRequest) {
    return this.request<void>(`/admin/users/${id}`, { authenticated: true, body: input, method: 'PUT' });
  }

  deleteAdminUser(id: string) {
    return this.request<void>(`/admin/users/${id}`, { authenticated: true, method: 'DELETE' });
  }

  adminConfig() {
    return this.request<GlobalConfigModel>('/admin/config', { authenticated: true });
  }

  updateAdminConfig(input: UpdateGlobalConfigRequest) {
    return this.request<void>('/admin/config', { authenticated: true, body: input, method: 'PUT' });
  }

  cacheStatus() {
    return this.request<TrendingCacheStatusSummary>('/admin/cache/status', { authenticated: true });
  }

  clearCache() {
    return this.request<void>('/admin/cache', { authenticated: true, method: 'DELETE' });
  }

  adminStations() {
    return this.request<StationSummary[]>('/admin/stations', { authenticated: true });
  }

  updateStationProbe(stationId: string, input: UpdateStationProbeRequest) {
    return this.request<void>(`/admin/stations/${stationId}/probe`, {
      authenticated: true,
      body: input,
      method: 'PUT',
    });
  }

  updateAllStationProbes(input: UpdateStationProbeRequest) {
    return this.request<number>('/admin/stations/probe', {
      authenticated: true,
      body: input,
      method: 'PUT',
    });
  }

  probeStatus(query = '', page = 1, pageSize = 25) {
    return this.request<ProbeStatusSummary>('/admin/probes/status', {
      authenticated: true,
      query: { page, pageSize, query },
    });
  }

  importStations() {
    return this.request<DirectoryImportSummary>('/admin/stations/import', {
      authenticated: true,
      method: 'POST',
    });
  }
}

export const api = new MusicLibraryApi();