import type { AudioSource, OfflineTrack, SaveTrackInput, TrackStorage } from '@music-library/core';
import { Directory, File, Paths } from 'expo-file-system';

const directory = new Directory(Paths.document, 'offline-tracks');
const indexFile = new File(directory, 'index.json');

function safeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'track.mp3';
}

function ensureDirectory(): void {
  directory.create({ idempotent: true, intermediates: true });
}

function readIndex(): OfflineTrack[] {
  ensureDirectory();
  if (!indexFile.exists) return [];
  try {
    return JSON.parse(indexFile.textSync()) as OfflineTrack[];
  } catch {
    return [];
  }
}

function writeIndex(tracks: OfflineTrack[]): void {
  ensureDirectory();
  indexFile.create({ overwrite: true });
  indexFile.write(JSON.stringify(tracks));
}

export const trackStorage: TrackStorage = {
  async save(input: SaveTrackInput): Promise<OfflineTrack> {
    const key = `${Date.now()}-${safeFilename(input.filename)}`;
    const data = input.data instanceof Blob ? input.data : new Blob([input.data], { type: input.contentType });
    const track: OfflineTrack = { contentType: input.contentType || data.type || undefined, key, name: input.filename, savedAt: new Date().toISOString(), size: data.size, stationName: input.stationName };
    ensureDirectory();
    const file = new File(directory, key);
    file.create({ overwrite: true });
    file.write(new Uint8Array(await data.arrayBuffer()));
    writeIndex([track, ...readIndex().filter((item) => item.key !== key)]);
    return track;
  },
  async list(): Promise<OfflineTrack[]> {
    return readIndex();
  },
  async resolve(key: string): Promise<AudioSource> {
    const file = new File(directory, key);
    if (!file.exists) throw new Error('Saved track not found.');
    return { contentType: file.type || undefined, kind: 'local', uri: file.uri };
  },
  async delete(key: string): Promise<void> {
    const file = new File(directory, key);
    if (file.exists) file.delete();
    writeIndex(readIndex().filter((track) => track.key !== key));
  },
  async getDisplayLocation(): Promise<string | null> {
    return directory.uri;
  },
};