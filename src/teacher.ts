// Isotopia — Teacher admin portal (separate page: teacher.html).
// Google sign-in (school domain) gated by the "teacher" custom claim. Lets the
// teacher edit the question bank, set the 40-day element release schedule, and
// tune capture difficulty — all written live to Realtime Database.
//
// The student game (game.ts) is untouched by this; students play as guests.

import {
    onTeacherAuth, signInTeacher, signInAdminEmail, signOutTeacher, TeacherSession, ALLOWED_DOMAIN,
} from './data/adminAuth';
import { isFirebaseConfigured } from './data/firebase';
import { supportEnabled, SUPPORT_PAGE } from './data/support';
import { ELEMENTS } from './data/elements';
import { PERIODIC_TABLE, getPeriodicElement, elementLabel } from './data/periodicTable';
import {
    ClassSettings, loadSettings, saveSettings, DEFAULT_SETTINGS,
    isElementReleased, currentUnitDay, UNIT_LENGTH_DAYS,
    ClassMeta, loadClassMeta, saveClassMeta, loadClassNames, DEFAULT_CLASS_COLOR,
    listOwnedClassIds, createClass, deleteClass, cloneSchedule,
} from './data/classConfig';
import {
    StoredQuestion, loadAllQuestions, saveQuestion, deleteQuestion, importStarterQuestions,
} from './data/questionAdmin';
import {
    loadRoster, setMembership, setMembershipBulk, loadAdmins, setAdmin, StudentRow, AdminRow,
} from './data/studentAdmin';
import { loadSeasonId, setSeason, seasonId } from './data/season';

const app = document.getElementById('app') as HTMLDivElement;

// Elements that exist as catchable Elementals in the game right now (id -> the
// creature's display name, from elements.ts). Questions on any OTHER element are
// still saved, but won't surface in gameplay until that element gets a creature.
// The portal marks these so the teacher knows which element maps to a real,
// catchable creature and which questions are just banked for later.
const PLAYABLE = new Map(ELEMENTS.map(e => [e.id, e.monster] as const));

let session: TeacherSession | null = null;
let settings: ClassSettings = { ...DEFAULT_SETTINGS };
let questions: StoredQuestion[] = [];
let tab: 'questions' | 'schedule' | 'settings' | 'students' | 'admins' | 'class' = 'questions';
let classMeta: ClassMeta | null = null;         // the SELECTED class's meta

// A staff member can own several classes (e.g. Period 1 / Period 3). These hold
// the owned class ids, which one is selected, and a cache of each class's meta
// for the header switcher labels. All tabs operate on the selected class.
let ownedClassIds: string[] = [];
let selectedClassId = '';
const ownedMetas = new Map<string, ClassMeta>();

// Margin "Getting started" guide: a persistent, collapsible checklist in the
// right gutter that walks a new teacher through name class → students sign up →
// add to roster → set schedule. `guideRoster` caches the roster-derived counts
// (filled async by fillClassSummary, reset on class switch) so the student steps
// can show live ✓s; `guideHidden` persists the teacher's dismiss choice.
const GUIDE_KEY = 'isotopia.teacher.guideHidden';
let guideHidden = false;
try { guideHidden = localStorage.getItem(GUIDE_KEY) === '1'; } catch { /* storage blocked */ }
let guideRoster: { registered: number; inClass: number } | null = null;
function persistGuide(): void { try { localStorage.setItem(GUIDE_KEY, guideHidden ? '1' : '0'); } catch { /* ignore */ } }

// The class every tab currently targets (the selected one). myClassName reads the
// selected class's meta (falls back to a generic label before it loads).
function myClassId(): string { return selectedClassId; }
function myClassName(): string { return classMeta?.name?.trim() || 'My Class'; }

// A class still wearing a starter name — used to nudge the teacher to rename it.
function isDefaultClassName(m: ClassMeta | null): boolean {
    const n = (m?.name || '').trim();
    return !n || n === 'My Class' || n === 'New class';
}

// Load the staff member's owned classes (creating a first one if they own none),
// cache each meta for the switcher, and keep/repair the selection.
async function loadClassList(ownerUid: string): Promise<void> {
    ownedClassIds = await listOwnedClassIds(ownerUid);
    if (ownedClassIds.length === 0) {
        ownedClassIds = [await createClass(ownerUid, 'My Class')];
    }
    ownedMetas.clear();
    await Promise.all(ownedClassIds.map(async cid => {
        const m = await loadClassMeta(cid);
        if (m) ownedMetas.set(cid, m);
    }));
    if (!ownedClassIds.includes(selectedClassId)) selectedClassId = ownedClassIds[0];
}

// Point every tab at `cid`: load its settings + meta, drop the stale roster cache.
async function selectClass(cid: string): Promise<void> {
    selectedClassId = cid;
    const ownerUid = session?.user.uid || cid;
    [settings, classMeta] = await Promise.all([loadSettings(cid), loadClassMeta(cid)]);
    if (!classMeta) classMeta = { name: '', color: DEFAULT_CLASS_COLOR, ownerUid };
    ownedMetas.set(cid, classMeta);
    rosterRows = [];
    guideRoster = null;     // the new class's roster counts refill on paint
}

// Create a new class, switch to it, and land on the Class tab to name it.
async function newClass(): Promise<void> {
    const ownerUid = session?.user.uid || '';
    const cid = await createClass(ownerUid, 'New class');
    if (!ownedClassIds.includes(cid)) ownedClassIds.push(cid);
    await selectClass(cid);
    tab = 'class';
    renderPortal();
}

// Delete the selected class (with its roster assignments) after a confirm. A
// teacher must always own at least one class, so the last one can't be deleted.
// On success, fall back to another owned class and repaint.
async function deleteSelectedClass(btn: HTMLButtonElement): Promise<void> {
    const ownerUid = session?.user.uid || '';
    const cid = selectedClassId;
    if (!ownerUid || !cid) return;
    if (ownedClassIds.length <= 1) {
        flash('You need at least one class — rename this one instead of deleting it.', true);
        return;
    }
    const name = (ownedMetas.get(cid)?.name || '').trim() || 'this class';
    const inClass = await loadRoster(cid).then(rs => rs.filter(r => r.inClass).length).catch(() => 0);
    const studentWarning = inClass
        ? ` Its ${inClass} student${inClass === 1 ? '' : 's'} will be unassigned (they keep their progress).`
        : '';
    if (!confirm(`Delete "${name}"?${studentWarning} This can't be undone.`)) return;
    const ok = await withBusy(btn, 'Deleting…', async () => {
        await deleteClass(ownerUid, cid);
    }, `Deleted "${name}".`);
    if (!ok) return;
    ownedClassIds = ownedClassIds.filter(id => id !== cid);
    ownedMetas.delete(cid);
    await selectClass(ownedClassIds[0]);
    if (tab === 'class' || tab === 'students') tab = 'class';
    renderPortal();
}

// Inline-rename the selected class without leaving the current tab: prompt for a
// new name, write just the meta (color preserved), refresh the switcher label.
async function renameSelectedClassInline(): Promise<void> {
    const cid = selectedClassId;
    const ownerUid = session?.user.uid || '';
    if (!cid) return;
    const current = ownedMetas.get(cid) || classMeta;
    const next = window.prompt('Rename class', current?.name || '')?.trim();
    if (next == null || next === '' || next === (current?.name || '')) return;
    const meta: ClassMeta = {
        name: next,
        color: current?.color || DEFAULT_CLASS_COLOR,
        ownerUid: current?.ownerUid || ownerUid,
    };
    try {
        await saveClassMeta(cid, meta);
        classMeta = meta;
        ownedMetas.set(cid, meta);
        flash('Class renamed.');
        renderPortal();
    } catch (e) {
        flash(e instanceof Error ? e.message : 'Could not rename the class.', true);
    }
}
let editing: StoredQuestion | null = null;      // question being added/edited
let rosterRows: StudentRow[] = [];              // cached roster (filtered client-side)
let rosterFilter = '';
let classNames = new Map<string, { name: string; color: string }>(); // other classes' names, by id
let adminRows: AdminRow[] = [];                 // cached registrant list for role mgmt
let adminFilter = '';
let pickerQuery = '';                            // element-picker search text (editor)

