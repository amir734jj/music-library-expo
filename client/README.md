# Music Library Client

One Expo Router application targets Android, web, and the Tauri Windows shell. It provides station discovery, live and cached playback, offline tracks, artist subscriptions and alerts, listener presence, and administration.

The client uses `EXPO_PUBLIC_API_URL` when provided. Local Expo development discovers the Metro host and uses port `3000`; packaged native and Tauri clients otherwise use the deployed Music Library API. The Docker-hosted web export uses its own origin.

Run client commands from the repository root:

```powershell
npm run start --workspace @music-library/client
npm run web --workspace @music-library/client
npm run android --workspace @music-library/client
npm run tauri --workspace @music-library/client -- dev
```

Dependencies must first be installed from the workspace root with `NODE_AUTH_TOKEN` configured for the private stream-ripper package.