import type { CapacitorConfig } from '@capacitor/cli';

// Native shell config for the iOS/Android builds. The web game is built to
// `www/` by `npm run build:app` — a copy of dist/ with the teacher portal
// stripped out, so the app ships the student + guest experience only (no
// third-party/Google login in the binary → Sign in with Apple isn't required).
const config: CapacitorConfig = {
    appId: 'com.justinharvey.isotopia',   // placeholder bundle id — lock this in before the first App Store submit
    appName: 'Isotopia',
    webDir: 'www',
};

export default config;