const esc = (s: string): string =>
    s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// A transient confirmation / error toast, bottom-centre.
function flash(msg: string, isError = false): void {
    const t = document.createElement('div');
    t.className = `toast${isError ? ' error' : ''}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2300);
}

// Run an async write with the button disabled + relabelled, so the teacher sees
// it working, can't double-submit, and gets a success/error toast. Returns true
// only if the action succeeded — the caller keeps state (e.g. an open editor) on
// failure instead of re-rendering as if it saved.
async function withBusy(
    btn: HTMLButtonElement, busyLabel: string, action: () => Promise<void>, okMsg?: string,
): Promise<boolean> {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyLabel;
    try {
        await action();
        if (okMsg) flash(okMsg);
        return true;
    } catch (err) {
        flash((err as Error).message || 'Something went wrong — not saved.', true);
        return false;
    } finally {
        btn.disabled = false;
        btn.textContent = original;
    }
}

// ---------------------------------------------------------------- boot
function boot(): void {
    if (!isFirebaseConfigured()) {
        app.innerHTML = `<div class="card"><h1>Isotopia Teacher</h1>
            <p>Firebase isn't configured yet — set <code>firebaseConfig</code> in
            <code>src/data/firebase.ts</code>.</p></div>`;
        return;
    }
    onTeacherAuth(async (s) => {
        session = s;
        if (s?.isStaff) {
            questions = await loadAllQuestions();
            // Discover this staff member's classes (adopts a legacy single class, or
            // creates a first one), then target the selected class.
            await loadClassList(s.user.uid);
            await selectClass(selectedClassId);
            // Rename-friendly first load: if the selected class still wears a starter
            // name, open the Class tab so the teacher labels their period(s).
            if (isDefaultClassName(classMeta)) tab = 'class';
        }
        render();
    });
}

// ---------------------------------------------------------------- shells
function render(): void {
    if (!session) return renderSignedOut();
    if (!session.isStaff) return renderNotAuthorized();
    renderPortal();
}

function renderSignedOut(): void {
    app.innerHTML = `<div class="card center">
        <h1>Isotopia Teacher</h1>
        <p>Super admins sign in with their <b>@${ALLOWED_DOMAIN}</b> Google account.</p>
        <button id="signin" class="btn primary">Sign in with Google</button>
        <p class="muted" style="margin-top:18px">Class admins sign in with the email
            and password they registered with in the game.</p>
        <form id="admin-email-form" class="stack">
            <input type="email" id="admin-email" placeholder="email" autocomplete="email" required>
            <input type="password" id="admin-pass" placeholder="password" autocomplete="current-password" required>
            <button type="submit" class="btn">Sign in as admin</button>
        </form>
    </div>`;
    (document.getElementById('signin') as HTMLButtonElement)
        .addEventListener('click', () => signInTeacher().catch(err => alert(err.message)));
    (document.getElementById('admin-email-form') as HTMLFormElement)
        .addEventListener('submit', (e) => {
            e.preventDefault();
            const email = (document.getElementById('admin-email') as HTMLInputElement).value;
            const pass = (document.getElementById('admin-pass') as HTMLInputElement).value;
            signInAdminEmail(email, pass).catch(err => alert(err.message));
        });
}

function renderNotAuthorized(): void {
    app.innerHTML = `<div class="card center">
        <h1>Not authorized</h1>
        <p>Signed in as <b>${esc(session!.user.email || '')}</b>, but this account
        doesn't have teacher access yet.</p>
        <button id="signout" class="btn">Sign out</button>
    </div>`;
    (document.getElementById('signout') as HTMLButtonElement)
        .addEventListener('click', () => signOutTeacher());
}

// Tabs available in the portal. The Admins tab (role management) is super-only.
function portalTabs(): [typeof tab, string][] {
    const tabs: [typeof tab, string][] = [
        ['class', 'Class'],
        ['questions', 'Questions'],
        ['schedule', 'Schedule'],
        ['settings', 'Settings'],
        ['students', 'Roster'],
    ];
    if (session?.isSuper) tabs.push(['admins', 'Admins']);
    return tabs;
}

function renderPortal(): void {
    app.innerHTML = `
        <header class="topbar">
            <span class="brand">Isotopia Teacher</span>
            <span class="class-switch">
                <span class="class-swatch" style="background:${esc(classMeta?.color || DEFAULT_CLASS_COLOR)}"></span>
                <select id="class-select" class="class-select" aria-label="Select class">
                    ${ownedClassIds.map(cid => {
                        const nm = (ownedMetas.get(cid)?.name || '').trim() || 'Untitled class';
                        return `<option value="${esc(cid)}" ${cid === selectedClassId ? 'selected' : ''}>${esc(nm)}</option>`;
                    }).join('')}
                </select>
                <button id="rename-class" class="btn small icon" title="Rename this class" aria-label="Rename this class">&#9998;</button>
                <button id="delete-class" class="btn small icon danger" title="Delete this class" aria-label="Delete this class"
                    ${ownedClassIds.length <= 1 ? 'disabled' : ''}>&#128465;</button>
                <button id="new-class" class="btn small" title="Create another class">+ Class</button>
            </span>
            <nav class="tabs" role="tablist">
                ${portalTabs().map(([t, label]) => {
                    const on = tab === t;
                    return `<button data-tab="${t}" role="tab" aria-selected="${on}" class="${on ? 'on' : ''}">${label}</button>`;
                }).join('')}
            </nav>
            <span class="who">${supportEnabled()
                    ? `<a class="support-link" href="${SUPPORT_PAGE}" target="_blank" rel="noopener">&#9829; Support Isotopia</a>` : ''}
                ${esc(session!.user.email || '')}
                <button id="signout" class="btn small">Sign out</button></span>
        </header>
        <div class="work">
            <div class="work-main">
                <div id="class-summary" class="class-summary"></div>
                <main id="panel"></main>
            </div>
            <aside id="guide" class="guide" aria-label="Setup guide"></aside>
        </div>`;

    app.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b =>
        b.addEventListener('click', () => switchTab(b.dataset.tab as typeof tab)));
    (document.getElementById('signout') as HTMLButtonElement)
        .addEventListener('click', () => signOutTeacher());

    // Class switcher: changing the dropdown re-targets every tab at that class;
    // "+ Class" creates a new one and drops you on the Class tab to name it.
    (document.getElementById('class-select') as HTMLSelectElement | null)
        ?.addEventListener('change', async (e) => {
            await selectClass((e.target as HTMLSelectElement).value);
            renderPortal();
        });
    (document.getElementById('new-class') as HTMLButtonElement | null)
        ?.addEventListener('click', () => void newClass());
    (document.getElementById('rename-class') as HTMLButtonElement | null)
        ?.addEventListener('click', () => void renameSelectedClassInline());
    (document.getElementById('delete-class') as HTMLButtonElement | null)
        ?.addEventListener('click', (e) => void deleteSelectedClass(e.currentTarget as HTMLButtonElement));

    renderGuide();
    void fillClassSummary();
    renderPanel();
}

// Switch the active tab (shared by the top nav and the margin guide's "Open …"
// jump buttons). Moves the nav highlight, repaints the panel, and refreshes the
// guide so its "current step" highlight follows along.
function switchTab(t: typeof tab): void {
    tab = t;
    editing = null;
    app.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(x => {
        const on = x.dataset.tab === t;
        x.classList.toggle('on', on);
        x.setAttribute('aria-selected', String(on));
    });
    renderPanel();
    renderGuide();
}

// Human label for a tab id (used by the guide's jump buttons).
function tabLabel(t: typeof tab): string {
    return (portalTabs().find(([id]) => id === t)?.[1]) || 'tab';
}

// The margin setup guide. A numbered, self-updating checklist that mirrors the
// real onboarding order: name the class, get students to sign up, add them to the
// roster, then set the release schedule (a 5th optional step covers the question
// bank). Each step shows ✓ when its state is satisfied, "…" while the roster is
// still loading, or its number when still to do. Steps jump to the relevant tab;
// the sign-up step offers a one-tap "Copy invite" with the game URL + steps.
// Dismissible (persisted) so a set-up teacher can collapse it to a slim reopen tab.
function renderGuide(): void {
    const host = document.getElementById('guide');
    if (!host) return;

    if (guideHidden) {
        host.classList.add('collapsed');
        host.innerHTML =
            `<button id="guide-show" class="guide-reopen" title="Show the setup guide">&#10067; Setup guide</button>`;
        (host.querySelector('#guide-show') as HTMLButtonElement)
            .addEventListener('click', () => { guideHidden = false; persistGuide(); renderGuide(); });
        return;
    }
    host.classList.remove('collapsed');

    const classNamed = !isDefaultClassName(classMeta);
    const scheduleSet = settings.releaseAllNow
        || (!!settings.unitStartDate && Object.keys(settings.release || {}).length > 0);
    const hasQuestions = questions.length > 0;
    const registered = guideRoster?.registered ?? null;
    const inClass = guideRoster?.inClass ?? null;

    type State = 'done' | 'todo' | 'wait';
    interface Step {
        n: number; tabTo: typeof tab | null; title: string; body: string;
        state: State; invite?: boolean; optional?: boolean;
    }
    const steps: Step[] = [
        {
            n: 1, tabTo: 'class', title: 'Name your class',
            body: 'Give this class a name and colour so you can tell your periods apart.',
            state: classNamed ? 'done' : 'todo',
        },
        {
            n: 2, tabTo: null, title: 'Students sign up', invite: true,
            body: 'Students open the game, tap the DEX, choose <b>Sign&nbsp;up</b>, then click the '
                + 'verification link we email them. They can’t join a class until they do.',
            state: registered == null ? 'wait' : (registered > 0 ? 'done' : 'todo'),
        },
        {
            n: 3, tabTo: 'students', title: 'Add students to the class',
            body: 'On the <b>Roster</b> tab, tick the students who signed up and press <b>Add</b> '
                + '(or <b>Add selected</b> for a batch).',
            state: inClass == null ? 'wait' : (inClass > 0 ? 'done' : 'todo'),
        },
        {
            n: 4, tabTo: 'schedule', title: 'Set the release schedule',
            body: 'On the <b>Schedule</b> tab set a unit start date (or switch on “Release everything '
                + 'now” for testing), then give each Elemental an unlock day — otherwise nothing '
                + 'appears for students.',
            state: scheduleSet ? 'done' : 'todo',
        },
        {
            n: 5, tabTo: 'questions', title: 'Build your question bank', optional: true,
            body: 'Import the starter questions or write your own so encounters quiz your content.',
            state: hasQuestions ? 'done' : 'todo',
        },
    ];
    const done = steps.filter(s => s.state === 'done').length;

    host.innerHTML = `
        <div class="guide-head">
            <span class="guide-title">Setup guide</span>
            <span class="guide-progress" title="Steps completed">${done}/${steps.length}</span>
            <button id="guide-hide" class="guide-x" title="Hide this guide" aria-label="Hide this guide">&times;</button>
        </div>
        <p class="guide-lead muted small">Get a class playing in a few steps. Jump to any tab — a
            <b>&#10003;</b> appears as each is done.</p>
        <ol class="guide-steps">
            ${steps.map(s => `
                <li class="guide-step ${s.state}${s.tabTo === tab ? ' on' : ''}${s.optional ? ' optional' : ''}">
                    <span class="guide-dot" aria-hidden="true">${s.state === 'done' ? '✓' : s.state === 'wait' ? '…' : s.n}</span>
                    <div class="guide-step-body">
                        <div class="guide-step-title">${s.title}${s.optional ? ' <span class="muted small">(optional)</span>' : ''}</div>
                        <div class="guide-step-text muted small">${s.body}</div>
                        <div class="guide-step-actions">
                            ${s.tabTo ? `<button class="btn small guide-jump" data-tab="${s.tabTo}">Open ${esc(tabLabel(s.tabTo))}</button>` : ''}
                            ${s.invite ? `<button class="btn small guide-invite">Copy invite</button>` : ''}
                        </div>
                    </div>
                </li>`).join('')}
        </ol>`;

    (host.querySelector('#guide-hide') as HTMLButtonElement)
        .addEventListener('click', () => { guideHidden = true; persistGuide(); renderGuide(); });
    host.querySelectorAll<HTMLButtonElement>('.guide-jump').forEach(b =>
        b.addEventListener('click', () => switchTab(b.dataset.tab as typeof tab)));
    const inviteBtn = host.querySelector('.guide-invite') as HTMLButtonElement | null;
    inviteBtn?.addEventListener('click', () => {
        const url = location.origin + '/';
        const text = `Play Isotopia: ${url}\n\nTap the DEX, choose "Sign up", enter your name, email and a `
            + `password, then click the verification link we email you. See you in class!`;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => flash('Invite copied — paste it to your students.'))
                .catch(() => flash('Could not copy — select and copy the game URL manually.', true));
        } else {
            flash(`Share this URL with students: ${url}`);
        }
    });
}

