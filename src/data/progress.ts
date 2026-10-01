// Student progress: which Elementals are Seen vs Caught (spec §4.2), plus
// per-element answer stats (attempts/correct) that power the teacher dashboard.
//
// Always cached in localStorage so guest play and offline work. When a student
// signs in (studentAuth.ts calls attachStudent), the same data is mirrored to
// their students/{uid} record in Realtime Database: on sign-in we adopt the
// cloud copy if it exists (returning student) or push the local guest progress
// up (first sign-in / migration), and every later change writes through.

import { getFirebaseApp } from './firebase';
import { getDatabase, ref, get, set } from 'firebase/database';

export type MonsterStatus = 'unseen' | 'seen' | 'caught';

interface Stat { attempts: number; correct: number; }
interface ProgressState {
    seen: Record<string, boolean>;
    caught: Record<string, boolean>;
    stats: Record<string, Stat>;
}

const STORAGE_KEY = 'elemonsters.progress.v1';

function load(): ProgressState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const p = JSON.parse(raw) as Partial<ProgressState>;
            return { seen: p.seen ?? {}, caught: p.caught ?? {}, stats: p.stats ?? {} };
        }
    } catch { /* ignore corrupt/unavailable storage */ }
    return { seen: {}, caught: {}, stats: {} };
}

function saveLocal(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* storage unavailable — progress stays in-memory this session */ }
}

let state: ProgressState = load();

// ---- Cloud sync (only active while a student is signed in) ----------------
let studentUid: string | null = null;
let studentInfo: { name: string; email: string } = { name: '', email: '' };

function db() {
    const app = getFirebaseApp();
    return app ? getDatabase(app) : undefined;
}

// Persist locally, then (if signed in) write the record through to the cloud.
function save(): void {
    saveLocal();
    void pushCloud();
}

async function pushCloud(): Promise<void> {
    const d = db();
    if (!d || !studentUid) return;
    try {
        await set(ref(d, `students/${studentUid}`), {
            name: studentInfo.name,
            email: studentInfo.email,
            seen: state.seen,
            caught: state.caught,
            stats: state.stats,
        });
        // Intentionally NOT writing class membership here: registering only
        // creates the student's own record (the "registrant pool"). A staff member
        // assigns the student to a class from the portal by writing
        // assignments/{uid} — see studentAdmin.setMembership + database.rules.json.
    } catch { /* offline / transient — local copy is still saved */ }
}

/** Called by studentAuth on sign-in. Adopt the cloud copy if it exists,
 *  otherwise migrate the local guest progress up. */
export async function attachStudent(uid: string, name: string, email: string): Promise<void> {
    studentUid = uid;
    studentInfo = { name, email };
    const d = db();
    if (!d) return;
    try {
        const snap = await get(ref(d, `students/${uid}`));
        if (snap.exists()) {
            const v = snap.val() as Partial<ProgressState>;
            state = { seen: v.seen ?? {}, caught: v.caught ?? {}, stats: v.stats ?? {} };
            saveLocal();
            await pushCloud();          // ensure name/email are current
        } else {
            await pushCloud();          // first sign-in: migrate local progress up
        }
    } catch { /* leave local state as-is if the read fails */ }
}

/** Called by studentAuth on sign-out — back to local-only. */
export function detachStudent(): void {
    studentUid = null;
}

// ---- Progress API (unchanged signatures for game code) --------------------
export function markSeen(elementId: string): void {
    if (!state.seen[elementId]) {
        state.seen[elementId] = true;
        save();
    }
}

export function markCaught(elementId: string): void {
    state.seen[elementId] = true;
    state.caught[elementId] = true;
    save();
}

/** Record one answered question for the mastery stats. */
export function recordAnswer(elementId: string, correct: boolean): void {
    const s = state.stats[elementId] ?? { attempts: 0, correct: 0 };
    s.attempts += 1;
    if (correct) s.correct += 1;
    state.stats[elementId] = s;
    save();
}

export function statusOf(elementId: string): MonsterStatus {
    if (state.caught[elementId]) return 'caught';
    if (state.seen[elementId]) return 'seen';
    return 'unseen';
}

export function isSeen(elementId: string): boolean { return statusOf(elementId) !== 'unseen'; }
export function isCaught(elementId: string): boolean { return statusOf(elementId) === 'caught'; }

export function counts(): { seen: number; caught: number } {
    return {
        seen: Object.keys(state.seen).length,
        caught: Object.keys(state.caught).length,
    };
}

// ---- Evolved / fused compound forms (Evolution Lab) -----------------------
// Stored under a SEPARATE localStorage key, deliberately outside the cloud-synced
// ProgressState above: pushCloud() writes the whole students/{uid} object, and the
// RTDB rules validate that schema — adding a field there could reject the write and
// break progress sync. Local-only for now; wiring evolved forms into cloud sync
// (plus a database.rules.json update) is a clean follow-up.
const EVOLVED_KEY = 'elemonsters.evolved.v1';

function loadEvolved(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(EVOLVED_KEY);
        if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch { /* ignore corrupt/unavailable storage */ }
    return {};
}

let evolvedState: Record<string, boolean> = loadEvolved();

function saveEvolved(): void {
    try { localStorage.setItem(EVOLVED_KEY, JSON.stringify(evolvedState)); }
    catch { /* storage unavailable — stays in-memory this session */ }
}

/** Record that the student fused a compound in the Evolution Lab. */
export function markEvolved(compoundId: string): void {
    if (!evolvedState[compoundId]) { evolvedState[compoundId] = true; saveEvolved(); }
}
export function isEvolved(compoundId: string): boolean { return !!evolvedState[compoundId]; }
export function evolvedIds(): string[] {
    return Object.keys(evolvedState).filter(k => evolvedState[k]);
}

