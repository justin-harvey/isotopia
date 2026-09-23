// Teacher dashboard + roster data. Every student who registers (and verifies)
// writes a students/{uid} record; the teacher claim lets us read all of them —
// this is the "registrant pool". Class membership is a separate, teacher-only
// list at classes/{CLASS_ID}/members. loadRoster() joins the two so the portal
// can show everyone and flag who's actually on the roster; setMembership()
// adds/removes a student from the class.

import { getFirebaseApp } from './firebase';
import { getDatabase, ref, get, set, update } from 'firebase/database';
import { CLASS_ID } from './classConfig';

export interface StudentRow {
    uid: string;
    name: string;
    email: string;
    caught: number;
    seen: number;
    stats: Record<string, { attempts: number; correct: number }>;
    inClass: boolean;               // true = on the AP Chem roster (a class member)
}

function db() {
    const app = getFirebaseApp();
    return app ? getDatabase(app) : undefined;
}

/** Every registrant, flagged with whether they're on the class roster. Sorted
 *  class-members first, then by name. Requires the teacher claim (rules gate the
 *  root read of /students on auth.token.teacher). */
export async function loadRoster(): Promise<StudentRow[]> {
    const d = db();
    if (!d) return [];
    const [studSnap, memSnap] = await Promise.all([
        get(ref(d, 'students')),
        get(ref(d, `classes/${CLASS_ID}/members`)),
    ]);
    const students = studSnap.exists() ? studSnap.val() : {};
    const members: Record<string, unknown> = memSnap.exists() ? memSnap.val() : {};
    const rows: StudentRow[] = Object.keys(students).map((uid) => {
        const v = students[uid] || {};
        return {
            uid,
            name: v.name || '(unknown)',
            email: v.email || '',
            caught: v.caught ? Object.keys(v.caught).length : 0,
            seen: v.seen ? Object.keys(v.seen).length : 0,
            stats: v.stats || {},
            inClass: members[uid] === true,
        };
    });
    return rows.sort((a, b) =>
        (Number(b.inClass) - Number(a.inClass)) || a.name.localeCompare(b.name));
}

/** Add (true) or remove (false) a student from the class roster. Staff-only. */
export async function setMembership(uid: string, inClass: boolean): Promise<void> {
    const d = db();
    if (!d) return;
    await set(ref(d, `classes/${CLASS_ID}/members/${uid}`), inClass ? true : null);
}

/** Add/remove many students from the roster in one atomic write. Staff-only. */
export async function setMembershipBulk(uids: string[], inClass: boolean): Promise<void> {
    const d = db();
    if (!d || uids.length === 0) return;
    const updates: Record<string, unknown> = {};
    for (const uid of uids) {
        updates[`classes/${CLASS_ID}/members/${uid}`] = inClass ? true : null;
    }
    await update(ref(d), updates);
}

// ---- Admin role management (super-admins only) ----------------------------

export interface AdminRow {
    uid: string;
    name: string;
    email: string;
    isAdmin: boolean;               // true = a promoted admin (in admins/{uid})
}

/** Every registrant, flagged with whether they hold the admin role. Admins-first,
 *  then by name. Requires a super (rules gate reading /admins on the teacher
 *  claim). */
export async function loadAdmins(): Promise<AdminRow[]> {
    const d = db();
    if (!d) return [];
    const [studSnap, admSnap] = await Promise.all([
        get(ref(d, 'students')),
        get(ref(d, 'admins')),
    ]);
    const students = studSnap.exists() ? studSnap.val() : {};
    const admins: Record<string, unknown> = admSnap.exists() ? admSnap.val() : {};
    const rows: AdminRow[] = Object.keys(students).map((uid) => {
        const v = students[uid] || {};
        return {
            uid,
            name: v.name || '(unknown)',
            email: v.email || '',
            isAdmin: admins[uid] === true,
        };
    });
    return rows.sort((a, b) =>
        (Number(b.isAdmin) - Number(a.isAdmin)) || a.name.localeCompare(b.name));
}

/** Promote (true) or revoke (false) a registrant's admin role. Super-only —
 *  the rules require the teacher claim to write admins/{uid}. */
export async function setAdmin(uid: string, isAdmin: boolean): Promise<void> {
    const d = db();
    if (!d) return;
    await set(ref(d, `admins/${uid}`), isAdmin ? true : null);
}
