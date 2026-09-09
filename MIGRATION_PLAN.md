# Music Library Expo + Tauri Migration Plan

## 1. Objective

Replace the existing Avalonia client applications with a TypeScript client while retaining the existing ASP.NET Core API, PostgreSQL database, API contracts, and server-side radio probing/capture system.

Target applications:

- Android: Expo/React Native application.
- Web: Expo Router web application deployed with the existing ASP.NET Core API.
- Desktop: Expo static web export hosted by Tauri v2 on Windows, Linux, and macOS.

This is a client migration, not a backend rewrite. The existing `MusicLibrary.Api` remains the system of record throughout the migration.

## 2. Architecture Decision

Use one shared Expo application with platform services selected behind TypeScript interfaces.

| Concern | Android | Web | Tauri desktop |
| --- | --- | --- | --- |
| UI and routing | Expo Router / React Native | Expo Router / React Native Web | Same exported web UI |
| Audio | `expo-audio` | `HTMLAudioElement` | `HTMLAudioElement` initially |
| Offline files | `expo-file-system` | IndexedDB or OPFS | Tauri filesystem plugin |
| Authentication storage | `expo-secure-store` | `localStorage` initially | OS-backed secret/keyring or Tauri Stronghold adapter |
| HTTP | Expo/React Native fetch | Browser fetch | Tauri HTTP plugin or API CORS |
| Downloads | Expo filesystem/share APIs | Browser download | Tauri save dialog + filesystem |
| Updates | Store/release APK process | Server deployment | Tauri updater plugin |

Do not use `expo-desktop` in the production path yet. It does not provide Windows/macOS implementations of `expo-audio` or `expo-file-system`, and its desktop prebuild/release workflow is still experimental. Keep the application service interfaces compatible with a future native React Native desktop implementation if that ecosystem matures.

## 3. Proposed Repository Layout

```text
music-library-expo/
  apps/
    client/                         Expo Router application
      app/                          Routes and layouts
      assets/
      src/
        api/                        HTTP client and generated/manual DTOs
        components/                 Shared UI components
        features/
          admin/
          auth/
          following/
          library/
          offline/
          playback/
          stations/
          trending/
        platform/                   Adapter contracts and selection
        state/                      Session and playback state
        theme/
      src-tauri/                    Tauri v2 desktop host
      app.config.ts
      metro.config.js
      package.json
  core/                             Shared contracts and platform-independent logic
  scripts/
    sync-contracts/                 Optional OpenAPI generation/checking
  .github/workflows/
  package.json
  package.json npm workspaces
  tsconfig.base.json
```

Start with a single Expo application rather than separate web/mobile projects. Split packages only where code is genuinely platform-independent or reused by tooling.

## 4. Platform Boundaries

Define stable interfaces before implementing screens. UI and feature code must not import Expo, DOM, or Tauri APIs directly.

```ts
export type PlaybackState = "stopped" | "paused" | "playing" | "buffering";

export interface PlaybackProgress {
  positionSeconds: number;
  durationSeconds: number;
  canSeek: boolean;
}

export type AudioSource =
  | { kind: "remote"; uri: string; isLive: boolean }
  | { kind: "local"; uri: string; contentType?: string }
  | { kind: "blob"; blob: Blob };

export interface TrackPlayer {
  play(source: AudioSource, signal?: AbortSignal): Promise<void>;
  playToCompletion(source: AudioSource, signal?: AbortSignal): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  getState(): PlaybackState;
  getProgress(): PlaybackProgress;
  subscribe(listener: (event: PlaybackEvent) => void): () => void;
}

export interface TrackStorage {
  save(input: SaveTrackInput): Promise<OfflineTrack>;
  list(): Promise<OfflineTrack[]>;
  resolve(key: string): Promise<AudioSource>;
  delete(key: string): Promise<void>;
  getDisplayLocation(): Promise<string | null>;
  chooseDirectory?(): Promise<void>;
}

export interface AuthenticationStorage {
  load(): Promise<StoredAuthentication | null>;
  save(value: StoredAuthentication): Promise<void>;
  clear(): Promise<void>;
}
```

