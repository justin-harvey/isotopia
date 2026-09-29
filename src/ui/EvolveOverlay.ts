// The Evolution Lab overlay (opened from the console in the old Power Station).
// Pure DOM, GBA-styled like the quiz/dialog overlays. Flow:
//   chamber select  ->  molecule select  ->  VSEPR fusion mini-game  ->  success
//
// Only the VSEPR Fusion chamber (Layout 2) is live in this first cut; the other
// two chambers show as "calibrating". On a successful fuse we record the compound
// in local progress (markEvolved) and show a placeholder form until real evolved
// artwork lands.

import GlobalInfo from '../GlobalInfo';
import { COMPOUNDS, CompoundRecipe, ANGLE_TOLERANCE, missingIngredients } from '../data/evolution';
import { getElement } from '../data/elements';
import { elementalArtKey } from '../data/elementalArt';
import { isCaught, markEvolved, isEvolved } from '../data/progress';

let isOpen = false;

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

// 0xRRGGBB -> "#rrggbb"
function hexColor(tint: number): string {
    return '#' + tint.toString(16).padStart(6, '0');
}

// A small reactant sprite: real art if the element has any, else a tinted symbol
// disc (same fallback the battle uses).
function elementSprite(id: string): string {
    const el = getElement(id);
    if (!el) return '';
    if (elementalArtKey(id)) {
        return `<img class="evo-sprite" src="assets/elementals/${id}.png" alt="${el.monster}">`;
    }
    return `<span class="evo-sprite evo-sprite--disc" style="background:${hexColor(el.tint)}">${el.symbol}</span>`;
}

