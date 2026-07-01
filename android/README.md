# drill · go 🏃🚴🚶

GPS activity tracker for **Android** — the companion app to the
[drill](https://drill.celox.io) fitness PWA. Press **Start** and go: it records
your route, distance, speed and steps in the background and uploads them to your
drill account, where they earn XP, feed your streak and unlock achievements.

> Part of the [drill](https://github.com/pepperonas/drill) monorepo — the app lives in `android/`;
> the server + web live at the repo root. Android releases are tagged `android-v*`.

[![Release](https://img.shields.io/github/v/release/pepperonas/drill)](https://github.com/pepperonas/drill/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/pepperonas/drill/total)](https://github.com/pepperonas/drill/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/pepperonas/drill/android-release.yml)](https://github.com/pepperonas/drill/actions/workflows/android-release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](../LICENSE)

## Features

- **One-tap recording** — a single big **Start** button. A foreground service
  keeps tracking with the screen off (no background-location permission needed).
- **Auto-detected activity** — walk / run / cycle inferred live from your speed;
  confirm or change it on the summary.
- **Route · distance · pace · steps** — live tiles + a route trace while you move.
- **Offline-first** — recordings are saved locally and synced when you're back
  online (idempotent, so retries never double-count).
- **Design matched to drill** — Material 3 Expressive, dark, Electric-Lime accent.

## Pairing (no account setup in the app)

1. Open [drill.celox.io](https://drill.celox.io) → **Einstellungen → Gerät koppeln**.
2. Tap **Code erzeugen** — a 6-character code appears.
3. Enter it in drill · go. The app receives a revocable device token; no Google
   login on the phone.

## Download

Grab the latest signed APK from the
**[Releases page](https://github.com/pepperonas/drill/releases/latest)** and
sideload it (enable “install unknown apps” for your browser/file manager).

## Build (from `android/`)

```bash
cd android
./gradlew :app:assembleDebug      # debug APK
./gradlew :app:assembleRelease    # signed release (needs keystore.properties or KEYSTORE_* env)
```

Signing config: local builds read `android/keystore.properties` (gitignored);
CI reads the `KEYSTORE_*` repository secrets. See `.github/workflows/android-release.yml`.

**Maintainer — cutting a release:** bump `versionCode` / `versionName` in
`android/app/build.gradle.kts`, then `git tag android-vX.Y.Z && git push origin android-vX.Y.Z`.
The workflow builds the signed APK and attaches it to a new GitHub Release.

## Stack

Kotlin · Jetpack Compose · Material 3 · FusedLocationProvider · Room ·
WorkManager · Retrofit + kotlinx.serialization. minSdk 26.

## License

MIT © Martin Pfeffer / celox.io
