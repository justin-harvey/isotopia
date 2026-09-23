// The Rad Finder — an equippable Geiger-counter tool. A student equips it from
// the Isotopedex at any time; it then (a) unlocks location hints on every dex
// card and (b) shows an in-game HUD meter that heats up as they approach the
// nearest undiscovered Elemental in the current room. Between the two, nobody
// gets stuck. Fully client-side and offline/iPad-safe, so the "clicks" are
// visual (audio is blocked on file:// and iOS Safari won't vibrate).

const KEY = 'isotopia.radfinder.v1';
let equipped = load();
const listeners: (() => void)[] = [];
let hud: HTMLDivElement | null = null;

function load(): boolean {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function isRadFinderEquipped(): boolean { return equipped; }

/** Equip / unequip. Persists, toggles the HUD, and notifies listeners (the dex
 *  re-renders its cards + tool button). */
export function setRadFinderEquipped(on: boolean): void {
    equipped = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
    syncHud();
    listeners.forEach(fn => fn());
}

export function onRadFinderChange(fn: () => void): void { listeners.push(fn); }

export interface RadReading {
    targetsInRoom: number;       // uncaught, released Elementals in the current scene
    nearestDist: number | null;  // Chebyshev tiles to the nearest, or null if none here
    dir: string | null;          // 8-way arrow toward the nearest, or null
    totalUndiscovered: number;   // uncaught Elementals across the whole game
}

/** Mount the HUD once at startup (hidden until equipped). */
export function mountRadFinder(): void {
    if (hud) return;
    hud = document.createElement('div');
    hud.className = 'radfinder';
    hud.dataset.heat = 'none';
    hud.innerHTML = `
        <div class="rf-title">⚛ Rad Finder</div>
        <div class="rf-meter"><div class="rf-fill"></div></div>
        <div class="rf-read">Scanning…</div>`;
    document.body.appendChild(hud);
    syncHud();
}

function syncHud(): void {
    if (hud) hud.classList.toggle('on', equipped);
}

/** Push a fresh reading (called by the active scene as the player moves). */
export function setRadReading(r: RadReading): void {
    if (!hud || !equipped) return;
    const fill = hud.querySelector('.rf-fill') as HTMLElement;
    const read = hud.querySelector('.rf-read') as HTMLElement;

    if (r.nearestDist == null) {
        fill.style.width = '4%';
        hud.dataset.heat = 'none';
        read.textContent = r.totalUndiscovered > 0
            ? 'No signal here — try another room'
            : 'All Elementals found! 🎉';
        return;
    }
    // Closer = hotter. dist 0..~10 tiles → intensity 100..5%.
    const intensity = Math.max(5, Math.min(100, 100 - r.nearestDist * 12));
    fill.style.width = `${intensity}%`;
    hud.dataset.heat = r.nearestDist <= 1 ? 'hot' : r.nearestDist <= 3 ? 'warm' : 'cool';
    const cpm = Math.round(intensity * 3);
    read.textContent = r.nearestDist <= 1
        ? `${r.targetsInRoom} nearby · RIGHT HERE!`
        : `${r.targetsInRoom} nearby · ${r.dir ?? ''} ${cpm} cpm`.trim();
}
