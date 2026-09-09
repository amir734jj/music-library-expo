# Music Library Feature Parity

This repository ports the legacy Music Library application to a TypeScript-first stack:

- Expo and React Native for Android and web
- Tauri for the Windows desktop package
- NestJS, TypeORM, and PostgreSQL for the API
- `@amir734jj/stream-ripper` for ICY metadata and track capture

## User features

| Legacy capability | New implementation | Status |
| --- | --- | --- |
| Registration, sign-in, and persisted sessions | JWT auth with SecureStore on native and browser storage on web/Tauri | Implemented |
| Station directory and search | Public station API and responsive Discover station directory | Implemented |
| Current track metadata | Scheduled ICY probes and On air view | Implemented |
| Live station playback | Reusable short-lived stream tickets and Expo Audio | Implemented |
| Trending artists and tracks | Aggregated observations with cross-station counts | Implemented |
| Cached track playback | AES-256-GCM server cache and Expo Audio playback | Implemented |
| Track downloads and offline playback | Expo document storage on native and IndexedDB on web/Tauri | Implemented |
| Per-station recent captures | Station detail recent-captures view | Implemented |
| Artist subscriptions | Follow/unfollow UI with capture preference | Implemented |
| Artist alerts | Authenticated alert feed | Implemented |
| Manual next-track capture | Authenticated station capture action | Implemented |
| Active listener presence | Playback heartbeat and Listening now view | Implemented |
| Background playback | Expo Audio background mode and lock-screen metadata | Implemented |

## Administration

| Legacy capability | New implementation | Status |
| --- | --- | --- |
| User listing, activation, roles, and deletion | Role-gated Users console | Implemented |
| Global runtime configuration | Typed configuration service and editor | Implemented |
| Directory import | HTTPS directory import with validation and upsert | Implemented |
| Global and per-station probe controls | Probe console with bulk and station toggles | Implemented |
| Probe runtime status and pagination | In-memory status tracking and paginated console | Implemented |
| Cache size and track count | Cache metrics | Implemented |
| Cache clearing and lifecycle enforcement | Admin clear action plus retention/size enforcement | Implemented |

## Distribution

| Artifact | Packaging path | Status |
| --- | --- | --- |
| Windows desktop | Expo static export wrapped by Tauri v2 NSIS | Configured |
| Android | Expo prebuild and Gradle release APK | Configured |
| Container | Multi-stage Docker image with API and static client | Configured |
| Combined release | One ZIP containing desktop installer, APK, Dockerfile, image reference, checksums, and this report | Configured |

## Validation state

Editor diagnostics and static route checks are clean. Runtime builds remain to be executed after an authenticated dependency install creates the root `package-lock.json`; the private stream-ripper dependency requires `NODE_AUTH_TOKEN`. Distribution rows are therefore marked **Configured**, not runtime-verified.