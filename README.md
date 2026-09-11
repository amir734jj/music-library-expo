# Music Library

TypeScript workspace containing the NestJS/PostgreSQL API, shared contracts and application logic, and the Expo/Tauri client.

## Dependencies

The API uses the public `@amir734jj/stream-ripper@1.0.1` npm package for ICY metadata parsing and completed-song capture.

```shell
npm install
```

## Stream Processing

`StreamMetadataProbeService` starts `StreamRipper` in metadata-only mode. `StationProbeWorker` applies database-configured batching, concurrency, and timeout values, records metadata changes, and creates subscription alerts.

When a matching subscription has capture enabled, `TrackCaptureQueue` schedules the observation. `StreamTrackCaptureService` waits for the next ICY song boundary, and `TrackCaptureWorker` writes the completed audio with AES-256-GCM encryption and an atomic filesystem rename. Configure a Base64-encoded 32-byte key in `TRENDING_CACHE_ENCRYPTION_KEY` before enabling capture.