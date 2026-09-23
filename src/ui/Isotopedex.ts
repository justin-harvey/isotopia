// The Isotopedex: a persistent corner button that opens the student's creature
// collection. Each of the 11 Elementals gets a card whose detail unlocks as it's
// Seen (encountered) then Caught (answered correctly) — see data/progress.ts.
//
// Pure DOM (like QuizOverlay) so it renders crisply on a projector/iPad and sits
// above the Phaser canvas. It lives outside the scenes, so the button persists
// across every room; the overlay is rebuilt on each open to reflect progress.

import GlobalInfo from '../GlobalInfo';
import { ELEMENTS, ElementInfo } from '../data/elements';
import { statusOf, counts } from '../data/progress';
import { elementalArtKey } from '../data/elementalArt';
import { elementReleased } from '../data/classConfig';
import {
    currentStudent, pendingVerification, onStudentAuth, signOutStudent,
    registerStudent, loginStudent, resendVerification, refreshVerification, resetStudentPassword,
} from '../data/studentAuth';
import { isFirebaseConfigured } from '../data/firebase';
import { elementalLocation } from '../data/elementalLocations';
import { isRadFinderEquipped, setRadFinderEquipped } from './RadFinder';
import { onBodyReady } from './domReady';

const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

let overlay: HTMLDivElement | null = null;

// Freeze the dog while the dex is open, via the shared flag the movement +
// proximity systems already watch.
function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

// Create the corner button once the DOM is ready. Safe to call at startup.
export function initIsotopedex(): void {
    const mount = (): void => {
        if (document.getElementById('dex-button')) return;   // already mounted
        const btn = document.createElement('button');
        btn.id = 'dex-button';
        btn.className = 'dex-button';
        btn.setAttribute('aria-label', 'Open your Isotopedex');
        btn.title = 'Isotopedex';
        btn.innerHTML = `
            <span class="dex-lens"></span>
            <span class="dex-dots"><i></i><i></i><i></i></span>
            <span class="dex-btn-label">DEX</span>`;
        btn.addEventListener('click', openIsotopedex);
        document.body.appendChild(btn);
    };
    onBodyReady(mount);
    // Keep the account bar in sync if sign-in state changes while the dex is open.
    onStudentAuth(() => { if (overlay) renderAccount(); });
}

export function openIsotopedex(): void {
    if (overlay) return;
    setDialogue(true);

    // Only released Elementals appear in the dex (locked ones stay hidden until
    // their release day), so the total grows over the unit.
    const released = ELEMENTS.filter(el => elementReleased(el.id));
    const c = counts();
    const total = released.length;

    overlay = document.createElement('div');
    overlay.className = 'dex-overlay';
    overlay.innerHTML = `
        <div class="dex-panel">
            <div class="dex-header">
                <span class="dex-title">Isotopedex</span>
                <span class="dex-counts">
                    <b>${c.caught}</b>/${total} caught &nbsp;·&nbsp; <b>${c.seen}</b>/${total} discovered
                </span>
                <button class="dex-close" aria-label="Close">✕</button>
            </div>
            <div class="dex-account"></div>
            <div class="dex-tools"></div>
            <div class="dex-grid"></div>
        </div>`;

    renderTools();
    populateGrid();

    renderAccount();
    overlay.querySelector('.dex-close')!.addEventListener('click', closeIsotopedex);
    // Click the dark backdrop (but not the panel) to close.
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeIsotopedex();
    });

    // Hidden teacher entrance: press and hold the "Isotopedex" title for ~1s to
    // open the teacher portal. Students tap cards, not hold the title, so they
    // won't stumble into it — and it's gated by Google login + the teacher claim
    // anyway. A gold underline fills while holding to signal it's working.
    const title = overlay.querySelector('.dex-title') as HTMLElement;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelHold = (): void => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = undefined; }
        title.classList.remove('holding');
    };
    title.addEventListener('pointerdown', () => {
        title.classList.add('holding');
        holdTimer = setTimeout(() => { window.location.href = 'teacher.html'; }, 1000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
        title.addEventListener(ev, cancelHold));

    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
        closeIsotopedex();
        e.preventDefault();
    }
}

