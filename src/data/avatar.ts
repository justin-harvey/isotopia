// Which avatar the player is currently wearing. Isotopia starts everyone as Perli the
// dog; extra characters are earned by beating a walking NPC's quiz (see data/progress
// unlockedAvatars + ui/UnlockQuiz) and then chosen from the 🎨 Avatar panel. The pick is
// kept in localStorage so it survives reloads and offline play; changing it notifies the
// active scene, which re-skins the player sprite in place (GameScene.applyCharacter).

import { DOG_ID, getCharacter } from './characters';

const CHARACTER_KEY = 'isotopia:character';

// The selected character id, defaulting to the dog. Falls back to the dog if the stored
// id is unknown (e.g. a removed character), so the player can never get stuck invisible.
export function getSelectedCharacter(): string {
    let id = '';
    try { id = localStorage.getItem(CHARACTER_KEY) || ''; } catch { /* ignore */ }
    return getCharacter(id || DOG_ID).id;
}

export function setSelectedCharacter(id: string): void {
    const c = getCharacter(id).id;   // normalise to a real character id (dog if unknown)
    try { localStorage.setItem(CHARACTER_KEY, c); } catch { /* ignore */ }
    notify();
}

// Notify when the chosen avatar changes, so the active scene can re-skin the player.
type Listener = () => void;
const listeners = new Set<Listener>();
export function onAvatarChange(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
function notify(): void { listeners.forEach(fn => fn()); }
