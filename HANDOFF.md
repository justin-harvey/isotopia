# Isotopia — Session Handoff

A running summary of what this is and where it stands, so work can resume after a
context reset. Last updated 2026-09-29.

## Where things stand (2026-09-27) — read this first
**Isotopia is a web app, full stop.** Native (iOS/Android) is **abandoned** — Justin
has no usable Apple ID and the 2017 Mac (macOS 13, Xcode 15.2 max) is too old to
upload to the App Store. iPads get the **web game**: Safari → Share → **Add to Home
Screen**, or the school's MDM pushes a web clip of https://is0topia.netlify.app/.
The web app manifest + icons (`src/manifest.webmanifest`, `src/assets/icon-*.png`)
make it open full-screen with the dog icon.

The day of Mac work — sign-in typing fix, iPad layout, Rad Finder hints, the Support
page, and the PWA manifest/icons — is now **merged to `main` and deployed live**.

| Branch | State | What to do with it |
|---|---|---|
| `main` | **The only branch that matters.** Live site; now includes all the former `web-fixes` work. | Do work here (or short-lived feature branches off it). Push → Netlify deploys. |
| `web-fixes` | Fully merged into `main`; nothing left on it. | Done. Safe to delete anytime; harmless if left. |
| `mobile` | **ABANDONED.** Capacitor 8.5.2 iOS/Android shell, archived at `origin/mobile` (`MOBILE-HANDOFF.md` lives there). | Do **not** maintain, merge, or keep in sync. Kept only as a recoverable archive if native is ever revived — that branch also carries an RTDB rules change that must ship with it. |
| `origin/claude/repo-interview-readiness-x9z7u5` | Stale (Aug 29, a README tweak, far behind `main`). | Deletable; ignore. |