Use platform files or one composition root to select implementations:

```text
track-player.native.ts             expo-audio
track-player.web.ts                HTMLAudioElement
track-storage.native.ts            expo-file-system
track-storage.web.ts               IndexedDB/OPFS
track-storage.tauri.ts             Tauri filesystem plugin
```

Tauri-specific selection must use a reliable runtime capability check, not user-agent parsing.

## 5. API Compatibility

Preserve the current server behavior and camel-case JSON contract. The new client must cover these existing API areas:

- Health and client logging configuration.
- Registration, login, current-user restoration, and logout.
- Now-playing list and per-station metadata.
- Station search and live-stream ticket creation.
- Trending list, cached-track download, and station cached tracks.
- Artist subscriptions.
- User alerts.
- Playback activity read/update/delete heartbeat.
- Station capture enablement.
- Admin users, roles, global configuration, cache status, station import, and probe controls.

### Contract strategy

1. Expose an OpenAPI document from `MusicLibrary.Api` if it does not already publish one.
2. Generate TypeScript request/response types and a typed client with a pinned generator.
3. Commit generated contracts or verify generation in CI so backend changes cannot silently break the client.
4. Add handwritten wrappers for domain-specific error handling and binary downloads.
5. Preserve enum string serialization and camel-case property names.

The API client must preserve current semantics:

- Accept HTTPS endpoints and loopback HTTP development endpoints only.
- Use a 30-minute timeout only for operations that genuinely require it; use shorter defaults elsewhere.
- Clear authentication and publish a session-invalidated event after authenticated `401` responses.
- Treat cached-track `404` as an expired recording.
- Read filename and content type from download response headers.
- Fall back from unsupported station cached-track/capture endpoints where compatibility with older servers is still required.

### Browser and desktop transport

Keep production web same-origin by copying the Expo static export into the API container's `wwwroot`. This avoids introducing CORS for the web deployment.

Tauri WebView requests are cross-origin. Prefer the Tauri HTTP plugin for desktop API calls, with an allowlist restricted to:

- `https://music-library.coolify.hesamian.com/`
- Explicit loopback development URLs

If browser fetch is used instead, configure narrowly scoped API CORS and verify streaming and binary download behavior on every desktop WebView.

## 6. Playback Design

### Shared playback coordinator

Create one application-level playback coordinator responsible for:

- Exactly one active player/source.
- Live station versus cached/offline track state.
- Toggle, stop, seek, and progress behavior.
- Cancellation through `AbortController`.
- Track-completion promises for continuous Trending/offline queues.
- Live metadata polling lifecycle.
- Playback activity heartbeat lifecycle.
- Cleanup when the source changes, the user signs out, or the app unmounts.

Do not store the player object in React component state. Keep it in an application service and expose an external-store subscription to React.

### Android implementation

Use `expo-audio` with:

- `shouldPlayInBackground: true`.
- `interruptionMode: "doNotMix"`.
- `enableBackgroundPlayback: true` in the config plugin.
- `setActiveForLockScreen` for sustained background playback and media controls.
- `isLiveStream: true` for stations so lock-screen seeking is disabled.
- Station/track metadata and artwork where available.
- Explicit player release on source replacement and application shutdown.

Use remote stream-ticket URLs directly. For cached downloads, write to the Expo cache or document directory and play the resulting file URI. Avoid passing large base64 payloads through React state.

### Web and Tauri implementation

Use one owned `HTMLAudioElement`:

- Remote URL for station streams.
- Object URL for transient downloaded blobs.
- Local/asset URL from the Tauri filesystem bridge for offline tracks.
- Revoke object URLs whenever playback changes or stops.
- Resolve `playToCompletion` on `ended` and reject it on media error or abort.
- Report seeking only when duration is finite and a seekable range exists.

The web implementation can be based on the behavior already proven by the current browser client's `authenticationSession.js`.

### Codec and stream gate