export function openEvolveOverlay(onClose?: () => void): void {
    if (isOpen) return;
    isOpen = true;
    setDialogue(true);

    const overlay = document.createElement('div');
    overlay.className = 'quiz-overlay evo-overlay';
    overlay.innerHTML = `
        <div class="quiz-card evo-card">
            <button class="quiz-x" aria-label="Leave the lab">✕</button>
            <div class="evo-body"></div>
        </div>`;
    const body = overlay.querySelector('.evo-body') as HTMLDivElement;

    function close(): void {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        isOpen = false;
        setDialogue(false);
        onClose?.();
    }

    // ---- Screen 1: chamber select ----------------------------------------
    function renderChambers(): void {
        body.innerHTML = `
            <div class="evo-title">⚛ EVOLUTION LAB</div>
            <div class="evo-sub">Choose an evolution chamber</div>
            <div class="evo-chambers">
                <button class="evo-chamber" data-go="fusion">
                    <span class="evo-chamber-name">VSEPR Fusion</span>
                    <span class="evo-chamber-desc">Bond Elementals into a molecule and shape its geometry.</span>
                    <span class="evo-chamber-status evo-chamber-status--on">▶ ONLINE</span>
                </button>
                <button class="evo-chamber evo-chamber--locked" disabled>
                    <span class="evo-chamber-name">Hypervalent Hyper-Chamber</span>
                    <span class="evo-chamber-desc">Expand a noble gas's octet with an aggressive reagent.</span>
                    <span class="evo-chamber-status">⧗ CALIBRATING</span>
                </button>
                <button class="evo-chamber evo-chamber--locked" disabled>
                    <span class="evo-chamber-name">Periodic Tug-of-War</span>
                    <span class="evo-chamber-desc">Weigh ΔEN to lock two Elementals into a compound.</span>
                    <span class="evo-chamber-status">⧗ CALIBRATING</span>
                </button>
            </div>`;
        (body.querySelector('[data-go="fusion"]') as HTMLButtonElement)
            .addEventListener('click', renderCompounds);
    }

    // ---- Screen 2: molecule select ---------------------------------------
    function renderCompounds(): void {
        const items = COMPOUNDS.map(c => {
            const chips = c.ingredients.map(r => {
                const have = isCaught(r.id);
                const el = getElement(r.id);
                return `<span class="evo-chip ${have ? 'evo-chip--have' : 'evo-chip--need'}">
                    ${elementSprite(r.id)}<span class="evo-chip-x">×${r.count}</span>
                    <span class="evo-chip-name">${el?.symbol ?? r.id}${have ? ' ✓' : ' ○'}</span>
                </span>`;
            }).join('');
            const made = isEvolved(c.id) ? `<span class="evo-badge">✓ MADE</span>` : '';
            return `<button class="evo-item" data-id="${c.id}">
                <span class="evo-item-head">
                    <span class="evo-item-formula">${c.formula}</span>
                    <span class="evo-item-name">${c.name}</span>
                    ${made}
                </span>
                <span class="evo-chips">${chips}</span>
            </button>`;
        }).join('');

        body.innerHTML = `
            <div class="evo-title">Fusion Chamber</div>
            <div class="evo-sub">Pick a molecule to assemble. ✓ = you've caught it.</div>
            <div class="evo-list">${items}</div>
            <div class="evo-actions"><button class="evo-back">◀ Back</button></div>`;

        body.querySelectorAll('.evo-item').forEach(btn =>
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.id!;
                const recipe = COMPOUNDS.find(c => c.id === id);
                if (recipe) renderFusion(recipe);
            }));
        (body.querySelector('.evo-back') as HTMLButtonElement)
            .addEventListener('click', renderChambers);
    }

    // ---- Screen 3: VSEPR fusion mini-game --------------------------------
    function renderFusion(recipe: CompoundRecipe): void {
        const target = recipe.bondAngle;
        // Start the dial deliberately off-target so there's something to solve.
        let angle = target >= 150 ? 96 : 174;

        const reactants = recipe.ingredients
            .map(r => `<span class="evo-react">${elementSprite(r.id)}<span class="evo-chip-x">×${r.count}</span></span>`)
            .join('<span class="evo-plus">+</span>');
        const missing = missingIngredients(recipe, isCaught);
        const missNote = missing.length
            ? `<div class="evo-warn">You haven't caught ${missing.map(m => getElement(m)?.monster ?? m).join(' & ')} yet — this run is a practice simulation.</div>`
            : '';

        body.innerHTML = `
            <div class="evo-arena-head">
                <span>FUSION ARENA: VSEPR GRID</span>
                <span class="evo-stat">STERIC ${recipe.stericNumber} · ${recipe.hybrid}</span>
            </div>
            <div class="evo-reactants">${reactants}<span class="evo-arrow">▶</span>
                <span class="evo-slot" style="border-color:${hexColor(recipe.tint)}">?</span></div>
            ${missNote}
            <div class="evo-target">Target shape: <b>${recipe.shape}</b> — aim for <b>${target}°</b></div>
            <input class="evo-dial" type="range" min="90" max="180" step="0.5" value="${angle}"
                   aria-label="Bond angle">
            <div class="evo-dialrow">
                <button class="evo-dialbtn" data-d="-0.5">◀</button>
                <span class="evo-readout">BOND ANGLE: <b class="evo-deg">${angle.toFixed(1)}</b>°</span>
                <button class="evo-dialbtn" data-d="0.5">▶</button>
            </div>
            <div class="evo-meter"><span class="evo-meter-fill"></span></div>
            <div class="evo-hint"></div>
            <div class="evo-actions">
                <button class="evo-back">◀ Back</button>
                <button class="evo-fuse" disabled>⚡ PUSH TO FUSE</button>
            </div>`;

        const dial = body.querySelector('.evo-dial') as HTMLInputElement;
        const deg = body.querySelector('.evo-deg') as HTMLElement;
        const meterFill = body.querySelector('.evo-meter-fill') as HTMLElement;
        const hint = body.querySelector('.evo-hint') as HTMLElement;
        const fuse = body.querySelector('.evo-fuse') as HTMLButtonElement;

        function refresh(): void {
            const diff = angle - target;
            const off = Math.abs(diff);
            deg.textContent = angle.toFixed(1);
            // Lone-pair repulsion meter: fuller the closer you are to the true angle.
            const closeness = Math.max(0, 1 - off / 45);
            meterFill.style.width = `${Math.round(closeness * 100)}%`;
            const locked = off <= ANGLE_TOLERANCE;
            meterFill.classList.toggle('evo-meter-fill--ok', locked);
            fuse.disabled = !locked;
            if (locked) {
                hint.textContent = '● GEOMETRY LOCKED — push to fuse!';
                hint.className = 'evo-hint evo-hint--ok';
            } else {
                hint.textContent = diff < 0 ? '▲ Widen the bond angle…' : '▼ Narrow the bond angle…';
                hint.className = 'evo-hint';
            }
        }

        function setAngle(v: number): void {
            angle = Math.min(180, Math.max(90, Math.round(v * 2) / 2));
            dial.value = String(angle);
            refresh();
        }

        dial.addEventListener('input', () => setAngle(parseFloat(dial.value)));
        body.querySelectorAll('.evo-dialbtn').forEach(b =>
            b.addEventListener('click', () =>
                setAngle(angle + parseFloat((b as HTMLElement).dataset.d!))));
        (body.querySelector('.evo-back') as HTMLButtonElement)
            .addEventListener('click', renderCompounds);
        fuse.addEventListener('click', () => {
            if (Math.abs(angle - target) > ANGLE_TOLERANCE) return;
            markEvolved(recipe.id);
            renderSuccess(recipe);
        });

        refresh();
    }

    // ---- Screen 4: success -----------------------------------------------
    function renderSuccess(recipe: CompoundRecipe): void {
        body.innerHTML = `
            <div class="evo-success">
                <div class="evo-form-disc" style="background:${hexColor(recipe.tint)}">${recipe.formula}</div>
                <div class="evo-done-title">EVOLUTION COMPLETE!</div>
                <div class="evo-done-name">${recipe.name} <span class="evo-done-formula">(${recipe.formula})</span></div>
                <div class="evo-done-geo">${recipe.shape} · ${recipe.hybrid} · ${recipe.bondAngle}°</div>
                <div class="evo-fact">${recipe.fact}</div>
                <div class="evo-note">Added to your collection — final artwork coming soon.</div>
            </div>
            <div class="evo-actions">
                <button class="evo-back">⚗ Fuse another</button>
                <button class="evo-fuse" data-done="1">Done ▶</button>
            </div>`;
        (body.querySelector('.evo-back') as HTMLButtonElement)
            .addEventListener('click', renderCompounds);
        (body.querySelector('[data-done="1"]') as HTMLButtonElement)
            .addEventListener('click', close);
    }

    function onKey(e: KeyboardEvent): void {
        if (e.key === 'Escape') { close(); e.preventDefault(); }
    }

    (overlay.querySelector('.quiz-x') as HTMLButtonElement).addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    renderChambers();
}