// A compact, always-on class-health strip under the header: how many students
// are in the selected class, their average answer accuracy, and how many
// Elementals are live right now under the current schedule. Loads the roster
// async (same source as the Roster tab); the released count is synchronous from
// the loaded settings. Shown on every tab so a teacher sees class health at a
// glance without opening the Roster tab.
async function fillClassSummary(): Promise<void> {
    const host = document.getElementById('class-summary');
    if (!host) return;
    const total = ELEMENTS.length;
    const liveNow = ELEMENTS.filter(el => isElementReleased(settings, el.id)).length;
    const liveLabel = settings.releaseAllNow
        ? `all ${total}<span class="muted"> (release-all on)</span>`
        : `${liveNow}<span class="muted"> / ${total}</span>`;
    // Paint immediately with the synchronous bits; the roster-derived numbers fill
    // in when the async load returns (kept as "…" until then).
    const strip = (students: string, accuracy: string): string => `
        <div class="summary-inner">
            <span class="class-tag"><span class="class-swatch"
                style="background:${esc(classMeta?.color || DEFAULT_CLASS_COLOR)}"></span>${esc(myClassName())}</span>
            <span class="stat" title="Students assigned to this class"><b>${students}</b> students</span>
            <span class="stat" title="Average answer accuracy across in-class students"><b>${accuracy}</b> avg accuracy</span>
            <span class="stat" title="Elementals students can catch right now, under the current schedule"><b>${liveLabel}</b> elementals live</span>
        </div>`;
    host.innerHTML = strip('…', '…');
    try {
        const rows = await loadRoster(myClassId());
        const mine = rows.filter(r => r.inClass);
        let att = 0, cor = 0;
        mine.forEach(r => { const t = statTotals(r); att += t.attempts; cor += t.correct; });
        const acc = att ? `${Math.round((cor / att) * 100)}%` : '—';
        // The class may have been switched again before this resolved — only paint
        // if the strip is still present (renderPortal replaces it on switch).
        const h = document.getElementById('class-summary');
        if (h) {
            h.innerHTML = strip(String(mine.length), acc);
            // Feed the margin guide's roster-dependent steps (sign-up / add) from
            // the same load, then repaint it so the ✓s resolve.
            guideRoster = { registered: rows.length, inClass: mine.length };
            renderGuide();
        }
    } catch {
        const h = document.getElementById('class-summary');
        if (h) h.innerHTML = strip('—', '—');
    }
}

