// A mobile "Call friends" button — the touch equivalent of pressing S to spawn a companion
// bird. Shown ONLY while wearing a flyer (gull/pigeon), since spawning does nothing otherwise
// and iPads have no S key. Mounted once, scene-independent (like the Avatar button + flight
// hint); a tap emits GlobalInfo 'callFriends', which the active GameScene turns into a spawn.

import { onBodyReady } from './domReady';
import { getCharacter } from '../data/characters';
import { getSelectedCharacter, onAvatarChange } from '../data/avatar';
import GlobalInfo from '../GlobalInfo';

let btn: HTMLButtonElement | null = null;

function wearingBird(): boolean {
    return !!getCharacter(getSelectedCharacter()).fly;
}

function refresh(): void {
    if (!btn) return;
    btn.hidden = !wearingBird();
}

export function mountCallFriendsButton(): void {
    onBodyReady(() => {
        if (btn) return;
        btn = document.createElement('button');
        btn.id = 'iso-call-friends';
        btn.className = 'iso-call-friends';
        btn.type = 'button';
        btn.innerHTML = '🐦 Call friends';
        btn.setAttribute('aria-label', 'Call a companion bird');
        btn.hidden = true;
        btn.addEventListener('click', () => GlobalInfo.emit('callFriends'));
        document.body.appendChild(btn);
        onAvatarChange(refresh);
        refresh();
    });
}