Decisions made:
- **Web-only, no App Store** (see above). This is the direction, not a temporary hold.
- **Monetization = voluntary support, not sales or ads.** `support.html` + a quiet
  help-card link + a teacher-portal link, all switched on by the `SUPPORT_URL`
  build env var (https:// only; unset ⇒ hidden, page says "coming soon"). Never
  call it a charity or tax-deductible. Before ever *charging* money, check the
  LimeZu/Cainos asset licenses (permission was given for a free game).

Waiting on Justin:
1. Create a Ko-fi (or GitHub Sponsors) page → set `SUPPORT_URL` in Netlify's
   environment variables → redeploy. Then add `.github/FUNDING.yml` for the repo's
   Sponsor button. (Until then the Support link stays hidden and the page reads
   "coming soon" — the deployed default.)
2. **Verify on a real iPad now that the fixes are live** — the main untested risk
   (student sign-up/login typing, portrait/landscape, Add to Home Screen). See Open items.

Next candidates: offline support via a service worker (launch without Wi-Fi after
the first visit), an "Install Isotopia" page with Add-to-Home-Screen steps for
iPad/Android/Chromebook, then the older open items at the bottom of this file.

### Deploying
Deploy = push to `main`. Netlify auto-builds (`npm run build`, Node 18) and publishes
`dist/`. Needs the 8 `FIREBASE_*` env vars already set in Netlify (see `.env.example`)
or online features silently go offline. Justin pastes a GitHub PAT inline per push.
```bash
cd /home/nah/Claudia/isotopia
npm install
npm run build          # local sanity check
git push origin main   # → Netlify deploys
```

## What this is
**Isotopia** — a Pokémon-style pixel game for learning the periodic table. You
play a dog exploring a small town, walk up to friendly element creatures called
**Elementals**, and answer multiple-choice atomic-structure questions to catch
them and fill your **Isotopedex**. It's **offline-first**: the whole game runs
from a built-in question seed with no setup. An optional Firebase backend adds a
shared question bank, a teacher portal, email/password student registration, and
per-student progress sync. Real classroom target: an **AP Chemistry** class at
**SAD 15 (Gray–New Gloucester, Maine)** — the town is themed on Gray, Maine.

## Coordinates
| Thing | Value |
|---|---|
| Local path | `/home/nah/Claudia/isotopia` (Linux — the main and only machine now; the Mac was for the abandoned native build) |
| GitHub | https://github.com/justin-harvey/isotopia (branch `main`, public; old `G00DTECH` path redirects) |
| Live game | https://is0topia.netlify.app/ (note the **zero**). Teacher portal: `/teacher.html` |
| Firebase project | `isotopia-2809c` (Realtime Database) |
| Deploy | Netlify auto-builds from `main` (`npm run build` → publish `dist/`). **Requires the 8 `FIREBASE_*` env vars set in Netlify** (see `.env.example`) or online features silently go offline |
| Foundation | fork of [danielart/phaser-rpg-template](https://github.com/danielart/phaser-rpg-template) (MIT), Phaser 3 + grid-engine |
| Deploys | Justin pastes a GitHub PAT inline per push (use inline, don't persist) |

## Run locally
```bash
cd /home/nah/Claudia/isotopia
npm install
npm run watch    # dev server + live reload → http://localhost:10001
npm run build    # production build → dist/ (also builds dist/teacher.html)
npm run package  # build + zip -> isotopia-offline.zip (download-and-play bundle)
```
Runs fully offline with no config. Set `FIREBASE_*` env vars before building to
enable the online features.

## Controls / gameplay
- **Tap / click** to walk (arrow keys too on desktop).
- **Walk within one tile of an Elemental** to auto-start its quiz (proximity — no
  key, for iPads). Encounters open a **GBA-style battle** (enemy on a platform,
  the dog's real back sprite opposite, pixel textbox). Correct answer catches it;
  if `questionsToCatch` > 1 the enemy has a draining **HP bar**. A screen-wipe
  plays before every battle.
- **Step on a glowing ▲/▼ pad** to enter/leave a building; follow the **trail
  north** into the woods, where wild Elementals appear in the **tall grass**.
- **DEX** button (top-right) → the **Isotopedex** collection.
- **Secret path:** walk **north up column 20 of the woods to the very top** → a
  cutscene reveals the distant city → tap **"enter the city"** to walk it.

## The Elementals (16 active)
Original, copyright-safe display names (no "-mon"), set in `data/elements.ts`
(`monster` field). Element `id`s and art filenames are unchanged.

| Element | Name | Where | Element | Name | Where |
|---|---|---|---|---|---|
| Hydrogen | Hydrohop | Museum B1 | Helium | Helior | Museum B1 |
| Neon | Neonglow | town plaza | Iron | Ironclank | Hardware interior |
| Carbon | Carbocrunch | Museum B1 | Sodium | Sodazoom | Hannaford interior |
| Nitrogen | Nitronoodle | woods (wild) | Magnesium | Magflash | Auto interior |
| Oxygen | Oxypuff | woods (wild) | Uranium | Glowbun | Library interior |
| Aluminum | Aluminio | city streets | Fluorine | Fluorvex | city streets |
| Scandium | Scandion | city streets | Boron | Borolith | city streets |
| Beryllium | Beryllia | city streets | Sulfur | Brimora | city streets |

Placements live in `TestScene.MONSTER_SPAWNS`, `WoodsScene.WILD`, the `elementIds`
passed to each town `InteriorScene`, `CityScene.CITY_ELEMENTALS` (city streets), and
now populated **city interiors** — **Hydrogen, Helium and Carbon were relocated into
the Museum first basement** (`CityMuseumB1Scene`'s `elementIds` in `CityInteriors.ts`;
they were removed from the town lake / Home / woods, incl. the woods grass pool).
**Keep `data/elementalLocations.ts` (Rad Finder hints) in sync when moving one.**
Every Elemental is **cloaked** on spawn (`components/Cloak.ts`) — a steady very-faint
alpha so it's hard to spot by eye; the Rad Finder is how you're meant to find them
(walking within one tile still auto-triggers the quiz regardless of visibility).
All 16 have art in `src/assets/elementals/` (declared in `data/elementalArt.ts`).
Chlorine is retired; `isotopia-next-batch.csv` lists the next candidates.

## Architecture / key files
| Path | Purpose |
|---|---|
| `src/game.ts` | Bootstrap: mounts DEX/intro, inits student auth, loads questions + class settings, then starts Phaser. Scene list incl. CityScene |
| `src/Scenes/TestScene.ts` | Town (building-art overlays over invisible collision, lake, doors, north trail) |
| `src/Scenes/WoodsScene.ts` | Woods; wild grass encounters, the secret city-reveal trigger (col 20, top) |
| `src/Scenes/CityScene.ts` | **Walkable city** — buildings, streets, plaza props, pedestrians, talking NPCs |
| `src/Scenes/InteriorScene.ts` + Home/Hardware/Hannaford/Auto/Library | Building interiors (image backgrounds + shared collision grid) |
| `src/Scenes/GameScene.ts` | Base scene: `spawnElemental` (release-gated), `enableGrassEncounters`, `spawnPedestrian`, `spawnTalkingNpc`, `spawnCompanionNpc`, camera, embedded-map loading |
| `src/ui/QuizOverlay.ts` | GBA battle quiz (round-based, HP bar, `startBattle` wipe) |
| `src/ui/EvolveOverlay.ts` + `src/data/evolution.ts` | **Evolution Lab** (city Power Station). Three chambers — VSEPR Fusion, Hyper-Chamber (expanded octet), ΔEN Tug-of-War — fuse Elementals into compounds. `evolution.ts` holds recipes + real chemistry (EN table, geometries); products record via `progress.markEvolved`. Product art auto-loads from `assets/compounds/<id>.png` (formula-disc fallback) |
| `src/Scenes/components/Cloak.ts` | Cloaks Elementals on spawn: a steady very-faint alpha so they're hard to spot by eye (the Rad Finder is the intended way to find them). Called from `GameScene.spawnElemental` |
| `src/ui/Isotopedex.ts` | Collection screen + student account bar (email/password sign-up / log in / verify) + hidden teacher-portal entrance (hold the title) |
| `src/ui/CityReveal.ts` | The secret-path cutscene (bridge pan-out under sunset, dog on the bridge; tap → enter city) |
| `src/ui/RadFinder.ts` + `data/elementalLocations.ts` | "Rad Finder" tool (dex Tools row). Tap **Track** on an uncaught dex card to target it (`getRadTarget`/`setRadTarget`, persisted); the in-game HUD then shows a **directional arrow** rotating toward that Elemental when it's in the current scene (heat by distance), its **location hint** when it's elsewhere, or falls back to the nearest when nothing's picked. `GameScene.refreshRadFinder` registers targets in `spawnElemental` and pushes `RadReading`s from `update()`; also unlocks per-card location hints. |
| `src/ui/Intro.ts` / `NpcDialog.ts` / `icons.ts` | Help card, NPC dialog box, inline SVG icons (replaced emoji) |
| `src/data/elements.ts` / `questions.ts` / `questionSource.ts` | Elements, local seed bank, local-vs-RTDB question source |
| `src/data/progress.ts` | Seen/Caught + stats; localStorage cache, mirrors to `students/{uid}` when signed in |
| `src/data/classConfig.ts` | Class settings + 40-day release schedule; `elementReleased()` cache the game reads |
| `src/data/firebase.ts` | Firebase config from `FIREBASE_*` env (blank ⇒ offline) + lazy init |
| `src/data/auth.ts` / `studentAuth.ts` / `adminAuth.ts` | Guest anon sign-in / student **email+password** register+verify / portal sign-in (super via Google, admin via email+password) + role gate |
| `src/data/studentAdmin.ts` | Portal data: `loadRoster(classId)`/`setMembership(Bulk)` (writes `assignments/`) + `loadAdmins`/`setAdmin` (super-only role mgmt) |
| `src/data/classConfig.ts` | Per-owner class settings + `meta{name,color}` + `assignments/` resolution; game reads the student's assigned class's release schedule (`loadAndCacheSettings`) |
| `src/data/maps.ts` | **Embedded tilemaps** (test/woods/interior/city) so the game runs from `file://` (no XHR). Regenerate via `tools/embed-maps.mjs` after editing any map |
| `src/teacher.ts` + `teacher.html` + `teacher.css` | Teacher admin portal (separate rollup bundle) |
| `src/support.html` + `src/data/support.ts` | Support page (copied with `%SUPPORT_URL%` filled in by rollup-plugin-copy's `transform`) + the flag the game/portal use to show their support links |
| `src/manifest.webmanifest` + `src/assets/icon-192/512.png` | Home-screen web app (name, icon, full-screen) |
| `tools/gen_town.py` / `gen_woods.py` / `gen_city.py` / `gen_interior.py` | Regenerate each tilemap; `embed-maps.mjs` re-embeds them into `maps.ts` |
| `firebase/` | `database.rules.json`, `set-teacher.mjs`, `ADD-A-TEACHER.md`, `ACCOUNTS-SCOPE.md`, `NEXT-STEPS.md`, `serviceAccount.json` (gitignored) |

## Accounts, auth, roles, teacher portal
Three roles, two of them enforced entirely in `database.rules.json` (client UI is
just convenience — the rules are the real gate).
- **Guests** play anonymously (local progress only).
- **Students** register in-game (DEX account bar) with **email + password** — any
  email, **email verification required**. Only a *verified* user syncs progress to
  `students/{uid}`. Registering does **not** join the class: a student just lands
  in the "registrant pool" until a staff member adds them (see roster below).
- **Admins** (staff) — a promoted registrant, recorded at `admins/{uid}` in RTDB.
  They manage classes/rosters/questions but **cannot create other admins**. They
  open `/teacher.html` with the **same email + password** they registered with.
- **Super admins** — the fixed set carrying the `teacher` custom claim
  (`jharvood@gmail.com`, `aharvey@sad15.org`; Justin's mom is the teacher). Only
  supers can promote/revoke admins. **No new supers are ever minted from the app** —
  the claim only comes from `firebase/set-teacher.mjs` (`node set-teacher.mjs <UID>
  [off]`, `firebase-admin@11` on Node 18) and we don't re-run it. Supers sign into
  the portal with **Google** (`@sad15.org`). In-game, **press-and-hold the
  Isotopedex title ~1s** opens the portal.
- **One class per staff member** (super or admin), keyed by the owner's uid
  (`classes/{uid}`). Each has `meta {name,color}` (color is portal-only) — set on
  the **Class** tab; a header chip shows it. Auto-created on first portal load.
- **Portal tabs:** **Class** (name + color), **Questions** (CRUD + import seed),
  **Schedule** (40-day unlock days, per class), **Settings** (`questionsToCatch`,
  per class), **Roster** (registrant pool → bulk add/remove to *your* class),
  **Admins** (super-only: promote/revoke admins). Busy states + save toasts.
- **Membership = `assignments/{studentUid} = classId`** (one class per student;
  replaced the old `classes/*/members`). Staff-written: admins may only claim
  *unassigned* students into their own class; supers can reassign anyone. The game
  resolves a student's class from their assignment; `pushCloud` in `progress.ts`
  no longer self-joins or writes classId.

## Data model + release schedule
```
questions/{id}                 { elementId, angle, prompt, choices[4], correctIndex }   # global bank
classes/{ownerUid}/meta        { name, color, ownerUid }                                # owner or super writes
classes/{ownerUid}/settings    { questionsToCatch, unitStartDate, releaseAllNow, release:{elementId:day} }
assignments/{studentUid}       "{ownerUid}"   # student's class. STAFF-written (see rules). Source of truth.
students/{uid}                 { name, email, seen, caught, stats:{elementId:{attempts,correct}} }
admins/{uid}                   true           # SUPER-written only. Presence = admin role.
```
**Rules gates** (`firebase/database.rules.json`): `students/{uid}` write = self +
`email_verified`; reading the `students` pool + `assignments` + editing
`questions`/`dailySchedule` = *staff* (super claim OR `admins/{uid}===true`);
`classes/{cid}` write = **owner (`auth.uid===cid`) or super**; `assignments/{sid}`
write = super (any) OR admin claiming an *unassigned* student into their own class;
`admins/{uid}` write = *super* only. **No single `CLASS_ID` any more** (old
`classes/ap-chem/*` is orphaned legacy). **Release logic** (`isElementReleased`):
releaseAllNow ⇒ all visible; else an element shows only if it has an unlock day
that has arrived — **no day = hidden**; unassigned students fall back to defaults
(all released). The game reads settings **once at startup** (cached), so schedule
changes need a **game reload**.

## The city (reached via the woods secret path)
- Cutscene: `WoodsScene` movementStopped at (col 20, y≤1) → `playCityReveal(onEnter)`
  → tap → `this.switch(SceneName.City)`.
- `CityScene` + `tools/gen_city.py` (**52×72 map**, embedded): light sidewalks +
  asphalt road grid (sidewalk `gid(43,2)`, asphalt `gid(34,6)`) + cobblestone
  plaza; 9 building overlays over blank16 collision footprints; **power-tower,
  large-church, power-station are 2×**; plaza + street **trees**, **lit lamps**
  (`assets/city/lamp.png`), **benches** (`bench.png`); **8 wandering pedestrians**
  (`spawnPedestrian`, scale 0.35) + **3 talking NPCs** (`spawnTalkingNpc`). WOODS
  pad returns you. Keep `CityScene.BUILDINGS` in sync with `gen_city.PLACEMENTS`.

## The Evolution Lab (city Power Station)
The city **Power Station** is repurposed as the **Evolution Lab** (`lab: true` on
`CityPowerStationScene` in `CityInteriors.ts`): a console **technician** — a proximity
NPC on an "EVOLVE ▲" pad (`spawnEvolutionConsole`) — opens `ui/EvolveOverlay.ts`. Three
chambers, all live:
- **VSEPR Fusion** — pick a molecule, match its bond angle on a dial (±2.5°) to fuse.
  Products: H₂O, CO₂, CH₄, NH₃, BF₃, SO₂, O₂, N₂.
- **Hyper-Chamber** — expand a central atom past the octet by injecting reagents:
  SF₄ (10 e⁻, see-saw), SF₆ (12 e⁻, octahedral). He/Ne/period-2 cores **fizzle** with
  the real reason they can't expand — the AP lesson, deliberately not a faked reaction.
- **Tug-of-War** — classify a binary bond from ΔEN, then slide to the potential-energy
  well minimum (equilibrium bond length). Products: NaF, MgO, MgF₂, Al₂O₃ (ionic),
  FeS (polar covalent), steel/Fe·C (interstitial alloy).

Recipes + chemistry: `data/evolution.ts` (`FUSIONS` / `HYPERVALENTS` / `IONICS` + a
Pauling EN table). Success calls `progress.markEvolved(id)` → local key
`elemonsters.evolved.v1`, kept **out** of the cloud `students/{uid}` schema on purpose
(so a new field can't reject the RTDB write and break progress sync). **16 products,
placeholder names/tints** until art lands.

**Artwork drop-in:** the success disc loads `assets/compounds/<recipe-id>.png` if it
exists, else a tinted formula disc. Drop a PNG there + rebuild — no code change.
Filenames + spec in `src/assets/compounds/README.md`. Justin is supplying the art.
**Soft-gated:** attempts are allowed without owning the reactants (marked a "practice
simulation") so it's testable; flip to strict "must be caught" later.

## Gotchas
- **Netlify needs the 8 `FIREBASE_*` env vars** or the live site loses online features.
- **Reload the game** after changing schedule/settings (startup-cached).
- **Editing any tilemap** (gen_*.py) requires re-running `tools/embed-maps.mjs`.
- **file://-safe:** all Phaser loader paths are relative `assets/...` (not `../`);
  maps embedded; font self-hosted. Keep it that way (0 `../assets` in dist/game.js).
- **Email/Password provider must be ENABLED** in the Firebase Console (Auth →
  Sign-in method) or both student registration and admin portal login fail. And
  **redeploy rules after any change**: `firebase deploy --only database --project
  isotopia-2809c` — the frontend expects the staff/super/verified gates.
- **iPad student registration (email/password + verification link) is UNVERIFIED
  on hardware** — main risk. Verification emails need `is0topia.netlify.app` in the
  Firebase authorized domains (already set).
- Teacher-claim script needs `firebase-admin@11` (latest is ESM-only, breaks Node 18);
  run from an isolated dir (e.g. `/tmp/isotopia-admin`).
- localStorage progress key stays `elemonsters.progress.v1` (don't change the value).
- **Evolved/compound forms are local-only** (`elemonsters.evolved.v1`), deliberately
  outside the cloud `students/{uid}` record; cloud-syncing them needs a rules update.
- **`CityInteriorScene.preload` now calls `loadObjectImages()`** so a populated city
  floor (museum, lab) actually loads its Elemental/NPC art (was a latent gap — no city
  interior held Elementals before).
- **Compound art:** drop `src/assets/compounds/<id>.png` (ids in that folder's README)
  and rebuild; missing art falls back to a formula disc.

## Licensing (for the open-source release)
LimeZu "Modern Exteriors/Interiors" tilesets + character sheet are used with
**LimeZu's express permission** (free educational game). All other art (Luna
Town interiors, building/bridge artwork, the dog) authored by Justin. Code is
MIT. README credits reflect this.

## Open items / next
- **Verify on a real iPad (now live — top untested risk):** the 2026-09-29 UX pass
  (see `SESSION-HANDOFF-2026-09-29.md`) — student sign-up/login (inline errors +
  auto-verify), the Rad Finder arrow + Track, the reduced-motion battle cover, dex
  legibility/pinch-zoom, portrait/landscape, Add to Home Screen, city walking.
- **Evolution Lab follow-ups:** wire in Justin's evolved artwork (drop PNGs into
  `assets/compounds/`, filenames in its README); tighten gating to "must own the
  reactants"; add the compounds to the DEX/collection; cloud-sync evolved forms (+ a
  rules update); difficulty tuning (hide target angles, allow Hyper-Chamber overshoot).
- **PWA polish:** an "Install Isotopia" page with Add-to-Home-Screen steps for
  iPad/Android/Chromebook, then a **service worker** so it launches offline after
  the first visit.
- **Support/monetization:** stand up Ko-fi or GitHub Sponsors → set `SUPPORT_URL` in
  Netlify env → redeploy → add `.github/FUNDING.yml`.
- **Native apps (abandoned — see top):** archived only on branch `origin/mobile`
  (`MOBILE-HANDOFF.md` lives there). Not maintained. If ever revived, that branch
  also carries in-app account deletion and an RTDB rules change that must ship with
  it (`firebase deploy --only database --project isotopia-2809c`).
- **Fountain** for the plaza centre (couldn't isolate its tiles in the 16k-tile
  sheet — its centre spot is left open). More city props/NPCs/shops.
- Populate the city with gameplay (Elementals/quizzes/Gym).
- Seed the real 40-day release schedule; per-element mastery in the dashboard.
- Deferred portal UX: unsaved-changes warning; refresh the `questionsToCatch` help
  (the HP battle is live now).

## Recent history (newest first)
**2026-09-29 (cloak + museum move + Evolution Lab):** Elementals are now **cloaked**
(steady very-faint alpha, `components/Cloak.ts`) so they're hard to spot — the Rad
Finder carries finding them. Relocated **Hydrogen, Helium and Carbon into the Museum
first basement** (`CityMuseumB1`; pulled from town lake / Home / woods incl. the grass
pool; Rad Finder hints updated). Built the **Evolution Lab** in the city Power Station:
three working chambers (VSEPR Fusion, Hyper-Chamber expanded-octet, ΔEN Tug-of-War),
16 compound products, a local `markEvolved` store, and an `assets/compounds/<id>.png`
art drop-in pipeline (art pending from Justin). Fixed `CityInteriorScene.preload` not
loading object art. All shipped to `main` → live.
**2026-09-29 (UX/accessibility pass):** shipped the multi-agent code-review fixes
(details in `SESSION-HANDOFF-2026-09-29.md`) — Rad Finder redesigned as a directional
arrow toward a DEX-tracked target (+ a "LOOKOUT" woods cue); prefers-reduced-motion
(dark battle cover, no white flashes); 9–10px legible dex/auth text + re-enabled
pinch-zoom; paced-release empty-world messaging; auth polish (inline errors, busy
states, auto-verify, iPad input hints); confirmed 3 questions per Elemental.
**2026-09-27 (deploy + web-only):** decided Isotopia is **web-only** (native App
Store abandoned — no Apple ID, Mac too old); merged the day's `web-fixes` work into
`main` and pushed → Netlify deployed it live; `mobile` branch marked abandoned
(archived at `origin/mobile`), handoff rewritten for the web-only future.
**2026-09-27 (web-fixes):** "Support Isotopia" page + links (`support.html`,
`data/support.ts`, `SUPPORT_URL` env) · sign-in fields could not receive A/S/D/R/space/arrows
(Phaser's game-wide KeyboardManager preventDefault()s captured keys; the guard now
disables the manager while a field is focused) · progress sync failed for up to an
hour after verifying (ID token now force-refreshed) · 8s startup timeout → local
data · game resizes to the screen shape (portrait iPad fills the screen; rotation
handled; `GameScene.keepRoomFilled` zooms interiors to cover — fixed the white band
under city rooms) · Rad Finder meter was hidden under the tips bar; 6 city hints
were wrong · battle card fits phones · web app manifest + home-screen icons ·
Firebase config for the Netlify build is unchanged. Previously: lab favicon,
roster CSV export ·
Fixed a boot black screen (Rad Finder mounted before `<body>` existed; now all
startup DOM mounts go through `ui/domReady.onBodyReady`) · removed Neonu Reeves
(the woods companion NPC) ·
Rad Finder tool — equippable Geiger counter (dex Tools row) with dex location
hints + an in-game homing HUD, so students never get stuck ·
Per-admin classes: each staff owns one named+colored class (`classes/{uid}`),
membership via `assignments/{studentUid}` (replaced `members`), new Class tab,
per-class schedule/settings, roster scoped per class · fixed supers being written
as students (they already held the `teacher` claim; cleaned 2 stray records) ·
Email/password student registration + email verification (replaced Google
`@sad15.org` student sign-in) · teacher-controlled roster (bulk add/remove) ·
super/admin role tiers (supers promote admins; no new supers; admins sign in with
their game email+password) · RTDB rules reworked (staff/super/verified gates) ·
City tweaks (half-size people, doubled landmarks, more lamps/trees) · city
populated (streets, plaza, pedestrians, talkers) · walkable CityScene · secret
path + city-reveal cutscene · offline-playable (embedded maps, relative paths,
self-hosted font) · copyright-safe creature rename · teacher portal + Firebase
live (accounts/dashboard) · GBA battle feel · mobile-first movement + Isotopedex.