function renderPanel(): void {
    if (tab === 'questions') return renderQuestions();
    if (tab === 'class') return renderClass();
    if (tab === 'schedule') return renderSchedule();
    if (tab === 'students') { void renderStudents(); return; }
    if (tab === 'admins') { void renderAdmins(); return; }
    renderSettings();
}

// ---------------------------------------------------------------- questions
function renderQuestions(): void {
    const panel = document.getElementById('panel') as HTMLElement;
    // Group by every element that actually has questions (questions can now be
    // tagged to any of the 118 elements, so we don't render a section per element
    // — only the ones in use), ordered by atomic number. Unknown ids sort last.
    const groups = new Map<string, StoredQuestion[]>();
    questions.forEach(q => {
        const list = groups.get(q.elementId) ?? [];
        list.push(q);
        groups.set(q.elementId, list);
    });
    const byElement = Array.from(groups.entries())
        .map(([id, qs]) => ({ id, num: getPeriodicElement(id)?.number ?? 9999, qs }))
        .sort((a, b) => a.num - b.num || a.id.localeCompare(b.id));

    panel.innerHTML = `
        <div class="row between">
            <h2>Question bank <span class="muted">(${questions.length} total)</span></h2>
            <div>
                ${questions.length === 0 ? `<button id="import" class="btn">Import starter questions</button>` : ''}
                <button id="add" class="btn primary">+ New question</button>
            </div>
        </div>
        <div id="qeditor"></div>
        <div class="qlist">
            ${questions.length === 0 ? `<p class="muted">No questions yet — add one, or import the starter set.</p>` : ''}
            ${byElement.map(g => `
                <section>
                    <h3>${esc(elementLabel(g.id))}
                        <span class="muted">(${g.qs.length})</span>
                        ${PLAYABLE.get(g.id)
                            ? `<span class="badge ok">● ${esc(PLAYABLE.get(g.id) as string)}</span>`
                            : `<span class="badge neutral">no creature yet</span>`}</h3>
                    ${g.qs.map(q => `
                        <div class="qrow">
                            <div class="qtext">
                                <div class="qprompt">${esc(q.prompt)}</div>
                                <div class="muted small">${esc(q.angle || '')} · answer:
                                    <b>${esc(q.choices[q.correctIndex] ?? '?')}</b></div>
                            </div>
                            <div class="qactions">
                                <button class="btn small" data-edit="${q.id}">Edit</button>
                                <button class="btn small danger" data-del="${q.id}">Delete</button>
                            </div>
                        </div>`).join('')}
                </section>`).join('')}
        </div>`;

    const importBtn = document.getElementById('import') as HTMLButtonElement | null;
    importBtn?.addEventListener('click', async () => {
        let imported = 0;
        const ok = await withBusy(importBtn, 'Importing…', async () => {
            imported = await importStarterQuestions();
            questions = await loadAllQuestions();
        });
        if (ok) { flash(imported ? `Imported ${imported} starter questions.` : 'Question bank already has data.'); renderQuestions(); }
    });
    (document.getElementById('add') as HTMLButtonElement).addEventListener('click', () => {
        editing = { id: '', elementId: ELEMENTS[0].id, angle: '', prompt: '', choices: ['', '', '', ''], correctIndex: 0 };
        pickerQuery = '';
        renderQuestionEditor();
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach(b =>
        b.addEventListener('click', () => {
            const q = questions.find(x => x.id === b.dataset.edit);
            if (q) { editing = { ...q, choices: [...q.choices] }; pickerQuery = ''; renderQuestionEditor(); }
        }));
    renderGuide();  // keep the guide's "question bank" step ✓ in sync
    panel.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b =>
        b.addEventListener('click', async () => {
            const q = questions.find(x => x.id === b.dataset.del);
            const preview = q ? `"${q.prompt.slice(0, 60)}${q.prompt.length > 60 ? '…' : ''}"` : 'this question';
            if (!confirm(`Delete ${preview}?`)) return;
            const ok = await withBusy(b, 'Deleting…', async () => {
                await deleteQuestion(b.dataset.del as string);
                questions = await loadAllQuestions();
            }, 'Question deleted.');
            if (ok) renderQuestions();
        }));
    if (editing) renderQuestionEditor();
}

function renderQuestionEditor(): void {
    const host = document.getElementById('qeditor') as HTMLElement;
    if (!editing) { host.innerHTML = ''; return; }
    const q = editing;
    host.innerHTML = `
        <div class="editor">
            <label>Element
                <div class="elpicker">
                    <div class="elpicker-selected" id="el-selected"></div>
                    <input id="el-search" class="elpicker-search" type="text"
                        placeholder="Search all 118 elements — name, symbol, or number…"
                        value="${esc(pickerQuery)}" autocomplete="off">
                    <div class="elpicker-hint muted small">● = has a creature in the game
                        (${PLAYABLE.size} elements, shown first). Questions on other elements
                        are saved, but won't appear in gameplay until that element gets a creature.</div>
                    <div class="elpicker-grid" id="el-grid"></div>
                </div>
            </label>
            <label>Angle / topic
                <input id="f-angle" value="${esc(q.angle || '')}" placeholder="protons, ion, valence…">
            </label>
            <label>Question prompt
                <textarea id="f-prompt" rows="2" placeholder="How many protons…">${esc(q.prompt)}</textarea>
            </label>
            <fieldset class="choices">
                <legend>Answer choices — select the correct one</legend>
                ${q.choices.map((c, i) => `
                    <label class="choice">
                        <input type="radio" name="correct" value="${i}" ${i === q.correctIndex ? 'checked' : ''}
                            aria-label="Mark choice ${i + 1} correct">
                        <input class="f-choice" data-i="${i}" value="${esc(c)}" placeholder="Choice ${i + 1}"
                            aria-label="Choice ${i + 1} text">
                    </label>`).join('')}
            </fieldset>
            <div class="row">
                <button id="q-save" class="btn primary">Save question</button>
                <button id="q-cancel" class="btn">Cancel</button>
            </div>
        </div>`;

    // The element picker writes straight to q.elementId as the teacher clicks, so
    // it's already set by save time (no <select> to read).
    wireElementPicker(host, q);

    (document.getElementById('q-cancel') as HTMLButtonElement).addEventListener('click', () => { editing = null; renderQuestions(); });
    const saveBtn = document.getElementById('q-save') as HTMLButtonElement;
    saveBtn.addEventListener('click', async () => {
        q.angle = (document.getElementById('f-angle') as HTMLInputElement).value.trim();
        q.prompt = (document.getElementById('f-prompt') as HTMLTextAreaElement).value.trim();
        q.choices = Array.from(host.querySelectorAll<HTMLInputElement>('.f-choice')).map(i => i.value.trim());
        q.correctIndex = Number((host.querySelector('input[name="correct"]:checked') as HTMLInputElement).value);
        if (!q.prompt || q.choices.some(c => !c)) { flash('Fill in the prompt and all four choices.', true); return; }
        // Keep the editor open on failure (withBusy returns false) so nothing is lost.
        const ok = await withBusy(saveBtn, 'Saving…', async () => {
            await saveQuestion(q);
            questions = await loadAllQuestions();
        }, 'Question saved.');
        if (ok) { editing = null; renderQuestions(); }
    });

    // Bring the editor into view when opened from a question low in the list.
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// The searchable element picker inside the question editor. Any of the 118
// elements can be chosen — a dropdown of that many is unusable, so this is a
// filterable grid. Selection writes straight to `q.elementId`; only the grid +
// the "selected" line re-render on each keystroke, so the search box keeps focus.
function wireElementPicker(host: HTMLElement, q: StoredQuestion): void {
    const search = host.querySelector('#el-search') as HTMLInputElement;
    fillElementPicker(host, q);
    search.addEventListener('input', () => { pickerQuery = search.value; fillElementPicker(host, q); });
    // Enter picks the single remaining match — fast keyboard entry for teachers.
    search.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const matches = filterElements(pickerQuery);
        if (matches.length >= 1) { q.elementId = matches[0].id; fillElementPicker(host, q); }
    });
}

