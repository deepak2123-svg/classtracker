# ClassLog

ClassLog is a Vite + React + Firebase app for classroom logging, with dedicated teacher, admin, and manager surfaces plus a Capacitor-based Android/iOS shell.

## What this repo contains

- Teacher web app for daily class logging, history, export, offline-safe drafting, and teacher profile tools
- Admin web app for managing teachers, institutes, sections, and data operations
- Manager web app for groups, institute structure, scoped admin invitations, and Genesis migration
- Shared native shell for Android and iOS using Capacitor
- Standalone native Android teacher app in Kotlin and Jetpack Compose
- Firebase-backed auth, role checks, persistence, and sync

## Product surfaces

- Teacher web: default web mode
- Admin web: enabled by setting `VITE_APP_MODE=admin`
- Manager web: enabled by setting `VITE_APP_MODE=manager`
- Native app: one shared shell where admins can toggle between admin and teacher views

## Production domains

- Teacher web: `https://teacher.ledgrclasses.com/`
- Admin web: `https://admin.ledgrclasses.com/`
- Manager web: `https://manager.ledgrclasses.com/`

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
VITE_TEACHER_APP_URL=https://teacher.ledgrclasses.com/
VITE_ADMIN_APP_URL=https://admin.ledgrclasses.com/
VITE_MANAGER_APP_URL=https://manager.ledgrclasses.com/
ENABLE_SCHEDULED_JOBS=false
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
- `src/ManagerPanel.jsx` manager experience
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
- Vercel project `classtrackeradmin` should use `admin.ledgrclasses.com`
- Vercel project `classtracker123` should use `teacher.ledgrclasses.com`
- Separate Vercel project `ledgrclasses-manager` should use `manager.ledgrclasses.com`
- Set `VITE_APP_MODE=admin` on Admin, `VITE_APP_MODE=manager` on Manager, and leave it unset for Teacher
- Keep `VITE_TEACHER_APP_URL`, `VITE_ADMIN_APP_URL`, and `VITE_MANAGER_APP_URL` aligned on all three Vercel projects
- Set `ENABLE_SCHEDULED_JOBS=true` only on the Admin Vercel project. Keep it false or unset on Teacher and Manager
- Add all three custom domains in Firebase Authentication authorized domains before relying on Google sign-in from those hosts
- The standalone native Android teacher app does not use these web hostnames unless Android App Links are added later

## Tenant bootstrap and Genesis migration

Manager signup is intentionally disabled. Create the first manager account in Firebase Authentication, copy its UID, and create `roles/{uid}` in Firestore with:

```json
{
  "role": "manager",
  "grantedAt": 0,
  "grantedBy": "manual-bootstrap"
}
```

Then sign in at `manager.ledgrclasses.com` and run **Migrate Genesis**. The migration is idempotent: it creates `Genesis Group`, maps current institutes to child institute records, converts legacy admins to `group_admin`, creates teacher memberships, and merges `groupId`/`instituteId` fields into existing teacher/class records without deleting legacy fields.

New tenant collections are:

- `groups`
- `institutes`
- `instituteCodes`
- `memberships`
- `invites`
- `joinRequests`

Public role names are `manager`, `group_admin`, `institute_admin`, and `teacher`. Legacy `admin` is accepted only during the migration transition.

## Current priorities

- Keep teacher logging fast and low-friction on mobile
- Maintain admin control over institutes and section structures
- Keep native builds aligned with the latest synced web bundle
