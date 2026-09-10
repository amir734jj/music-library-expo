import type { AudioSource, OfflineTrack, SaveTrackInput, TrackStorage } from '@music-library/core';
import { invoke } from '@tauri-apps/api/core';

const DATABASE_NAME = 'music-library';
const STORE_NAME = 'offline-tracks';

interface StoredWebTrack extends OfflineTrack { data: Blob }

const isTauri = typeof window !== 'undefined'
  && ('__TAURI_INTERNALS__' in window || window.location.hostname === 'tauri.localhost');

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  }).finally(() => database.close());
}

export const trackStorage: TrackStorage = {
  async clear(): Promise<void> {
    if (isTauri) {
      await invoke('clear_offline_tracks');
      return;
    }
    await transaction('readwrite', (store) => store.clear());
  },
  async save(input: SaveTrackInput): Promise<OfflineTrack> {
    const data = input.data instanceof Blob ? input.data : new Blob([input.data], { type: input.contentType });
    if (isTauri) {
      return invoke<OfflineTrack>('save_offline_track', {
        content: Array.from(new Uint8Array(await data.arrayBuffer())),
        fileName: input.filename,
        stationName: input.stationName,
      });
    }
    const track: OfflineTrack = { contentType: input.contentType || data.type || undefined, key: `${Date.now()}-${input.filename}`, name: input.filename, savedAt: new Date().toISOString(), size: data.size, stationName: input.stationName };
    await transaction('readwrite', (store) => store.put({ ...track, data } satisfies StoredWebTrack));
    return track;
  },
  async list(): Promise<OfflineTrack[]> {
    if (isTauri) {
      const tracks = await invoke<OfflineTrack[]>('list_offline_tracks');
      return tracks.map((track) => ({
        ...track,
        savedAt: new Date(Number(track.savedAt)).toISOString(),
      }));
    }
    const rows = await transaction<StoredWebTrack[]>('readonly', (store) => store.getAll());
    return rows.map(({ data: _, ...track }) => track).sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  },
  async resolve(key: string): Promise<AudioSource> {
    if (isTauri) {
      const content = await invoke<number[]>('read_offline_track', { key });
      return { blob: new Blob([new Uint8Array(content)]), kind: 'blob' };
    }
    const row = await transaction<StoredWebTrack | undefined>('readonly', (store) => store.get(key));
    if (!row) throw new Error('Saved track not found.');
    return { blob: row.data, kind: 'blob' };
  },
  async delete(key: string): Promise<void> {
    if (isTauri) {
      await invoke('delete_offline_track', { key });
      return;
    }
    await transaction('readwrite', (store) => store.delete(key));
  },
  async getDisplayLocation(): Promise<string | null> {
    if (isTauri) return invoke<string>('offline_track_location');
    return 'This device';
  },
};