function filterElements(query: string): typeof PERIODIC_TABLE {
    const term = query.trim().toLowerCase();
    if (!term) return PERIODIC_TABLE;
    return PERIODIC_TABLE.filter(el =>
        el.name.toLowerCase().includes(term) ||
        el.symbol.toLowerCase() === term ||
        el.symbol.toLowerCase().startsWith(term) ||
        String(el.number) === term);
}

function fillElementPicker(host: HTMLElement, q: StoredQuestion): void {
    const selectedLine = host.querySelector('#el-selected') as HTMLElement;
    const grid = host.querySelector('#el-grid') as HTMLElement;
    const sel = getPeriodicElement(q.elementId);
    const monster = PLAYABLE.get(q.elementId);
    const selName = sel ? `${esc(sel.symbol)} · ${esc(sel.name)}` : esc(q.elementId);
    selectedLine.innerHTML = monster
        ? `Selected: <b>${selName}</b> — creature <b>${esc(monster)}</b> <span class="badge ok">catchable now</span>`
        : `Selected: <b>${selName}</b> <span class="badge neutral">no creature yet · banked</span>`;

    // Catchable elements first (so the "real" ones are easy to find), then by
    // atomic number.
    const matches = filterElements(pickerQuery).slice().sort((a, b) =>
        (PLAYABLE.has(a.id) ? 0 : 1) - (PLAYABLE.has(b.id) ? 0 : 1) || a.number - b.number);
    grid.innerHTML = matches.length === 0
        ? `<p class="muted small">No element matches that.</p>`
        : matches.map(el => {
            const mon = PLAYABLE.get(el.id);
            return `<button type="button" class="elcell${el.id === q.elementId ? ' on' : ''}${mon ? ' playable' : ''}" data-el="${el.id}"
                title="${esc(el.name)} · atomic number ${el.number}${mon ? ` — creature ${esc(mon)}` : ' — no creature yet'}">
                <span class="elnum">${mon ? '● ' : ''}${el.number}</span>
                <span class="elsym">${esc(el.symbol)}</span>
                <span class="elname">${esc(el.name)}</span>
            </button>`;
        }).join('');

    grid.querySelectorAll<HTMLButtonElement>('.elcell').forEach(b =>
        b.addEventListener('click', () => { q.elementId = b.dataset.el as string; fillElementPicker(host, q); }));
}

// ---------------------------------------------------------------- schedule
// Format the calendar date for a given unit day (day 1 = unitStartDate), or null
// if no start date is set yet.
function dateForUnitDay(s: ClassSettings, day: number): Date | null {
    if (!s.unitStartDate) return null;
    const start = new Date(s.unitStartDate + 'T00:00:00');
    return new Date(start.getTime() + (day - 1) * 86_400_000);
}
const fmtDate = (d: Date): string =>
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// The read-only "rollout" preview: exactly what students experience, built from
// the same release math the game uses (isElementReleased / currentUnitDay). The
// teacher sees which Elementals unlock on which day, in order, with today marked.
function rolloutTimeline(s: ClassSettings): string {
    const today = currentUnitDay(s);
    // Group the catchable Elementals by their scheduled unlock day.
    const byDay = new Map<number, typeof ELEMENTS>();
    const unscheduled: typeof ELEMENTS = [];
    ELEMENTS.forEach(el => {
        const d = s.release[el.id];
        if (d == null) { unscheduled.push(el); return; }
        const list = byDay.get(d) ?? [];
        list.push(el);
        byDay.set(d, list);
    });
    const days = Array.from(byDay.keys()).sort((a, b) => a - b);
    const chip = (el: typeof ELEMENTS[number]): string =>
        `<span class="el-chip" title="${esc(el.name)} — creature ${esc(el.monster)}">
            <b>${esc(el.symbol)}</b> ${esc(el.monster)}</span>`;

    if (days.length === 0 && unscheduled.length === ELEMENTS.length) {
        return `<div class="rollout-empty muted small">No unlock days set yet — every
            Elemental is in "not yet scheduled" below. Give elements a day in the table
            to build the rollout, or leave "Release everything now" on to show them all.</div>`;
    }

    const dayBlocks = days.map(d => {
        const date = dateForUnitDay(s, d);
        // Released state mirrors the game: everything is "released" under the testing
        // override; otherwise it depends on whether this day has arrived.
        const released = s.releaseAllNow || (!!s.unitStartDate && d <= today);
        const isToday = !s.releaseAllNow && !!s.unitStartDate && d === today;
        const cls = ['rollout-day', isToday ? 'today' : '', released ? 'released' : 'upcoming'].filter(Boolean).join(' ');
        return `<div class="${cls}">
            <div class="day-head">
                <span class="day-num">Day ${d}</span>
                ${date ? `<span class="muted small">${esc(fmtDate(date))}</span>` : ''}
                ${isToday ? `<span class="badge ok">today</span>`
                    : released ? `<span class="badge ok">released</span>`
                    : `<span class="badge lock">upcoming</span>`}
            </div>
            <div class="day-els">${(byDay.get(d) as typeof ELEMENTS).map(chip).join('')}</div>
        </div>`;
    }).join('');

    const unsched = unscheduled.length === 0 ? '' : `
        <div class="rollout-day unscheduled">
            <div class="day-head"><span class="day-num">Not yet scheduled</span>
                <span class="muted small">hidden from students until given a day</span></div>
            <div class="day-els">${unscheduled.map(chip).join('')}</div>
        </div>`;

    return `<div class="rollout">${dayBlocks}${unsched}</div>`;
}