LibVLC supports more codecs and malformed radio streams than browser and platform media engines. Before broad UI migration, test a representative production station set on:

- Chrome/Edge web.
- Android release build using `expo-audio`.
- Windows Tauri/WebView2.
- Linux Tauri/WebKitGTK.
- macOS Tauri/WKWebView, if macOS is a release target.

Record successful formats, startup latency, metadata behavior, cancellation, reconnect behavior, and failures. If required stations fail in desktop WebViews, add a Tauri/Rust native audio backend behind `TrackPlayer`; do not leak it into feature code.

## 7. Offline Storage Design

Use opaque storage keys and validate filenames before resolving or deleting files. Preserve current protections against path traversal.

- Android: save persistent recordings under the Expo document directory; reserve cache for transient playback files.
- Web: use IndexedDB initially. Evaluate OPFS only when browser support and quota behavior meet requirements.
- Tauri: use the filesystem plugin with an application music directory and an optional user-selected directory.
- Store metadata in a small indexed manifest where the filesystem cannot reliably supply all required fields.
- Preserve name, size, save time, optional station name, and stable key.
- Support list, search, play, queue, delete, and batch download.

Desktop directory changes must move files transactionally or leave the original directory intact after failure. Never update the configured path before the move succeeds.

## 8. Authentication and Security

- Web initially preserves the existing `localStorage` behavior for compatibility. Document the XSS risk and move to server-issued secure cookies later if the API authentication model changes.
- Android stores authentication with `expo-secure-store`.
- Tauri stores authentication with an OS-backed secret/keyring or Stronghold adapter; do not put access tokens in plain Tauri store files.
- Keep access tokens out of logs, error telemetry, URLs, and query caches.
- Schedule session expiry from the server-provided expiry time.
- Verify restored sessions against `/api/auth/me` before showing authenticated UI.
- Clear playback activity and local authentication state on sign-out/session invalidation.
- Configure Tauri CSP and capability permissions with least privilege.

## 9. UI and Feature Mapping

Implement the usable application first, not a marketing page.

Routes/screens:

```text
/(auth)/login
/(auth)/register
/(app)/library
/(app)/stations
/(app)/trending
/(app)/following
/(app)/offline
/(app)/activity
/(app)/admin
/(app)/settings
```

Preserve these current workflows:

- Guest, authenticated, and offline entry paths.
- Responsive navigation suitable for compact Android and denser desktop layouts.
- Now-playing polling and search.
- Station listing, listening, metadata refresh, and local station capture subscriptions.
- Artist follow/unfollow.
- Trending playback, download, play-all queue, and expiry handling.
- Offline track search, playback, play-all queue, and deletion.
- Persistent playback dock with play/pause/stop, title, subtitle, progress, and seek.
- Other-users playback activity board.
- Admin probe status paging/search, worker controls, station import, per-station controls, global configuration, cache controls, and user administration.

Use accessible React Native primitives, safe-area handling, keyboard navigation on web/desktop, screen-reader labels, reduced-motion support, and minimum Android touch targets. Keep compact operational screens dense and scannable rather than card-heavy.

## 10. State and Data Fetching

Recommended baseline:

- TanStack Query for server state, polling, invalidation, and mutations.
- A small external store or Zustand for session and playback coordinator state.
- React Hook Form plus Zod for forms and client-side validation.
- Expo Router for routes and protected layouts.

Rules:

- Query keys must include search, page, and user-sensitive inputs.
- Stop polling when a route is inactive or the application is backgrounded, except playback services that explicitly continue.
- Keep playback state outside TanStack Query.
- Cancel superseded searches and polling requests with `AbortSignal`.
- Do not duplicate server models into view-specific global state.

## 11. Logging and Diagnostics

Preserve server-controlled client logging configuration, but introduce a platform-neutral logger.

- Include platform (`android`, `web`, `desktop`), application version, and release channel.
- Redact access tokens, stream tickets, credentials, encryption keys, and downloaded binary content.
- Capture playback source category and media error codes without logging sensitive signed URLs.
- Provide user-facing errors for offline state, expired recordings, unsupported media, and invalid sessions.
- Keep health-check status visible where the current application exposes it.

