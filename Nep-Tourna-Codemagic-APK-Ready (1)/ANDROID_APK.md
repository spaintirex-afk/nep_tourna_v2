# Nep Tourna Android APK

This project is prepared to package the Nep Tourna React/Vite application as an Android APK using Capacitor 7.

## Before building

The Android app is a mobile frontend. The Express backend and production database must be hosted online. The Android app must point to that backend using `VITE_API_URL`.

1. Copy `.env.android.example` to `.env`.
2. Replace `VITE_API_URL` with the public **HTTPS** URL of the Nep Tourna backend.
3. Configure the backend `CORS_ORIGINS` to allow the Capacitor Android origin (`http://localhost`) and your web origin as needed.
4. Keep the production database persistent and shared so admin changes are visible to all users worldwide.

## Windows: easiest APK build

Install Node.js LTS and Android Studio with an Android SDK. Then open this folder in Qoder and run:

```text
build-apk.bat
```

The first run installs dependencies, creates the Android project, builds the web app, syncs Capacitor, and creates a debug APK.

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Manual commands

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Or build directly:

```bash
npm run android:apk
```

## Important

This creates a **debug APK** for installation/testing. A release APK/AAB for Google Play needs an Android signing key and release configuration.