function renderSchedule(): void {
    const panel = document.getElementById('panel') as HTMLElement;
    const day = currentUnitDay(settings);
    panel.innerHTML = `
        <h2>Release schedule <span class="muted">(${UNIT_LENGTH_DAYS}-day unit)</span></h2>
        <p class="muted small sched-audience">
            <b id="sched-count">…</b> in <span class="class-tag"><span class="class-swatch"
                style="background:${esc(classMeta?.color || DEFAULT_CLASS_COLOR)}"></span>${esc(myClassName())}</span>
            follow the rollout below — the same order and timing students see in the game.</p>
        <div class="grid2">
            <label>Unit start date (day 1)
                <input type="date" id="s-start" value="${esc(settings.unitStartDate)}">
            </label>
            <label class="check">
                <input type="checkbox" id="s-all" ${settings.releaseAllNow ? 'checked' : ''}>
                Release everything now (testing)
            </label>
        </div>
        ${settings.releaseAllNow
            ? `<div class="warn">"Release everything now" is on — students can catch <b>every</b> Elemental regardless of the days below. The timeline shows the rollout that will apply once you turn this off.</div>`
            : (!settings.unitStartDate
                ? `<div class="warn">Set a unit start date, or nothing unlocks: while "Release everything now" is off, every element without a reached unlock day stays hidden.</div>`
                : `<p class="muted small">Today is <b>day ${day}</b> of ${UNIT_LENGTH_DAYS}.</p>`)}

        <h3 style="margin-top:22px">Rollout — what your students see</h3>
        ${rolloutTimeline(settings)}

        <h3 style="margin-top:26px">Set unlock days</h3>
        <p class="muted small">Give each Elemental the unit day (1–${UNIT_LENGTH_DAYS}) it unlocks.
            Leave blank to keep it hidden. The rollout above updates when you save.</p>
        <table class="sched">
            <thead><tr><th>Element</th><th>Unlock day (1–${UNIT_LENGTH_DAYS})</th><th>Status now</th></tr></thead>
            <tbody>
                ${ELEMENTS.map(el => {
                    const released = isElementReleased(settings, el.id);
                    return `<tr>
                        <td>${esc(el.symbol)} · ${esc(el.name)} <span class="muted small">${esc(el.monster)}</span></td>
                        <td><input type="number" min="1" max="${UNIT_LENGTH_DAYS}" class="s-day"
                             data-el="${el.id}" value="${settings.release[el.id] ?? ''}" placeholder="—"></td>
                        <td><span class="badge ${released ? 'ok' : 'lock'}">${released ? 'Released' : 'Locked'}</span></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        <div class="row"><button id="sched-save" class="btn primary">Save schedule</button></div>`;

    // Fill the audience line with the live in-class count (async — same roster the
    // Roster tab shows), so the schedule names who it applies to.
    const countEl = document.getElementById('sched-count') as HTMLElement;
    void loadRoster(myClassId()).then(rows => {
        const n = rows.filter(r => r.inClass).length;
        countEl.textContent = n === 0 ? 'No students yet' : `${n} student${n === 1 ? '' : 's'}`;
        if (n === 0) countEl.insertAdjacentHTML('afterend',
            ` <span class="muted small">— add them on the <b>Roster</b> tab.</span>`);
    }).catch(() => { countEl.textContent = 'Your students'; });

    const schedSaveBtn = document.getElementById('sched-save') as HTMLButtonElement;
    schedSaveBtn.addEventListener('click', async () => {
        settings.unitStartDate = (document.getElementById('s-start') as HTMLInputElement).value;
        settings.releaseAllNow = (document.getElementById('s-all') as HTMLInputElement).checked;
        const release: Record<string, number> = {};
        panel.querySelectorAll<HTMLInputElement>('.s-day').forEach(i => {
            const v = parseInt(i.value, 10);
            if (!Number.isNaN(v)) release[i.dataset.el as string] = Math.max(1, Math.min(UNIT_LENGTH_DAYS, v));
        });
        settings.release = release;
        // Re-render on success so the status badges + any clamped day values refresh.
        const ok = await withBusy(schedSaveBtn, 'Saving…', async () => { await saveSettings(myClassId(), settings); }, 'Schedule saved.');
        if (ok) { renderSchedule(); void fillClassSummary(); }
    });

    renderCloneSchedule(panel);
}

// "Copy this schedule to another class" — only meaningful with ≥2 owned classes.
// Copies the current class's rollout (unlock days + start date + release-all) into
// a sibling class the teacher owns, so the same unit across periods isn't re-entered.
function renderCloneSchedule(panel: HTMLElement): void {
    const others = ownedClassIds.filter(cid => cid !== selectedClassId);
    if (others.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'clone-sched';
    wrap.innerHTML = `
        <h3 style="margin-top:26px">Copy this schedule to another class</h3>
        <p class="muted small">Running the same unit in another period? Copy
            <b>${esc(myClassName())}</b>'s unlock days, start date, and the "release everything now"
            setting into another class you own. It overwrites that class's rollout.</p>
        <div class="row toolbar">
            <select id="clone-target" class="class-select-wide" aria-label="Copy schedule to">
                ${others.map(cid => {
                    const nm = (ownedMetas.get(cid)?.name || '').trim() || 'Untitled class';
                    return `<option value="${esc(cid)}">${esc(nm)}</option>`;
                }).join('')}
            </select>
            <button id="clone-run" class="btn">Copy schedule</button>
        </div>`;
    panel.appendChild(wrap);
    const runBtn = wrap.querySelector('#clone-run') as HTMLButtonElement;
    runBtn.addEventListener('click', async () => {
        const target = (wrap.querySelector('#clone-target') as HTMLSelectElement).value;
        const targetName = (ownedMetas.get(target)?.name || '').trim() || 'that class';
        if (!confirm(`Copy ${myClassName()}'s schedule into "${targetName}"? This overwrites its rollout.`)) return;
        await withBusy(runBtn, 'Copying…', async () => {
            await cloneSchedule(selectedClassId, target);
        }, `Schedule copied to "${targetName}".`);
    });
}

// ---------------------------------------------------------------- settings
function renderSettings(): void {
    const panel = document.getElementById('panel') as HTMLElement;
    // The season control is global + destructive, so super-only.
    const seasonCard = session?.isSuper ? `
        <h2 style="margin-top:32px">Season</h2>
        <p class="muted small">Starting a new season resets <strong>every</strong> student's
            Isotopedex — collection, answer stats, evolutions, items, and puzzle
            progress — the next time they open the game. Names, emails, and class
            assignments are kept. Use this once when testing ends and the official
            season begins. Set a new label (e.g. <code>2026-fall</code>) and save.</p>
        <label>Season label
            <input type="text" id="season-id" placeholder="e.g. 2026-fall" value="">
        </label>
        <p class="muted small">Current season: <span id="season-current">loading…</span></p>
        <div class="row"><button id="season-save" class="btn danger">Start new season (reset all dexes)</button></div>` : '';

    panel.innerHTML = `
        <h2>Game settings</h2>
        <label>Correct answers needed to catch an Elemental
            <input type="number" id="g-catch" min="1" max="5" value="${settings.questionsToCatch}">
        </label>
        <p class="muted small">1 = catch on the first correct answer. Higher values
            turn each encounter into a short battle (used when the HP-bar battle lands).</p>
        <div class="row"><button id="set-save" class="btn primary">Save settings</button></div>
        ${seasonCard}`;

    const setSaveBtn = document.getElementById('set-save') as HTMLButtonElement;
    setSaveBtn.addEventListener('click', async () => {
        const v = parseInt((document.getElementById('g-catch') as HTMLInputElement).value, 10);
        settings.questionsToCatch = Math.max(1, Math.min(5, Number.isNaN(v) ? 1 : v));
        const ok = await withBusy(setSaveBtn, 'Saving…', async () => { await saveSettings(myClassId(), settings); }, 'Settings saved.');
        if (ok) renderSettings();
    });

    if (session?.isSuper) {
        const curEl = document.getElementById('season-current') as HTMLSpanElement;
        void loadSeasonId().then(id => { curEl.textContent = id || '(none set)'; });
        const seasonSaveBtn = document.getElementById('season-save') as HTMLButtonElement;
        seasonSaveBtn.addEventListener('click', async () => {
            const id = (document.getElementById('season-id') as HTMLInputElement).value.trim();
            if (!id) { alert('Enter a season label first.'); return; }
            if (id === seasonId()) { alert('That is already the current season.'); return; }
            if (!confirm(`Start season "${id}"? This resets every student's dex on next load. This cannot be undone.`)) return;
            const ok = await withBusy(seasonSaveBtn, 'Starting…', async () => { await setSeason(id); }, `Season "${id}" started — all dexes will reset.`);
            if (ok) renderSettings();
        });
    }
}

