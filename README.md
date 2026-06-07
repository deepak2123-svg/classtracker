# ClassLog

ClassLog is a Vite + React + Firebase app for classroom logging, with a dedicated teacher experience, an admin management surface, and a Capacitor-based Android/iOS shell.

## What this repo contains

- Teacher web app for daily class logging, history, export, offline-safe drafting, and teacher profile tools
- Admin web app for managing teachers, institutes, sections, and data operations
- Shared native shell for Android and iOS using Capacitor
- Standalone native Android teacher app in Kotlin and Jetpack Compose
- Firebase-backed auth, role checks, persistence, and sync

## Product surfaces

- Teacher web: default web mode
- Admin web: enabled by setting `VITE_APP_MODE=admin`
- Native app: one shared shell where admins can toggle between admin and teacher views

## Stack

- React 18
- Vite 5
- Firebase
- Capacitor 8
- Android Studio / Gradle for Android packaging

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from `.env.example`.

Required for native Google sign-in:

```bash
VITE_GOOGLE_WEB_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
```

Optional runtime envs:

```bash
VITE_APP_MODE=admin
VITE_TEACHER_APP_URL=https://teacherct.vercel.app/
VITE_ADMIN_APP_URL=https://ctadmin.vercel.app/
```

3. Start the app:

```bash
npm run dev
```

4. Build production web assets:

```bash
npm run build
```

## Scripts

- `npm run dev` starts the Vite dev server
- `npm run build` creates the production web bundle in `dist/`
- `npm run preview` serves the built bundle locally
- `npm run mobile:build` builds the web bundle and syncs Capacitor projects
- `npm run cap:sync` syncs Capacitor projects without rebuilding Vite
- `npm run cap:android` opens the Android project
- `npm run cap:ios` opens the iOS project

## Project layout

- `src/ClassTracker.jsx` teacher experience
- `src/AdminPanel.jsx` admin experience
- `src/firebase.js` Firebase integration and persistence
- `src/main.jsx` app-mode entrypoint
- `src/platform.js` teacher/admin/native mode routing helpers
- `android/` Capacitor Android project
- `ios/` Capacitor iOS project
- `native-android/` standalone native Android teacher application

## Mobile build notes

General setup and native auth notes live in [MOBILE_SETUP.md](./MOBILE_SETUP.md).

Typical Android flow:

```bash
npm run mobile:build
cd android
./gradlew assembleDebug
```

This repo is also configured to produce split release APKs for:

- `arm64-v8a`
- `armeabi-v7a`
- `universal`

If `CLASSLOG_UPLOAD_STORE_FILE`, `CLASSLOG_UPLOAD_STORE_PASSWORD`, `CLASSLOG_UPLOAD_KEY_ALIAS`, and `CLASSLOG_UPLOAD_KEY_PASSWORD` are present, release APKs use that keystore. Otherwise, release builds fall back to the debug signing config for GitHub/test distribution. Configure a real upload keystore before Play Store submission.

## Android release process

1. Build and sync the web bundle:

```bash
npm run mobile:build
```

2. Build split release APKs:

```bash
cd android
./gradlew assembleRelease
```

3. Expected outputs:

- `classlog-<version>-arm64-v8a-release.apk`
- `classlog-<version>-armeabi-v7a-release.apk`
- `classlog-<version>-universal-release.apk`

## Firebase notes

- Google sign-in must be enabled in Firebase Authentication
- The Android app package is `com.classtracker.app`
- Add SHA-1 fingerprints for both debug and release/upload keystores in Firebase before shipping Android builds
- Native Android sign-in uses the web OAuth client ID

## Deployment notes

- Web and native share the same React codebase
- After teacher/admin UI changes, run `npm run mobile:build` before packaging Android or iOS
- iOS packaging and App Store release still require Xcode on macOS

## Current priorities

- Keep teacher logging fast and low-friction on mobile
- Maintain admin control over institutes and section structures
- Keep native builds aligned with the latest synced web bundle
