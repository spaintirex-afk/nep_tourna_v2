# Nep Tourna - Capacitor setup

This project is prepared to be packaged as a native Android/iOS app with Capacitor.

## 1. Install dependencies

From the project root:

```bash
npm install
```

Then add the native platforms:

```bash
npx cap add android
npx cap add ios
```

You only need `ios` on macOS with Xcode.

## 2. Build and sync

```bash
npm run build
npx cap sync
```

Open Android Studio:

```bash
npx cap open android
```

Open Xcode (macOS):

```bash
npx cap open ios
```

## 3. Production API

A packaged Capacitor app is not served from the Express web origin. Set `VITE_API_URL` to your deployed Nep Tourna backend before building the mobile app:

```env
VITE_API_URL=https://your-api-domain.example
```

The app will then send API requests and real-time SSE traffic to that backend. Keep the backend and production database shared for every user worldwide.

On the backend, set `CORS_ORIGINS` to the origins you actually use. For a Capacitor app, include `capacitor://localhost`; for your website, include its HTTPS origin. The backend switches session cookies to `SameSite=None; Secure` when cross-origin mode is enabled.

## 4. Important architecture rule

The mobile app is only another client. It must use the same production API/database as the website. Admin-created tournaments, registrations, matches, results, announcements, and other shared data therefore remain global.