// ---------------------------------------------------------------- class
// Name + color the SELECTED class (a teacher may own several). Color is
// portal-only (students never see it).
const CLASS_COLORS = ['#3a7afe', '#e2584d', '#2f9e57', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#64748b'];

function renderClass(): void {
    const panel = document.getElementById('panel') as HTMLElement;
    const meta = classMeta || { name: '', color: DEFAULT_CLASS_COLOR, ownerUid: myClassId() };
    let chosen = meta.color;
    panel.innerHTML = `<h2>Class</h2>
        <p class="muted small">Name your class and pick a color — this is how your
            class shows in the portal. Students never see the color.</p>
        <form id="class-form" class="stack" style="max-width:360px;margin:14px 0 0">
            <label class="fld">Class name
                <input id="class-name" type="text" maxlength="60" placeholder="e.g. AP Chem — Period 3" value="${esc(meta.name)}">
            </label>
            <div class="fld">Color
                <div class="swatches">
                    ${CLASS_COLORS.map(c => `<button type="button" class="swatch-pick${c.toLowerCase() === meta.color.toLowerCase() ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
                </div>
            </div>
            <button type="submit" class="btn primary" id="class-save">Save class</button>
        </form>`;
    const swatches = panel.querySelectorAll<HTMLButtonElement>('.swatch-pick');
    swatches.forEach(b => b.addEventListener('click', () => {
        chosen = b.dataset.color as string;
        swatches.forEach(x => x.classList.toggle('on', x === b));
    }));
    (panel.querySelector('#class-form') as HTMLFormElement).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (panel.querySelector('#class-name') as HTMLInputElement).value.trim();
        const saveBtn = panel.querySelector('#class-save') as HTMLButtonElement;
        const next: ClassMeta = { name, color: chosen, ownerUid: meta.ownerUid || session!.user.uid };
        const ok = await withBusy(saveBtn, 'Saving…', async () => { await saveClassMeta(myClassId(), next); }, 'Class saved.');
        if (ok) {
            classMeta = next;
            ownedMetas.set(myClassId(), next);          // refresh the switcher label
            renderPortal();                             // repaint header + switcher, stay on tab
        }
    });
}

// ---------------------------------------------------------------- roster
// Everyone who has registered (and verified their email) lands here. Staff tick
// students and bulk add/remove them to the class, or use the per-row button.
// Registrants who aren't added just sit here harmlessly.
async function renderStudents(): Promise<void> {
    const panel = document.getElementById('panel') as HTMLElement;
    const intro = `<p class="muted small">Registrants for <b>${esc(myClassName())}</b>.
        Tick students and use the bulk buttons, or the per-row button. Students
        already in another class can't be claimed${session?.isSuper ? '' : ' (ask a super admin to move them)'}.</p>`;
    panel.innerHTML = `<div class="row between"><h2>Roster</h2>
        <button id="stu-refresh" class="btn">Refresh</button></div>${intro}
        <p class="muted">Loading…</p>`;
    document.getElementById('stu-refresh')?.addEventListener('click', () => void renderStudents());

    rosterRows = await loadRoster(myClassId()).catch(() => []);
    // Resolve the names of the OTHER classes students are in, so each kid shows
    // up under a named class rather than an anonymous "another class".
    const otherClassIds = rosterRows
        .filter(r => r.assignedElsewhere && r.assignedClassId)
        .map(r => r.assignedClassId as string);
    classNames = otherClassIds.length
        ? await loadClassNames(otherClassIds).catch(() => new Map())
        : new Map();
    if (rosterRows.length === 0) {
        panel.innerHTML = `<div class="row between"><h2>Roster</h2>
            <button id="stu-refresh" class="btn">Refresh</button></div>${intro}
            <p class="muted">No one has registered yet. Have students open the DEX,
            tap "Sign up", and click the verification link in their email.</p>`;
        document.getElementById('stu-refresh')?.addEventListener('click', () => void renderStudents());
        return;
    }

    const inClass = rosterRows.filter(r => r.inClass).length;
    panel.innerHTML = `<div class="row between">
            <h2>Roster <span class="muted">(${inClass} in class / ${rosterRows.length} registered)</span></h2>
            <button id="stu-refresh" class="btn">Refresh</button></div>${intro}
        <div class="row toolbar">
            <input id="roster-filter" class="filter" type="search" placeholder="Filter by name or email…" value="${esc(rosterFilter)}">
            <button id="bulk-add" class="btn">Add selected to class</button>
            <button id="bulk-remove" class="btn">Remove selected</button>
            <button id="export-csv" class="btn">Export CSV</button>
        </div>
        <div id="roster-table"></div>`;
    document.getElementById('stu-refresh')?.addEventListener('click', () => void renderStudents());
    const filterEl = document.getElementById('roster-filter') as HTMLInputElement;
    filterEl.addEventListener('input', () => { rosterFilter = filterEl.value; paintRoster(); });
    document.getElementById('bulk-add')!.addEventListener('click', () => void bulkRoster(true));
    document.getElementById('bulk-remove')!.addEventListener('click', () => void bulkRoster(false));
    document.getElementById('export-csv')!.addEventListener('click', () => exportRosterCsv());
    paintRoster();
}

function filteredRoster(): StudentRow[] {
    const q = rosterFilter.trim().toLowerCase();
    if (!q) return rosterRows;
    return rosterRows.filter(r =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
}

/** Sum attempts/correct across all elements for one student. */
function statTotals(r: StudentRow): { attempts: number; correct: number } {
    let attempts = 0, correct = 0;
    (Object.values(r.stats) as { attempts: number; correct: number }[])
        .forEach(s => { if (s && typeof s === 'object') { attempts += s.attempts || 0; correct += s.correct || 0; } });
    return { attempts, correct };
}

/** Download the current class roster as a CSV for grading. In-class students
 *  only, one row each: name, email, caught/seen counts, and answer accuracy. */
function exportRosterCsv(): void {
    const rows = rosterRows.filter(r => r.inClass);
    if (rows.length === 0) { flash('No students are in this class yet.', true); return; }
    const cell = (v: string | number): string => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Name', 'Email', 'Caught', 'Seen', 'Questions answered', 'Correct', 'Accuracy %'];
    const lines = [header.join(',')];
    rows.sort((a, b) => a.name.localeCompare(b.name)).forEach(r => {
        const { attempts, correct } = statTotals(r);
        const acc = attempts ? Math.round((correct / attempts) * 100) : 0;
        lines.push([r.name, r.email, r.caught, r.seen, attempts, correct, acc].map(cell).join(','));
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = (myClassName() || 'class').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isotopia-${safeName || 'class'}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** One table row for a student. */
function rosterRowHtml(r: StudentRow): string {
    const { attempts: att, correct: cor } = statTotals(r);
    const acc = att ? Math.round((cor / att) * 100) : 0;
    // "Assigned elsewhere" is only claimable by a super (rules block admins).
    const locked = r.assignedElsewhere && !session?.isSuper;
    const rosterCell = r.inClass
        ? `<button class="btn small roster-toggle" data-uid="${esc(r.uid)}" data-in="1">Remove</button>`
        : r.assignedElsewhere
            ? (locked ? `<span class="muted small">—</span>` : `<button class="btn small roster-toggle" data-uid="${esc(r.uid)}" data-in="0">Claim</button>`)
            : `<button class="btn small roster-toggle" data-uid="${esc(r.uid)}" data-in="0">Add</button>`;
    return `<tr>
        <td>${locked ? '' : `<input type="checkbox" class="roster-check" data-uid="${esc(r.uid)}" data-in="${r.inClass ? '1' : '0'}">`}</td>
        <td>${esc(r.name)}<div class="muted small">${esc(r.email)}</div></td>
        <td>${rosterCell}</td>
        <td>${r.caught}</td>
        <td>${r.seen}</td>
        <td>${att ? `${acc}% <span class="muted small">(${cor}/${att})</span>` : '—'}</td>
    </tr>`;
}

/** A labeled roster table for one group of students (returns '' if empty). */
function rosterSection(title: string, subtitle: string, rows: StudentRow[], extraClass = ''): string {
    if (rows.length === 0) return '';
    return `<section class="roster-group ${extraClass}">
        <h3 class="roster-head">${title} <span class="muted">(${rows.length})</span></h3>
        <p class="muted small roster-sub">${subtitle}</p>
        <table class="sched">
            <thead><tr><th></th><th>Student</th><th>Roster</th><th>Caught</th><th>Seen</th><th>Accuracy</th></tr></thead>
            <tbody>${rows.map(rosterRowHtml).join('')}</tbody>
        </table></section>`;
}

function paintRoster(): void {
    const host = document.getElementById('roster-table');
    if (!host) return;
    const rows = filteredRoster();
    if (rows.length === 0) {
        host.innerHTML = `<p class="muted">No registrants match "${esc(rosterFilter)}".</p>`;
        return;
    }
    // Group by class so it's unmistakable which kids are in which class: my class
    // first, then each OTHER class by name, then the not-yet-assigned pool. The
    // color swatch per group ties each class to its identity.
    const swatchFor = (color: string): string =>
        `<span class="class-swatch" style="background:${esc(color)}"></span>`;
    const mine = rows.filter(r => r.inClass);
    const unassigned = rows.filter(r => !r.inClass && !r.assignedElsewhere);
    const elsewhere = rows.filter(r => r.assignedElsewhere);

    // My class — with onboarding empty state (unless filtering, when empty just
    // means nothing matched).
    const mySwatch = swatchFor(classMeta?.color || DEFAULT_CLASS_COLOR);
    const mineHtml = mine.length === 0
        ? (rosterFilter.trim() ? '' : `<section class="roster-group mine"><h3 class="roster-head">${mySwatch}In ${esc(myClassName())} <span class="muted">(0)</span></h3>
            <p class="muted small roster-sub">No students yet — add registrants from the groups below. These students
            get the rollout on your <b>Schedule</b> tab.</p></section>`)
        : rosterSection(`${mySwatch}In ${esc(myClassName())}`,
            `These students see the Elementals and rollout you set on the <b>Schedule</b> tab.`, mine, 'mine');

    // Each other class, sorted by name. Admins can't claim these (locked); supers
    // get a Claim button per row to reassign.
    const byClass = new Map<string, StudentRow[]>();
    elsewhere.forEach(r => {
        const id = r.assignedClassId || '?';
        const list = byClass.get(id) ?? [];
        list.push(r);
        byClass.set(id, list);
    });
    const otherClassesHtml = Array.from(byClass.entries())
        .map(([id, rs]) => {
            const meta = classNames.get(id);
            const name = meta?.name || `Class ${id.slice(0, 6)}`;
            return { name, html: rosterSection(`${swatchFor(meta?.color || DEFAULT_CLASS_COLOR)}In ${esc(name)}`,
                session?.isSuper ? 'Another teacher’s class — use Claim to move a student into yours.'
                    : 'Another teacher’s class. Ask a super admin to move a student if needed.', rs) };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(x => x.html).join('');

    const unassignedHtml = rosterSection('Not in any class yet',
        'Signed up but not assigned to a class. Add the ones who belong to you.', unassigned);

    host.innerHTML = mineHtml + otherClassesHtml + unassignedHtml;
    host.querySelectorAll<HTMLButtonElement>('.roster-toggle').forEach(btn =>
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid as string;
            const isIn = btn.dataset.in === '1';
            btn.disabled = true;
            btn.textContent = '…';
            try {
                await setMembership(myClassId(), uid, !isIn);
            } catch (e) {
                flash(e instanceof Error ? e.message : 'Could not update the roster.', true);
            }
            void renderStudents();
            void fillClassSummary();    // refresh the header strip + guide ✓s
        }));
}

async function bulkRoster(add: boolean): Promise<void> {
    let uids = Array.from(document.querySelectorAll<HTMLInputElement>('.roster-check:checked'))
        .map(c => c.dataset.uid as string);
    if (add) {
        // Adding: skip anyone already in this class, and (for non-supers) anyone
        // claimed by another class — a single ineligible path rejects the whole
        // atomic write.
        const byUid = new Map(rosterRows.map(r => [r.uid, r] as const));
        uids = uids.filter(uid => {
            const r = byUid.get(uid);
            return r && !r.inClass && !(r.assignedElsewhere && !session?.isSuper);
        });
    }
    if (uids.length === 0) { flash(add ? 'No eligible students ticked.' : 'Tick some students first.', true); return; }
    try {
        await setMembershipBulk(myClassId(), uids, add);
        flash(`${add ? 'Added' : 'Removed'} ${uids.length} student${uids.length > 1 ? 's' : ''}.`);
    } catch (e) {
        flash(e instanceof Error ? e.message : 'Bulk update failed.', true);
    }
    void renderStudents();
    void fillClassSummary();    // refresh the header strip + guide ✓s
}

// ---------------------------------------------------------------- admins
// Super-admin-only role management. Promote a registrant to admin (they can then
// manage classes/rosters) or revoke it. Admins can never reach this tab, and no
// new super admins can be minted here — that's the teacher custom claim, which
// only comes from firebase/set-teacher.mjs (see database.rules.json).
async function renderAdmins(): Promise<void> {
    const panel = document.getElementById('panel') as HTMLElement;
    const intro = `<p class="muted small">Super admins only. Promote a registrant to
        <b>admin</b> to let them manage classes and rosters. Admins can’t promote
        anyone, and no new super admins can be created here.</p>`;
    panel.innerHTML = `<div class="row between"><h2>Admins</h2>
        <button id="adm-refresh" class="btn">Refresh</button></div>${intro}
        <p class="muted">Loading…</p>`;
    document.getElementById('adm-refresh')?.addEventListener('click', () => void renderAdmins());

    adminRows = await loadAdmins().catch(() => []);
    const count = adminRows.filter(r => r.isAdmin).length;
    panel.innerHTML = `<div class="row between">
            <h2>Admins <span class="muted">(${count})</span></h2>
            <button id="adm-refresh" class="btn">Refresh</button></div>${intro}
        <div class="row toolbar">
            <input id="admin-filter" class="filter" type="search" placeholder="Filter by name or email…" value="${esc(adminFilter)}">
        </div>
        <div id="admin-table"></div>`;
    document.getElementById('adm-refresh')?.addEventListener('click', () => void renderAdmins());
    const f = document.getElementById('admin-filter') as HTMLInputElement;
    f.addEventListener('input', () => { adminFilter = f.value; paintAdmins(); });
    paintAdmins();
}

function paintAdmins(): void {
    const host = document.getElementById('admin-table');
    if (!host) return;
    const q = adminFilter.trim().toLowerCase();
    const rows = q
        ? adminRows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
        : adminRows;
    if (rows.length === 0) {
        host.innerHTML = `<p class="muted">No registrants match "${esc(adminFilter)}".</p>`;
        return;
    }
    host.innerHTML = `<table class="sched">
        <thead><tr><th>Person</th><th>Role</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
            <td>${esc(r.name)}<div class="muted small">${esc(r.email)}</div></td>
            <td>${r.isAdmin ? '<span class="pill">admin</span>' : '<span class="muted">registrant</span>'}</td>
            <td><button class="btn small admin-toggle" data-uid="${esc(r.uid)}" data-admin="${r.isAdmin ? '1' : '0'}" data-label="${esc(r.email || r.name)}">${r.isAdmin ? 'Revoke admin' : 'Make admin'}</button></td>
        </tr>`).join('')}</tbody>
    </table>`;
    host.querySelectorAll<HTMLButtonElement>('.admin-toggle').forEach(btn =>
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid as string;
            const isAdm = btn.dataset.admin === '1';
            const label = btn.dataset.label || 'this person';
            if (!confirm(`${isAdm ? 'Revoke admin from' : 'Make admin:'} ${label}?`)) return;
            btn.disabled = true;
            btn.textContent = '…';
            try {
                await setAdmin(uid, !isAdm);
            } catch (e) {
                flash(e instanceof Error ? e.message : 'Could not update the role.', true);
            }
            void renderAdmins();
        }));
}

boot();
