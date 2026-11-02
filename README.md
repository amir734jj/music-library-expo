# Music Library

TypeScript workspace containing the NestJS/PostgreSQL API, shared contracts and application logic, and the Expo/Tauri client.

## Dependencies

The API uses the public `@amir734jj/stream-ripper@1.0.1` npm package for ICY metadata parsing and completed-song capture.

```shell
npm install
```

Keep `expo-asset` as a direct client dependency aligned with Expo SDK 56. This
prevents npm from selecting an incompatible asset package through peer
dependencies, which breaks web export with a missing `expo/internal/bundle-origin`
module.

## Stream Processing

`StreamMetadataProbeService` starts `StreamRipper` in metadata-only mode. `StationProbeWorker` applies database-configured batching, concurrency, and timeout values, records metadata changes, and creates subscription alerts.

When a matching subscription has capture enabled, `TrackCaptureQueue` schedules the observation. `StreamTrackCaptureService` waits for the next ICY song boundary, and `TrackCaptureWorker` writes the completed audio with AES-256-GCM encryption and an atomic filesystem rename. Configure a Base64-encoded 32-byte key in `TRENDING_CACHE_ENCRYPTION_KEY` before enabling capture.

## Database Retention

Every minute, the API removes play observations and alerts older than seven days
and trims the oldest rows above 1,000,000 observations or 100,000 alerts. These
are periodic cleanup targets, not synchronous insert limits: traffic can
temporarily exceed them between runs. Each run deletes up to 20 batches of 1,000
rows per table; larger backlogs drain over subsequent runs. Failures are logged
and retried on the next run.

Removing observations also removes associated alerts and cached-track records
through database cascades. The worker deletes associated encrypted audio files
before removing observations. Users, subscriptions, and stations are not pruned.
Production startup automatically applies the supporting index migration.

Keep PostgreSQL autovacuum enabled so deleted-row space can be reused. Retention
does not impose a database byte-size limit or immediately shrink database files;
monitor database size, free disk space, and cleanup errors in production.

## Better Stack Logging

The API includes default Better Stack ingestion credentials. `CLIENT_LOGGING_ENDPOINT` and `CLIENT_LOGGING_SOURCE_TOKEN` can override those defaults during deployment. Android and desktop clients send bounded, sanitized events to `/api/client-logs`, and the API forwards them to Better Stack without embedding the token in client bundles.

Client telemetry captures JavaScript errors and startup events after the application runtime initializes. Native Android crashes that occur before JavaScript starts require Android crash logs or a native crash-reporting SDK.