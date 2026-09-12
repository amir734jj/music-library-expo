# Music Library Client

One Expo Router application targets Android, web, and the Tauri Windows shell. It provides station discovery, live and cached playback, offline tracks, artist subscriptions and alerts, listener presence, and administration.

Android, iOS, and packaged Tauri clients always use `https://music-library2.coolify.hesamian.com/api`. Browser development can use `EXPO_PUBLIC_API_URL`; otherwise local browser builds use port `3000` and the Docker-hosted web export uses its own origin.

Run client commands from the repository root:

```powershell
npm run start --workspace @music-library/client
npm run web --workspace @music-library/client
npm run android --workspace @music-library/client
npm run tauri --workspace @music-library/client -- dev
```

Dependencies must first be installed from the workspace root with `npm install`.