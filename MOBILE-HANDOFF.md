# Isotopia — Mobile (iOS/Android) Handoff

Branch: `mobile` · Updated: 2026-09-27

This branch wraps the Isotopia web game in **Capacitor** to ship it to the Apple
App Store (iPad-first — schools run on iPads) and Google Play. It does **not**
rewrite the game; the native apps load the existing web build.

## Status — DONE on Linux, code-complete, NOT yet runtime-tested
- **Capacitor 6.2.2** installed (`core`/`cli`/`ios`/`android`). Pinned to v6 for Node 18; runs fine on newer Node too.
- **`capacitor.config.ts`**: appId `com.justinharvey.isotopia` (PLACEHOLDER — lock in before the first App Store submit), appName `Isotopia`, webDir `www`.
- **`npm run build:app`** = `npm run build` then copy `dist/` → `www/` minus `teacher.html/css/js`. The app ships the student + guest experience only (no Google/teacher login in the binary → Sign in with Apple not required).
- **`npm run cap:sync`** = `build:app` + `npx cap sync`.
- Both **`ios/` and `android/`** native projects added and committed. iOS `pod install` was skipped on Linux — it runs on the Mac via `cap sync`.
- **`src/platform.ts`** `isNativeApp()` disables the hidden hold-to-open teacher-portal shortcut in native builds.
- **In-app account deletion** (App Store 5.1.1(v) + Google Play requirement): `deleteStudentAccount()` in `src/data/studentAuth.ts` deletes `students/{uid}` then the Firebase Auth user (reauth-with-password fallback on `auth/requires-recent-login`). "Delete account" button in `src/ui/Isotopedex.ts` for verified + pending states.
- Web build compiles clean; `www/` and both native bundles verified to exclude `teacher.*`.

## Continue on the Mac
```bash
git fetch origin
git checkout mobile
npm install
npm run cap:sync      # builds www, runs pod install for iOS
npx cap open ios      # opens Xcode
```
In Xcode: set your signing Team + bundle id, then run on an iPad simulator/device.

## Key decisions (settled)
- **Capacitor, not Flutter/React Native** — Phaser is a web/canvas engine; those would mean a full rewrite or a worse WebView.
- **Audience 13+ (HS/college)** → COPPA under-13 rules N/A. Do NOT opt into the Kids Category; list under **Education, ~12+**.
- **Universal app with real iPad support is the #1 priority** (landscape, larger layout). App Store Connect requires separate iPad screenshots.
- **School distribution:** free public listing + **Apple School Manager / MDM** (students often lack Apple IDs; free apps push silently to managed iPads).
- Clean for review: no analytics, no ad SDKs; `firebase/serviceAccount.json` is gitignored and not bundled.

## Remaining milestones
- **M3 (Mac):** iPad layout + landscape, touch/tap controls for grid-engine, app icon + splash (`@capacitor/assets`), confirm Firebase auth/RTDB work in the WebView.
- **M4:** App Store listing — Education category, 12+, iPad + iPhone screenshots, description, privacy nutrition labels.
- **M5:** TestFlight beta on real devices.
- **M6:** Submit (include a verified test student login in reviewer notes — a common rejection cause).

## Compliance checklist
- [x] In-app account deletion
- [x] No third-party analytics / ad SDKs
- [x] No third-party login in the binary (Sign in with Apple not required)
- [ ] Privacy Policy URL (required by both stores)
- [ ] Privacy Nutrition Labels (Apple) / Data Safety form (Play) — declare email + progress
- [ ] Public account-deletion request URL (Play wants this in addition to the in-app flow)

## Still needs runtime testing
The delete-account flow and the native WebView game have not been run yet — verify on the Mac/simulator against live Firebase before submitting.