// ---- Inventory items (chests, keys, etc.) ---------------------------------
// A tiny local-only key/value inventory, kept under its OWN localStorage key for
// the same reason as the evolved store above: it stays outside the cloud-synced
// students/{uid} schema so a new field can never reject the RTDB write. This is
// what gates progression items — e.g. the Magic Key from the forest chest, which
// opens the hidden tunnel in the Museum's lowest level (B4) to the Atlantis sanctum
// (check with hasItem(MAGIC_KEY)). Local for now; wiring to cloud is a clean
// follow-up (plus a database.rules.json update), exactly like evolved forms.
const ITEMS_KEY = 'isotopia.items.v1';

/** Well-known item ids. */
export const MAGIC_KEY = 'magic-key';
// The giant crystal the player carries out of the Atlantis sanctum once the shrine
// reaches full resonance (Enlightenment). Granted automatically in markEnlightened()
// below, and back-filled on load for players who were already enlightened before the
// item existed. This is the key half of the desert "pyramid rise" gate — combined
// with specific caught elements it raises the hidden pyramid. See DESERT-LESSON3-PLAN.md.
// Check with hasItem(GIZA_CRYSTAL).
export const GIZA_CRYSTAL = 'giza-crystal';

function loadItems(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(ITEMS_KEY);
        if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch { /* ignore corrupt/unavailable storage */ }
    return {};
}

let itemsState: Record<string, boolean> = loadItems();

function saveItems(): void {
    try { localStorage.setItem(ITEMS_KEY, JSON.stringify(itemsState)); }
    catch { /* storage unavailable — stays in-memory this session */ }
}

/** Grant an inventory item (idempotent). */
export function giveItem(id: string): void {
    if (!itemsState[id]) { itemsState[id] = true; saveItems(); }
}
export function hasItem(id: string): boolean { return !!itemsState[id]; }
export function itemIds(): string[] {
    return Object.keys(itemsState).filter(k => itemsState[k]);
}

// ---- Atlantis sanctum: Crystalline Resonance puzzle -----------------------
// Which crystal nodes the student has correctly re-attuned, plus whether the whole
// shrine reached full resonance ("Enlightenment"). Kept in its OWN local-only key
// for the same schema-safety reason as the items/evolved stores above: it stays
// outside the cloud-synced students/{uid} object so a new field can never reject the
// RTDB write. Local for now; cloud sync is a clean follow-up.
const RESONANCE_KEY = 'isotopia.resonance.v1';

interface ResonanceState { attuned: Record<string, boolean>; enlightened: boolean; }

function loadResonance(): ResonanceState {
    try {
        const raw = localStorage.getItem(RESONANCE_KEY);
        if (raw) {
            const v = JSON.parse(raw) as Partial<ResonanceState>;
            return { attuned: v.attuned ?? {}, enlightened: !!v.enlightened };
        }
    } catch { /* ignore corrupt/unavailable storage */ }
    return { attuned: {}, enlightened: false };
}

let resonanceState: ResonanceState = loadResonance();
// Back-fill the sanctum crystal for anyone who reached Enlightenment before the crystal
// item existed (markEnlightened grants it going forward; this covers past completions).
if (resonanceState.enlightened) giveItem(GIZA_CRYSTAL);

function saveResonance(): void {
    try { localStorage.setItem(RESONANCE_KEY, JSON.stringify(resonanceState)); }
    catch { /* storage unavailable — stays in-memory this session */ }
}

/** Record that a crystal node was correctly attuned (idempotent). */
export function attuneNode(id: string): void {
    if (!resonanceState.attuned[id]) { resonanceState.attuned[id] = true; saveResonance(); }
}
export function isNodeAttuned(id: string): boolean { return !!resonanceState.attuned[id]; }
export function attunedCount(): number {
    return Object.keys(resonanceState.attuned).filter(k => resonanceState.attuned[k]).length;
}
/** Mark the shrine fully resonant — set when the final node is attuned. Also grants the
 *  sanctum crystal (GIZA_CRYSTAL) the player carries out: the desert pyramid-rise gate. */
export function markEnlightened(): void {
    if (!resonanceState.enlightened) { resonanceState.enlightened = true; saveResonance(); }
    giveItem(GIZA_CRYSTAL);   // idempotent; ensures the crystal is always in sync with Enlightenment
}
export function isEnlightened(): boolean { return resonanceState.enlightened; }

// ---- Desert pyramid "rise" -------------------------------------------------
// Whether the hidden desert pyramid has been raised. The payoff of carrying the
// sanctum crystal (GIZA_CRYSTAL) to the desert — once risen it stays risen. Its
// own local-only key, same schema-safety pattern as the items/resonance stores
// (kept out of the cloud students/{uid} object). See DESERT-LESSON3-PLAN.md.
const PYRAMID_KEY = 'isotopia.pyramid.v1';

interface PyramidState { risen: boolean; }

function loadPyramid(): PyramidState {
    try {
        const raw = localStorage.getItem(PYRAMID_KEY);
        if (raw) { const v = JSON.parse(raw) as Partial<PyramidState>; return { risen: !!v.risen }; }
    } catch { /* ignore corrupt/unavailable storage */ }
    return { risen: false };
}

let pyramidState: PyramidState = loadPyramid();

function savePyramid(): void {
    try { localStorage.setItem(PYRAMID_KEY, JSON.stringify(pyramidState)); }
    catch { /* storage unavailable — stays in-memory this session */ }
}

/** Record that the desert pyramid has risen (idempotent). */
export function markPyramidRisen(): void {
    if (!pyramidState.risen) { pyramidState.risen = true; savePyramid(); }
}
export function isPyramidRisen(): boolean { return pyramidState.risen; }
