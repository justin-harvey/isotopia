// The 🎨 Avatar panel: a persistent corner button (mounted once, scene-independent,
// like the Isotopedex) that opens a grid of the characters the player can wear. Perli
// the dog is always available; every other character must be EARNED by beating its
// roaming NPC's extra-credit quiz (ui/UnlockQuiz → progress.unlockAvatar). Picking one
// applies it immediately — the active scene re-skins the player in place
// (GameScene.applyCharacter, via data/avatar.onAvatarChange). Opening freezes the world
// through GlobalInfo (inDialogue) exactly like the dex, so no scene handle is needed.

import GlobalInfo from '../GlobalInfo';
import { onBodyReady } from './domReady';
import { CHARACTERS, DOG_ID, type CharacterDef } from '../data/characters';
import { getSelectedCharacter, setSelectedCharacter } from '../data/avatar';
import { isAvatarUnlocked, unlockedAvatarIds } from '../data/progress';

let btn: HTMLButtonElement | null = null;
let modal: HTMLDivElement | null = null;
let gridEl: HTMLDivElement | null = null;
let countEl: HTMLSpanElement | null = null;
let isOpen = false;

export function isAvatarPanelOpen(): boolean {
    return isOpen;
}

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

// The dog is free; everything else shows once it's been unlocked.
function available(def: CharacterDef): boolean {
    return def.id === DOG_ID || isAvatarUnlocked(def.id);
}

// Crop one frame of a character's sheet into the thumbnail span (works for the dog's
// hand-drawn sheet and every pixel sheet). Pixel art gets nearest-neighbour scaling.
function paintThumb(thumb: HTMLSpanElement, def: CharacterDef): void {
    const k = 44 / def.frameHeight;
    const sheetW = def.sheetWidth || def.frameWidth;
    const cols = Math.max(1, Math.round(sheetW / def.frameWidth));
    const fr = def.thumbFrame || 0;
    const col = fr % cols, row = Math.floor(fr / cols);
    thumb.style.width = `${def.frameWidth * k}px`;
    thumb.style.height = `${def.frameHeight * k}px`;
    thumb.style.backgroundImage = `url(${def.sheet})`;
    thumb.style.backgroundSize = `${sheetW * k}px ${(def.sheetHeight || def.frameHeight) * k}px`;
    thumb.style.backgroundPosition = `${-col * def.frameWidth * k}px ${-row * def.frameHeight * k}px`;
    if (def.pixel) thumb.style.imageRendering = 'pixelated';
}

function renderGrid(): void {
    if (!gridEl) return;
    const current = getSelectedCharacter();
    gridEl.innerHTML = '';
    CHARACTERS.filter(available).forEach(def => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'iso-avatar__char' + (def.id === current ? ' iso-avatar__char--on' : '');
        b.title = def.label;
        b.setAttribute('aria-label', def.label);
        if (def.sheet) {
            const thumb = document.createElement('span');
            thumb.className = 'iso-avatar__thumb';
            paintThumb(thumb, def);
            b.appendChild(thumb);
        } else {
            b.textContent = '🐾';
        }
        b.addEventListener('click', () => {
            setSelectedCharacter(def.id);   // applies immediately (scene re-skins)
            renderGrid();
        });
        gridEl!.appendChild(b);
    });

    if (countEl) {
        const earned = unlockedAvatarIds().length;
        const total = CHARACTERS.length - 1;   // minus the always-free dog
        countEl.textContent = earned >= total
            ? 'All characters earned! 🎉'
            : `Earned ${earned} of ${total} — beat the roaming characters' quizzes to unlock more!`;
    }
}

function open(): void {
    if (isOpen) return;
    isOpen = true;
    setDialogue(true);
    renderGrid();
    modal!.style.display = 'flex';
    document.addEventListener('keydown', onKey);
}

function close(): void {
    if (!isOpen) return;
    isOpen = false;
    if (modal) modal.style.display = 'none';
    document.removeEventListener('keydown', onKey);
    setDialogue(false);
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { close(); e.preventDefault(); }
}

/** Mount the persistent 🎨 button + panel once (call from game.ts, like the dex).
 *  Deferred via onBodyReady — game.js runs before <body>, so an immediate appendChild
 *  would throw and abort the rest of boot. */
export function mountAvatarButton(): void {
    onBodyReady(mount);
}

function mount(): void {
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'iso-avatar-btn';
    btn.className = 'iso-avatar__btn';
    btn.type = 'button';
    btn.textContent = '🎨';
    btn.setAttribute('aria-label', 'Choose your avatar');
    btn.addEventListener('click', open);

    modal = document.createElement('div');
    modal.id = 'iso-avatar';
    modal.className = 'iso-avatar';
    modal.innerHTML = `
        <div class="iso-avatar__panel">
            <div class="iso-avatar__bar">
                <span class="iso-avatar__title">🎨 Your avatar</span>
                <button class="iso-avatar__close" type="button" aria-label="Close">Close &times;</button>
            </div>
            <div class="iso-avatar__chars"></div>
            <div class="iso-avatar__count"><span></span></div>
        </div>`;
    gridEl = modal.querySelector('.iso-avatar__chars');
    countEl = modal.querySelector('.iso-avatar__count span');
    modal.querySelector('.iso-avatar__close')!.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.body.appendChild(btn);
    document.body.appendChild(modal);
}
