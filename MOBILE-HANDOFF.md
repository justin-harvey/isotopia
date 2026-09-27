# Isotopia — Mobile (iOS/Android) Handoff

Branch: `mobile` · Updated: 2026-09-27

This branch wraps the Isotopia web game in **Capacitor** for Google Play and
(eventually) the Apple App Store. It does **not** rewrite the game; the native
apps load the existing web build. Website-only fixes land on `main` (via the
`web-fixes` branch) and are merged into `mobile`, never the other way round
without a decision to put the app shell on `main`.

## Status
- **iOS: BLOCKED on an Apple ID.** Justin can't recover his old Apple ID (tied to
  a lost phone number) and new sign-ups fail with "account cannot be created at
  this time". Without an Apple ID there's no Xcode download, no Developer Program,
  and no App Store. Everything below that is iOS-specific is ready but untested.
  Interim iPad path that needs no Apple account: the website as a **home-screen
  web app** (manifest + icons are in) — the school's MDM can push a web clip of
  https://is0topia.netlify.app/ to student iPads.
- **Android: builds on this Mac** (debug APK). Publishing needs a Google Play
  developer account (Google account + one-time $25).
- **This Mac can't upload iOS builds even with an Apple ID**: a 2017 MacBook Pro
  tops out at macOS 13 → Xcode 15.2, too old for App Store uploads. Use a cloud
  macOS builder (GitHub Actions macOS runners are free for this public repo, or
  Codemagic) for M5/M6.

## Toolchain on this Mac (all user-local, no admin rights)
| Tool | Where |
|---|---|
| Node 24 LTS | `~/.local/node` (symlinked into `~/.local/bin`) |
| Java 21 (Temurin) | `~/.local/jdk-21` → `JAVA_HOME=~/.local/jdk-21/Contents/Home` |
| Android SDK (platform 36, build-tools 36, platform-tools) | `~/.local/android-sdk` → `ANDROID_HOME` |
| Capacitor | 8.5.2 (`core`/`cli`/`android`/`ios`) — targets Android API 36 (Play's minimum), minSdk 24 |
| Gradle | 8.14.3 via the wrapper; AGP 8.13.0 |

`android/local.properties` (gitignored) points Gradle at the SDK.

## Build the Android app
```bash
cd ~/isotopia
export JAVA_HOME=~/.local/jdk-21/Contents/Home ANDROID_HOME=~/.local/android-sdk
npm run cap:sync                       # build:app (dist → www minus teacher.*) + cap sync
(cd android && ./gradlew assembleDebug)
# → android/app/build/outputs/apk/debug/app-debug.apk  (sideload on any Android device)
```
**Firebase config:** `FIREBASE_*` env vars must be exported before `cap:sync`, or
the app is baked offline-only (local questions, no sign-in). Values are the web
config from the Firebase console (same as Netlify's env vars; not secret).

## Done
- Capacitor 6 → 8.5.2 via `cap migrate` (Android API 36; iOS moved to the UIScene
  lifecycle with `SceneDelegate.swift`, deployment target 15.0).
- `npm run build:app` / `cap:sync`; the app ships the student + guest experience
  only (`teacher.*` stripped; `isNativeApp()` disables the portal shortcut).
- **Account deletion** (App Store 5.1.1(v) / Play): inline password confirmation;
  reauthenticates *before* deleting anything; refreshes the ID token; removes
  `students/{uid}`, `assignments/{uid}` (rules change — see below), on-device
  progress, then the Auth user; staff accounts are refused.
- **WebView-safe Firebase Auth**: `getGameAuth()` uses `initializeAuth` with plain
  persistence in the native app (`getAuth()` hangs in the iOS WebView).
- Startup can't hang (8s timeout → local data); iPad portrait/landscape layout;
  typing in sign-in fields fixed (see HANDOFF.md history).

## To do
- **Deploy RTDB rules** (student may delete own `assignments/{uid}`):
  `firebase deploy --only database --project isotopia-2809c`. Until then deletion
  skips that step.
- **App icon + splash** are still Capacitor's defaults. Source art: the pixel dog
  (`src/assets/icon-512.png`); generate with `npx @capacitor/assets generate`.
- **appId** `com.justinharvey.isotopia` is a placeholder — lock it in before the
  first store upload (it's baked into `android/app/build.gradle`, the iOS
  project, and `capacitor.config.ts`; changing it later means a new store listing).
- Android hardware Back button exits the app instead of closing the quiz/dex.
- Release signing (upload keystore) + an `.aab` for Play (`./gradlew bundleRelease`).
- Test the delete-account flow and online sign-in inside the app against live
  Firebase (needs the FIREBASE_* values).

## Store milestones (unchanged)
- **M4:** listing — Education category, iPad + phone screenshots, description,
  privacy labels (Apple) / Data Safety form (Play): declare email + progress.
- **M5:** TestFlight / Play internal testing on real devices.
- **M6:** submit, with a verified test student login in the reviewer notes.

## Key decisions (settled)
- **Capacitor, not Flutter/React Native** — Phaser is a web/canvas engine.
- **Audience 13+ (HS/college)** → COPPA under-13 rules N/A. Don't opt into the
  Kids Category; list under **Education**.
- **School distribution:** free public listing + Apple School Manager / MDM.
- No analytics or ad SDKs; `firebase/serviceAccount.json` is gitignored.

## Compliance checklist
- [x] In-app account deletion
- [x] No third-party analytics / ad SDKs
- [x] No third-party login in the binary (Sign in with Apple not required)
- [ ] Privacy Policy URL (required by both stores)
- [ ] Privacy Nutrition Labels (Apple) / Data Safety form (Play)
- [ ] Public account-deletion request URL (Play wants one besides the in-app flow)