export function closeIsotopedex(): void {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    overlay = null;
    setDialogue(false);
}

// The account bar in the dex header: guest vs signed-in student, with a
// sign-in / sign-out button. Re-rendered on auth changes while the dex is open.
function renderAccount(): void {
    if (!overlay) return;
    const host = overlay.querySelector('.dex-account') as HTMLElement | null;
    if (!host) return;
    // Offline build (no Firebase): no sign-in, just say progress is local.
    if (!isFirebaseConfigured()) {
        host.innerHTML = `<span class="dex-acct-label">Progress saves on this device.</span>`;
        return;
    }
    const u = currentStudent();
    const p = pendingVerification();

    // Signed in and verified — progress is syncing.
    if (u) {
        host.innerHTML = `<span class="dex-acct-label">Saving as <b>${escHtml(u.email || u.displayName || 'you')}</b></span>
            <button class="dex-auth-btn" id="dex-signout">Sign out</button>`;
        (host.querySelector('#dex-signout') as HTMLButtonElement)
            .addEventListener('click', () => { void signOutStudent(); });
        return;
    }

    // Signed in but the email link hasn't been clicked yet.
    if (p) {
        host.innerHTML = `<span class="dex-acct-label">Check <b>${escHtml(p.email || 'your email')}</b> for a
            verification link, then tap I'm verified to start saving.</span>
            <button class="dex-auth-btn" id="dex-verified">I'm verified</button>
            <button class="dex-auth-btn" id="dex-resend">Resend</button>
            <button class="dex-auth-btn" id="dex-signout">Cancel</button>`;
        (host.querySelector('#dex-verified') as HTMLButtonElement)
            .addEventListener('click', async () => {
                const ok = await refreshVerification();
                if (!ok) alert('Not verified yet. Click the link in your email, then try again.');
            });
        (host.querySelector('#dex-resend') as HTMLButtonElement)
            .addEventListener('click', () => {
                resendVerification().then(() => alert('Verification email sent.')).catch(e => alert(e.message));
            });
        (host.querySelector('#dex-signout') as HTMLButtonElement)
            .addEventListener('click', () => { void signOutStudent(); });
        return;
    }

    // Guest — offer sign up / log in.
    host.innerHTML = `<span class="dex-acct-label">Playing as <b>guest</b> — saved on this device only.</span>
        <form class="dex-auth-form" id="dex-auth-form">
            <input type="email" id="dex-email" placeholder="email" autocomplete="email" required>
            <input type="password" id="dex-pass" placeholder="password (6+)" autocomplete="current-password" required minlength="6">
            <button type="submit" class="dex-auth-btn" id="dex-login">Log in</button>
            <button type="button" class="dex-auth-btn" id="dex-signup">Sign up</button>
            <button type="button" class="dex-auth-link" id="dex-reset">Forgot password?</button>
        </form>`;
    const email = (): string => (host.querySelector('#dex-email') as HTMLInputElement).value;
    const pass = (): string => (host.querySelector('#dex-pass') as HTMLInputElement).value;
    (host.querySelector('#dex-auth-form') as HTMLFormElement)
        .addEventListener('submit', (e) => {
            e.preventDefault();
            loginStudent(email(), pass()).catch(err => alert(err.message));
        });
    (host.querySelector('#dex-signup') as HTMLButtonElement)
        .addEventListener('click', () => {
            if (!email() || pass().length < 6) { alert('Enter an email and a password of at least 6 characters.'); return; }
            registerStudent(email(), pass())
                .then(() => alert('Account created. Check your email for a verification link.'))
                .catch(err => alert(err.message));
        });
    (host.querySelector('#dex-reset') as HTMLButtonElement)
        .addEventListener('click', () => {
            if (!email()) { alert('Type your email above first, then tap Forgot password.'); return; }
            resetStudentPassword(email())
                .then(() => alert('Password reset email sent.')).catch(err => alert(err.message));
        });
}

