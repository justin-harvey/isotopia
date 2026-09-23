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