## 12. Implementation Phases

### Phase 0: Playback and transport spike

Goal: disprove the highest-risk assumptions before building the application.

Deliverables:

- Minimal Expo app and Tauri v2 host.
- Login against the production-compatible API.
- Fetch a live-stream ticket and play a station on Android, web, and Windows Tauri.
- Download and play one cached track.
- Pause/resume, seek, stop, completion, cancellation, and resource cleanup.
- Android background playback and lock-screen controls.
- Tauri release build with production API access.

Exit gate: representative production streams and cached tracks work on all required launch platforms, or an approved native desktop audio fallback is demonstrated.

### Phase 1: Foundation

- Initialize npm workspace, Expo Router TypeScript app, and Tauri v2 host.
- Configure linting, formatting, strict TypeScript, unit tests, and environment handling.
- Implement generated API contracts and API wrapper.
- Implement authentication storage adapters and protected routing.
- Implement application theme, responsive shell, error boundary, and health status.

Exit gate: register/login/restore/logout work on Android, web, and desktop without token leakage.

### Phase 2: Core discovery and playback

- Library/now-playing view and polling.
- Stations view and search.
- Trending view and cached-track download.
- Shared playback dock and coordinator.
- Artist subscriptions.
- Live metadata updates and playback activity heartbeat.

Exit gate: primary online user journey has behavioral parity with the Avalonia application.

### Phase 3: Offline and continuous playback

- Implement all storage adapters.
- Download single/all Trending tracks.
- Offline list/search/play/delete.
- Play-all Trending and offline queues using completion-aware playback.
- Desktop directory selection/migration.
- Local station capture subscriptions if this remains a product requirement.

Exit gate: files survive restart, cancellation cleans transient files, queues advance exactly once, and invalid keys cannot escape the storage root.

### Phase 4: Administration

- Probe status polling, paging, and filtering.
- Global probing controls and station import.
- Per-station probing controls.
- Trending cache status, clear action, and configuration editor.
- User activation, role assignment, and deletion.
- Confirmation and irreversible-action protections.

Exit gate: an administrator can perform every operation currently exposed by the Avalonia client.

### Phase 5: Release engineering

- Web static export copied into the API Docker image.
- Android EAS/local release build with a persistent release keystore.
- Tauri Windows installer and updater artifacts.
- Tauri Linux AppImage/deb as required.
- Tauri macOS bundle only if macOS is an explicit supported target.
- Artifact signing strategy and secrets documented.
- Versioning and release notes generated consistently.

Exit gate: clean-machine installs, upgrades, rollback, and API compatibility checks pass for every published target.

### Phase 6: Parallel rollout and retirement

- Publish the new web client behind a reversible deployment switch.
- Release desktop and Android builds to an internal/beta channel.
- Compare playback failures, login failures, API errors, and retention with the Avalonia clients.
- Freeze non-critical Avalonia feature work during final parity verification.
- Retire Avalonia clients only after the parity checklist and rollback window are complete.
- Keep backend rollback independent from client rollback.

## 13. Testing Strategy

### Unit tests

- API error mapping and session invalidation.
- Playback coordinator transitions and race conditions.
- Abort/completion behavior.
- Queue advancement and source replacement.
- Filename/key validation and storage manifest behavior.
- Date, duration, and file-size formatting.
- Admin configuration validation.

### Component tests

- Authentication forms and protected routes.
- Search/loading/empty/error states.
- Playback dock controls and seek availability.
- Offline and Trending actions.
- Admin role and destructive-action guards.

### End-to-end tests

Use Playwright for web and Tauri UI where practical, plus Android device/emulator tests for native media behavior.

Critical scenarios:

1. Register, pending-account handling, login, restore, expiry, and logout.
2. Browse/search now-playing and stations.
3. Start one station, switch stations, stop, and recover from stream failure.
4. Download/play/seek/cancel an expiring cached track.
5. Play-all queue advances once and stops cleanly.
6. Save, restart, list, play, and delete an offline track.
7. Android background playback, notification controls, Bluetooth interruption, and headphone disconnect.
8. Desktop update from the previous published version.
9. Admin operations with admin and non-admin accounts.

### Manual media matrix

Maintain a checked-in fixture list of representative stream URLs or server-side station IDs. Do not put expiring stream-ticket URLs or credentials in source control.

## 14. CI/CD Transition

Replace the client portions of the existing release workflow incrementally:

- Keep API build/container deployment independent.
- Add Node/npm workspace install and dependency caching.
- Run type checking, linting, unit tests, and web export.
- Build Android from a pinned Expo SDK and Java/Android toolchain.
- Build Tauri artifacts on Windows, Ubuntu, and optionally macOS runners.
- Sign release artifacts when production certificates are available.
- Publish to a beta release/tag before replacing the existing `latest` channel.
- Keep old Avalonia artifacts available during the rollback period.

The current workflow publishes a debug-signed APK and unsigned Windows installer. The migration should introduce a persistent Android release keystore and plan for Windows code signing rather than carrying those limitations forward.

## 15. Migration Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Browser/WebView codec support is narrower than LibVLC | Complete Phase 0 first; add a Tauri native audio adapter only if required |
| Radio servers return malformed streams or metadata | Test production station fixtures and preserve server proxy/ticket behavior |
| Android kills background playback | Enable foreground media service and lock-screen controls through `expo-audio` |
| Large downloads exhaust JS memory | Stream/download to files on native targets; avoid base64 and global state |
| Tauri cross-origin requests fail | Use Tauri HTTP plugin with a strict allowlist or narrowly configure API CORS |
| Platform files drift | Keep behavior contracts and shared adapter conformance tests |
| Generated API contracts drift | Pin generation and verify a clean regeneration in CI |
| Offline migration loses recordings | Do not auto-delete old Avalonia storage; provide an import path or documented coexistence period |
| Desktop updater regression | Test signed update manifests and previous-version upgrade in CI/release rehearsal |
| Scope expands during UI rewrite | Require phase exit gates and parity checklist before visual enhancements |

## 16. Data and Compatibility Decisions Required During Implementation

Resolve these during Phase 0/1 and record each as an architecture decision:

- Exact minimum Android API level.
- Whether Linux remains a required first-class desktop target.
- Whether macOS is required for the first release.
- Whether local station capture subscriptions remain desktop-only.
- Whether existing desktop offline recordings need automatic import.
- Whether web authentication remains in `localStorage` or the API moves to secure cookies.
- Whether the deployed API will permit CORS or Tauri will exclusively use its HTTP plugin.
- Whether unsupported desktop streams justify a Rust/native media backend.

None of these decisions should block creation of shared contracts, API wrappers, or UI foundations.

## 17. Definition of Done

The migration is complete when:

- Android, web, Windows, and required additional desktop targets pass the feature parity checklist.
- Representative live streams and cached recordings meet the playback matrix.
- Background Android playback and desktop updates work in release builds.
- Authentication is stored appropriately per platform and invalidated consistently.
- Offline recordings survive restart and cannot be accessed outside their configured root.
- Admin functionality is role-protected and behaviorally equivalent.
- The existing API serves the new web export without changing production data semantics.
- CI produces reproducible, installable artifacts from a pinned lockfile/toolchain.
- Monitoring shows acceptable playback and authentication failure rates during the beta window.
- A tested rollback path remains available through the agreed stabilization period.

## 18. Recommended First Work Item

Implement Phase 0 as a disposable but production-shaped vertical slice. Do not begin the full screen rewrite until the same real station and cached track can be played successfully in:

1. Expo Android release mode with background controls.
2. The browser production origin.
3. A packaged Windows Tauri release build.
4. Linux Tauri if Linux remains required.

That spike should use the final `TrackPlayer`, `AuthenticationStorage`, and HTTP transport interfaces so successful code can move directly into Phase 1.
