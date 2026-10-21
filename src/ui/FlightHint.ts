// A small HUD pill that tells the player how to fly — shown ONLY while wearing a
// bird (an avatar with a `fly` frame map: the gull or pigeon). Flight is otherwise
// undiscoverable on an iPad (no F key), so this surfaces the tap-yourself gesture.
// Mounted once, scene-independent (like the Avatar button); it re-checks on every
// avatar change and hides for non-flyers.

import { onBodyReady } from './domReady';
import { getCharacter } from '../data/characters';
import { getSelectedCharacter, onAvatarChange } from '../data/avatar';

let hint: HTMLDivElement | null = null;

function wearingBird(): boolean {
    return !!getCharacter(getSelectedCharacter()).fly;
}

function refresh(): void {
    if (!hint) return;
    hint.hidden = !wearingBird();
}

export function mountFlightHint(): void {
    onBodyReady(() => {
        if (hint) return;
        hint = document.createElement('div');
        hint.className = 'flight-hint';
        hint.setAttribute('role', 'status');
        hint.innerHTML = '🐦 <b>Tap yourself</b> (or press <b>F</b>) to fly';
        hint.hidden = true;
        document.body.appendChild(hint);
        onAvatarChange(refresh);
        refresh();
    });
}
