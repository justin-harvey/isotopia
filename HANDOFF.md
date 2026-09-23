# Isotopia — Session Handoff

A running summary of what this is and where it stands, so work can resume after a
context reset. Last updated 2026-09-23.

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
| Local path | `/home/nah/Claudia/isotopia` |
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

## The Elementals (9 active)
Original, copyright-safe display names (no "-mon"), set in `data/elements.ts`
(`monster` field). Element `id`s and art filenames are unchanged.

| Element | Name | Where | Element | Name | Where |
|---|---|---|---|---|---|
| Hydrogen | Hydrohop | town lake | Magnesium | Magflash | Auto interior |
| Carbon | Carbocrunch | woods (wild) | Iron | Ironclank | Hardware interior |
| Nitrogen | Nitronoodle | woods (wild) | Neon | Neonglow | town plaza |
| Oxygen | Oxypuff | woods (wild) | Uranium | Glowbun | Library interior |
| Sodium | Sodazoom | Hannaford interior | | | |

Helium & Chlorine retired (removed from `elements.ts`; seed questions remain,
harmless). 9 have real pixel art in `src/assets/elementals/`; declared in
`data/elementalArt.ts`.

## Architecture / key files
| Path | Purpose |
|---|---|
| `src/game.ts` | Bootstrap: mounts DEX/intro, inits student auth, loads questions + class settings, then starts Phaser. Scene list incl. CityScene |
| `src/Scenes/TestScene.ts` | Town (building-art overlays over invisible collision, lake, doors, north trail) |
| `src/Scenes/WoodsScene.ts` | Woods; wild grass encounters, Neonu companion, the secret city-reveal trigger (col 20, top) |
| `src/Scenes/CityScene.ts` | **Walkable city** — buildings, streets, plaza props, pedestrians, talking NPCs |
| `src/Scenes/InteriorScene.ts` + Home/Hardware/Hannaford/Auto/Library | Building interiors (image backgrounds + shared collision grid) |
| `src/Scenes/GameScene.ts` | Base scene: `spawnElemental` (release-gated), `enableGrassEncounters`, `spawnPedestrian`, `spawnTalkingNpc`, `spawnCompanionNpc`, camera, embedded-map loading |
| `src/ui/QuizOverlay.ts` | GBA battle quiz (round-based, HP bar, `startBattle` wipe) |
| `src/ui/Isotopedex.ts` | Collection screen + student account bar (email/password sign-up / log in / verify) + hidden teacher-portal entrance (hold the title) |
| `src/ui/CityReveal.ts` | The secret-path cutscene (bridge pan-out under sunset, dog on the bridge; tap → enter city) |
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

## Licensing (for the open-source release)
LimeZu "Modern Exteriors/Interiors" tilesets + character sheet are used with
**LimeZu's express permission** (free educational game). All other art (Luna
Town interiors, building/bridge artwork, the dog) authored by Justin. Code is
MIT. README credits reflect this.

## Open items / next
- **Verify on a real iPad:** student sign-in, city walking/animation + NPC dialog,
  and the new smaller pedestrian scale + doubled-building layout.
- **Fountain** for the plaza centre (couldn't isolate its tiles in the 16k-tile
  sheet — its centre spot is left open). More city props/NPCs/shops.
- Populate the city with gameplay (Elementals/quizzes/Gym).
- Seed the real 40-day release schedule; per-element mastery in the dashboard.
- Deferred portal UX: unsaved-changes warning; refresh the `questionsToCatch` help
  (the HP battle is live now).

## Recent history (newest first)
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