// The tools row: currently just the Rad Finder — a Geiger counter students can
// equip any time to home in on undiscovered Elementals (an in-game meter) and see
// where each one lives (location hints on the cards below). So nobody gets stuck.
function renderTools(): void {
    if (!overlay) return;
    const host = overlay.querySelector('.dex-tools') as HTMLElement | null;
    if (!host) return;
    const on = isRadFinderEquipped();
    host.innerHTML = `
        <span class="dex-tools-label">Tools</span>
        <button class="dex-tool${on ? ' on' : ''}" id="tool-rad" aria-pressed="${on}">
            <span class="dex-tool-ico">⚛</span> Rad Finder
            <span class="dex-tool-state">${on ? 'ON' : 'OFF'}</span>
        </button>
        <span class="dex-tools-hint">${on
            ? 'Homing active. Locations shown below.'
            : 'Equip to find hard-to-spot Elementals.'}</span>`;
    (host.querySelector('#tool-rad') as HTMLButtonElement)
        .addEventListener('click', () => {
            setRadFinderEquipped(!isRadFinderEquipped());
            renderTools();
            populateGrid();     // reveal / hide the location hints
        });
}

// (Re)build the card grid. Only released Elementals appear; the Rad Finder adds a
// location hint to every not-yet-caught card.
function populateGrid(): void {
    if (!overlay) return;
    const grid = overlay.querySelector('.dex-grid') as HTMLDivElement | null;
    if (!grid) return;
    grid.innerHTML = '';
    ELEMENTS.filter(el => elementReleased(el.id))
        .sort((a, b) => a.number - b.number)
        .forEach(el => grid.appendChild(makeCard(el)));
}

// One creature card. Unseen → dark silhouette + "???"; seen/caught reveal the
// art, names and atomic-structure facts. Caught gets a gold ✓ badge. With the
// Rad Finder equipped, not-yet-caught cards also show where to find them.
function makeCard(el: ElementInfo): HTMLDivElement {
    const status = statusOf(el.id);
    const known = status !== 'unseen';

    const card = document.createElement('div');
    card.className = `dex-card dex-${status}`;

    // Portrait: real art if the Elemental has a PNG, otherwise a tinted disc
    // showing its symbol. CSS silhouettes either one while it's unseen.
    // Meaningful alt text for screen readers (hidden creatures stay hidden).
    const alt = known ? `${el.monster}, the ${el.name} Elemental` : 'Undiscovered Elemental';
    const artKey = elementalArtKey(el.id);
    const portrait = artKey
        ? `<img class="dex-art" src="assets/elementals/${el.id}.png" alt="${alt}">`
        : `<div class="dex-art dex-art-disc" style="--tint:#${el.tint.toString(16).padStart(6, '0')}" role="img" aria-label="${alt}">${el.symbol}</div>`;

    const badge =
        status === 'caught' ? `<div class="dex-badge caught">✓ Caught</div>`
        : status === 'seen' ? `<div class="dex-badge seen">Seen</div>`
        : `<div class="dex-badge locked">Undiscovered</div>`;

    const locLine = (isRadFinderEquipped() && status !== 'caught')
        ? `<div class="dex-loc">📍 ${escHtml(elementalLocation(el.id))}</div>` : '';

    card.innerHTML = `
        <div class="dex-num">#${el.number}</div>
        <div class="dex-portrait">${portrait}</div>
        <div class="dex-name">${known ? el.monster : '???'}</div>
        <div class="dex-el">${known ? `${el.symbol} · ${el.name}` : '— — —'}</div>
        <div class="dex-stats">${known
            ? `Atomic #${el.number}<br>Protons ${el.number} · Electrons ${el.number}`
            : 'Find and meet it to reveal!'}</div>
        ${locLine}
        ${badge}`;
    return card;
}
