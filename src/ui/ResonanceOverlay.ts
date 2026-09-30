// The Atlantis sanctum's "Crystalline Resonance" puzzle overlay.
//
// The shrine's inscriptions are corrupted: each crystal shows a real element SYMBOL
// under a WRONG name. The player re-attunes each pedestal by picking the crystal's
// TRUE element from a few choices. A correct pick chimes and raises the Giza Core's
// resonance meter; when every node is attuned the Core hits 100% and "Enlightenment"
// triggers (persisted, and rewarded with a secret Isotopedex card).
//
// Pure DOM, like QuizOverlay / EvolveOverlay / Isotopedex, so it renders crisply on a
// projector or iPad above the Phaser canvas, and freezes the dog via the shared
// inDialogue flag while it is open.

import GlobalInfo from '../GlobalInfo';
import { RESONANCE_NODES, CrystalNode } from '../data/resonance';
import { attuneNode, isNodeAttuned, markEnlightened } from '../data/progress';

let isOpen = false;
let onCloseCb: (() => void) | undefined;
let overlay: HTMLDivElement | null = null;

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// ---- A soft WebAudio "chime" / "dissonance" (no audio assets needed) ----------
type ACtor = typeof AudioContext;
let audioCtx: AudioContext | undefined;
function ac(): AudioContext | undefined {
    try {
        const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
        const Ctx = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctx) return undefined;
        if (!audioCtx) audioCtx = new Ctx();
        return audioCtx;
    } catch { return undefined; }
}
function tone(freq: number, ms: number, type: OscillatorType, delay = 0, vol = 0.06): void {
    const ctx = ac();
    if (!ctx) return;
    try {
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + ms / 1000);
    } catch { /* audio unavailable — puzzle still works silently */ }
}
function chime(): void { tone(880, 180, 'sine'); tone(1320, 260, 'sine', 0.11); }
function dissonance(): void { tone(150, 220, 'sawtooth', 0, 0.05); }
function enlightenChord(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 900, 'sine', i * 0.09, 0.05));
}

// ---- Open / close -------------------------------------------------------------
export function openResonanceOverlay(onClose?: () => void): void {
    if (isOpen) return;
    isOpen = true;
    onCloseCb = onClose;
    setDialogue(true);

    overlay = document.createElement('div');
    overlay.className = 'res-overlay';
    overlay.innerHTML = `
        <div class="res-panel">
            <div class="res-header">
                <span class="res-title">Crystalline Resonance</span>
                <button class="res-close" aria-label="Leave the sanctum">✕</button>
            </div>
            <p class="res-intro">The Giza Core hums with dissonance. Ancient hands mislabeled every crystal.
                Re-attune each pedestal to its <b>true</b> element to restore the harmony.</p>
            <div class="res-meter" role="progressbar" aria-label="Core resonance" aria-valuemin="0" aria-valuemax="100">
                <div class="res-meter-fill"></div>
                <span class="res-meter-label"></span>
            </div>
            <div class="res-banner" hidden></div>
            <div class="res-grid"></div>
        </div>`;

    overlay.querySelector('.res-close')!.addEventListener('click', closeResonanceOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeResonanceOverlay(); });
    document.addEventListener('keydown', onKey);

    render();
    document.body.appendChild(overlay);
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { closeResonanceOverlay(); e.preventDefault(); }
}

export function closeResonanceOverlay(): void {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    overlay = null;
    isOpen = false;
    setDialogue(false);
    const cb = onCloseCb;
    onCloseCb = undefined;
    if (cb) cb();
}

// ---- Render -------------------------------------------------------------------
function render(): void {
    if (!overlay) return;
    const total = RESONANCE_NODES.length;
    const done = RESONANCE_NODES.filter(n => isNodeAttuned(n.id)).length;
    const pct = Math.round((done / total) * 100);

    const fill = overlay.querySelector('.res-meter-fill') as HTMLElement;
    const label = overlay.querySelector('.res-meter-label') as HTMLElement;
    const meter = overlay.querySelector('.res-meter') as HTMLElement;
    fill.style.width = `${pct}%`;
    label.textContent = `Core resonance ${pct}%`;
    meter.setAttribute('aria-valuenow', String(pct));
    meter.classList.toggle('full', done === total);

    const banner = overlay.querySelector('.res-banner') as HTMLElement;
    if (done === total) {
        banner.hidden = false;
        banner.innerHTML = `✦ ENLIGHTENMENT ✦<br>
            <span>Every crystal rings true. The Giza Core resonates in perfect harmony,
            and its wisdom is added to your Isotopedex.</span>`;
    } else {
        banner.hidden = true;
    }

    const grid = overlay.querySelector('.res-grid') as HTMLElement;
    grid.innerHTML = '';
    RESONANCE_NODES.forEach(node => grid.appendChild(makeNode(node)));
}

function makeNode(node: CrystalNode): HTMLDivElement {
    const el = document.createElement('div');
    const attuned = isNodeAttuned(node.id);
    el.className = `res-node ${attuned ? 'res-attuned' : 'res-dissonant'}`;
    el.style.setProperty('--gem', node.gem);

    if (attuned) {
        el.innerHTML = `
            <div class="res-crystal res-lit">${escHtml(node.symbol)}</div>
            <div class="res-true">✓ ${escHtml(node.answer)}</div>
            <div class="res-fact">${escHtml(node.fact)}</div>
            <div class="res-tag">Attuned</div>`;
        return el;
    }

    const choices = shuffled(node);
    el.innerHTML = `
        <div class="res-crystal">${escHtml(node.symbol)}</div>
        <div class="res-inscribed">reads <s>${escHtml(node.wrongLabel)}</s> · dissonant</div>
        <div class="res-q">Symbol <b>${escHtml(node.symbol)}</b>, which element is this really?</div>
        <div class="res-choices">
            ${choices.map(c => `<button class="res-choice" type="button" data-name="${escHtml(c)}">${escHtml(c)}</button>`).join('')}
        </div>
        <div class="res-hint" role="status" aria-live="polite"></div>`;

    const hint = el.querySelector('.res-hint') as HTMLElement;
    el.querySelectorAll('.res-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = (btn as HTMLElement).dataset.name;
            if (name === node.answer) {
                attuneNode(node.id);
                chime();
                const nowDone = RESONANCE_NODES.every(n => isNodeAttuned(n.id));
                if (nowDone) { markEnlightened(); enlightenChord(); }
                render();
            } else {
                dissonance();
                (btn as HTMLButtonElement).disabled = true;
                btn.classList.add('wrong');
                el.classList.remove('shake');   // restart the animation
                void (el as HTMLElement).offsetWidth;
                el.classList.add('shake');
                hint.textContent = `Dissonance. That symbol belongs to another element. Look again.`;
            }
        });
    });
    return el;
}

// Shuffle a node's choices once per open so the answer is not always first, but the
// order stays put across re-renders (cached by node id).
const shuffleCache = new Map<string, string[]>();
function shuffled(node: CrystalNode): string[] {
    const cached = shuffleCache.get(node.id);
    if (cached) return cached;
    const arr = [...node.choices];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    shuffleCache.set(node.id, arr);
    return arr;
}
