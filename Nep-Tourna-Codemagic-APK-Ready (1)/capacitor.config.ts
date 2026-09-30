import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.neptourna.app',
  appName: 'Nep Tourna',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // Keep this empty for the normal bundled mobile app.
    // For a hosted-web deployment you may set CAP_SERVER_URL at build/sync time.
    ...(process.env.CAP_SERVER_URL ? { url: process.env.CAP_SERVER_URL, cleartext: false } : {}),
  },
}

export default config
