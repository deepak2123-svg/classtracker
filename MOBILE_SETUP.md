# Mobile App Setup

This project now includes a Capacitor shell so the existing Vite + React app can be packaged as Android and iOS apps.

## What was added

- `capacitor.config.json`
- `android/`
- `ios/`
- Mobile scripts in `package.json`
- A native app mode in `src/platform.js`

## Commands

Install dependencies:

```bash
npm install
```

Build the web app and sync native projects:

```bash
npm run mobile:build
```

Open Android Studio:

```bash
npm run cap:android
```

Open Xcode:

```bash
npm run cap:ios
```

## Current native behavior

- Android and iOS now use one shared app shell.
- Teachers sign in and use the same tracker UI.
- Admins can switch between teacher and admin views inside the native app.
- Web-only cross-links to `teacherct.vercel.app` are hidden in the native shell.
- Native Android Google sign-in is wired through Capacitor and then exchanged for a Firebase session.

## Android Google Sign-In

The code now expects a web client ID in a local env file:

```bash
VITE_GOOGLE_WEB_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
```

Setup checklist:

1. In Firebase Authentication, enable the Google provider.
2. In your Firebase project settings, add an Android app for package `com.classtracker.app` if it does not already exist.
3. Add the SHA-1 fingerprint for the debug keystore.
4. Add the SHA-1 fingerprint for the release/upload keystore too before shipping APKs.
5. In Google Cloud Console, create or confirm the Web application OAuth client ID for the same project.
6. Put that Web client ID into `.env.local` as `VITE_GOOGLE_WEB_CLIENT_ID`.

Important:

- The Android native flow uses the **Web** client ID, not the Android client ID.
- If Google sign-in opens but does not return a Firebase session, the most common cause is missing SHA-1 or the wrong Web client ID.

## Next work before store release

1. Add deep-link handling for admin invite links if the admin side stays in the app.
2. Replace browser download and print flows with native share/file flows where needed.
3. Add app icons, splash screens, package names, signing, and store metadata.
4. Test Firebase auth and offline behavior on real Android devices.

## Notes

- `npm run mobile:build` must be run after web code changes so `dist/` is copied into the native projects.
- iOS builds and App Store submission require Xcode on a Mac.
