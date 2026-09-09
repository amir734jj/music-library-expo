# Music Library

TypeScript workspace containing the NestJS/PostgreSQL API, shared contracts and application logic, and the Expo/Tauri client.

## GitHub Packages

The API uses `@amir734jj/stream-ripper@1.0.0` from GitHub Packages for ICY metadata parsing and completed-song capture. GitHub Packages requires authentication even when the source repository is public.

Create a GitHub token with `read:packages`, then set it directly in your shell before installing dependencies. Do not commit the token or place its value in `.npmrc`.

```powershell
$env:NODE_AUTH_TOKEN = "<token>"
npm install
```

The release workflow uses its short-lived `GITHUB_TOKEN`. The package settings must grant this repository read access under **Manage Actions access**.

## Stream Processing

`StreamMetadataProbeService` starts `StreamRipper` in metadata-only mode. `StationProbeWorker` applies database-configured batching, concurrency, and timeout values, records metadata changes, and creates subscription alerts.

When a matching subscription has capture enabled, `TrackCaptureQueue` schedules the observation. `StreamTrackCaptureService` waits for the next ICY song boundary, and `TrackCaptureWorker` writes the completed audio with AES-256-GCM encryption and an atomic filesystem rename. Configure a Base64-encoded 32-byte key in `TRENDING_CACHE_ENCRYPTION_KEY` before enabling capture.