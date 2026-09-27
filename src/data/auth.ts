// Startup sign-in. Realtime Database rules require `auth != null`, so we make
// sure there's an authenticated user before reading questions/settings.
//
// Students play as GUESTS by default (anonymous auth). A student may optionally
// sign in with their @sad15.org Google account to save progress (see
// studentAuth.ts) — so here we must NOT blindly create a new anonymous user if a
// (persisted) Google session is being restored, or we'd sign them out. We wait
// for Firebase to restore any existing session first, then fall back to
// anonymous only if there's nobody.

import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getGameAuth } from './firebase';

let uid: string | undefined;

/** Ensure a signed-in user (restoring a persisted one if present, otherwise
 *  anonymous). Returns the uid, or undefined if Firebase isn't configured. */
export function ensureSignedIn(): Promise<string | undefined> {
    const auth = getGameAuth();
    if (!auth) return Promise.resolve(undefined);
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();
            if (user) {
                uid = user.uid;
                resolve(uid);
            } else {
                try {
                    const cred = await signInAnonymously(auth);
                    uid = cred.user.uid;
                    resolve(uid);
                } catch {
                    resolve(undefined);
                }
            }
        });
    });
}

export function currentUid(): string | undefined {
    return uid;
}
