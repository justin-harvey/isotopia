// Tiny runtime check for "are we running inside the Capacitor native shell?"
// Used to hide web-only affordances (e.g. the teacher-portal shortcut) in the
// iOS/Android app, which ships the student + guest experience only. On the web
// (Netlify) `window.Capacitor` is undefined, so this returns false.
export function isNativeApp(): boolean {
    const cap = (window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean; isNative?: boolean };
    }).Capacitor;
    if (!cap) return false;
    return typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : !!cap.isNative;
}
