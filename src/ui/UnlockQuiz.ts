// Extra-credit "avatar unlock" quiz. Walking up to a roaming avatar NPC opens this:
// a single chemistry question (data/avatarQuestions) with the character's portrait. Get
// it right and the character is added to the player's unlocked avatars (data/progress
// unlockAvatar), ready to wear from the 🎨 Avatar panel. Wrong answers can be retried;
// backing out (✕ / Esc) leaves it locked so the NPC can be tried again later.
//
// Reuses the GBA quiz styling (.quiz-card.battle, .quiz-choice, .quiz-feedback, …) from
// the Elemental battle overlay, minus the battle scene — this is a friendlier pop-up.

import GlobalInfo from '../GlobalInfo';
import { getCharacter, type CharacterDef } from '../data/characters';
import { getAvatarQuestion } from '../data/avatarQuestions';
import { unlockAvatar, isAvatarUnlocked } from '../data/progress';

let isOpen = false;

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

// Inline background-crop of the character's picker/thumbnail frame, matching the
// Avatar panel (works for any pixel sheet: townsfolk 16x24, animals 32x32, critters
// 16x16). Returns a <span> styled to show a single frame ~56px tall.
function portrait(def: CharacterDef): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'unlock-portrait';
    if (def.pixel && def.sheet) {
        const k = 56 / def.frameHeight;
        const sheetW = def.sheetWidth || def.frameWidth;
        const cols = Math.max(1, Math.round(sheetW / def.frameWidth));
        const fr = def.thumbFrame || 0;
        const col = fr % cols, row = Math.floor(fr / cols);
        span.style.width = `${def.frameWidth * k}px`;
        span.style.height = `${def.frameHeight * k}px`;
        span.style.backgroundImage = `url(${def.sheet})`;
        span.style.backgroundSize = `${sheetW * k}px ${(def.sheetHeight || def.frameHeight) * k}px`;
        span.style.backgroundPosition = `${-col * def.frameWidth * k}px ${-row * def.frameHeight * k}px`;
        span.style.imageRendering = 'pixelated';
    }
    return span;
}

/** Open the unlock quiz for a character. `onClose` fires whenever the overlay closes
 *  (win or flee) so the NPC can re-arm its proximity trigger. */
export function openUnlockQuiz(characterId: string, onClose?: () => void): void {
    if (isOpen || GlobalInfo._gameProgress.inDialogue) return;
    const def = getCharacter(characterId);
    const question = getAvatarQuestion(characterId);
    if (!question) { onClose?.(); return; }

    isOpen = true;
    setDialogue(true);

    const overlay = document.createElement('div');
    overlay.className = 'quiz-overlay';
    overlay.innerHTML = `
        <div class="quiz-card battle unlock-card">
            <button class="quiz-x" aria-label="Close without answering">✕</button>
            <div class="unlock-head">
                <div class="unlock-portrait-wrap"></div>
                <div class="unlock-intro">
                    <div class="unlock-title">${def.label} wants to join you!</div>
                    <div class="unlock-sub">Answer correctly to add ${def.label} to your 🎨 avatars.</div>
                </div>
            </div>
            <div class="unlock-prompt"></div>
            <div class="quiz-choices"></div>
            <div class="quiz-feedback"></div>
            <div class="quiz-actions">
                <button class="quiz-continue unlock-next" hidden>Continue ▶</button>
            </div>
        </div>`;

    overlay.querySelector('.unlock-portrait-wrap')!.appendChild(portrait(def));
    (overlay.querySelector('.unlock-prompt') as HTMLDivElement).textContent = question.prompt;

    const choicesEl = overlay.querySelector('.quiz-choices') as HTMLDivElement;
    const feedbackEl = overlay.querySelector('.quiz-feedback') as HTMLDivElement;
    const actionBtn = overlay.querySelector('.unlock-next') as HTMLButtonElement;

    let answered = false;

    function renderChoices(): HTMLButtonElement[] {
        choicesEl.innerHTML = '';
        return question!.choices.map((choice, i) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-choice';
            btn.innerHTML = `<span class="quiz-key">${i + 1}</span> ${choice}`;
            btn.addEventListener('click', () => answer(i));
            choicesEl.appendChild(btn);
            return btn;
        });
    }
    let buttons = renderChoices();

    function answer(index: number): void {
        if (answered) return;
        answered = true;
        const isRight = index === question!.correctIndex;
        buttons.forEach((b, i) => {
            b.disabled = true;
            if (i === question!.correctIndex) {
                b.classList.add('correct');
                b.insertAdjacentHTML('beforeend', ' <span class="quiz-mark">✓</span>');
            } else if (i === index) {
                b.classList.add('wrong');
                b.insertAdjacentHTML('beforeend', ' <span class="quiz-mark">✗</span>');
            }
        });

        feedbackEl.className = 'quiz-feedback';
        if (isRight) {
            unlockAvatar(characterId);
            feedbackEl.textContent = `Nice! ${def.label} joined you. Tap 🎨 to wear them.`;
            feedbackEl.classList.add('ok');
            actionBtn.textContent = 'Continue ▶';
            actionBtn.hidden = false;
            actionBtn.onclick = close;
        } else {
            const answerText = question!.choices[question!.correctIndex];
            feedbackEl.textContent = `Not quite — the answer is "${answerText}". Try again!`;
            feedbackEl.classList.add('no');
            actionBtn.textContent = 'Try again ▶';
            actionBtn.hidden = false;
            actionBtn.onclick = () => {
                answered = false;
                feedbackEl.textContent = '';
                feedbackEl.className = 'quiz-feedback';
                actionBtn.hidden = true;
                buttons = renderChoices();
            };
        }
        actionBtn.focus();
    }

    function close(): void {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        isOpen = false;
        setDialogue(false);
        onClose?.();
    }

    function onKey(e: KeyboardEvent): void {
        if (!answered && e.key >= '1' && e.key <= String(question!.choices.length)) {
            answer(parseInt(e.key, 10) - 1);
            e.preventDefault();
        } else if (answered && !actionBtn.hidden && (e.key === 'Enter' || e.key === ' ')) {
            actionBtn.click();
            e.preventDefault();
        } else if (e.key === 'Escape') {
            close();
            e.preventDefault();
        }
    }

    (overlay.querySelector('.quiz-x') as HTMLButtonElement).addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
}

/** True if the player has already earned this character (so an NPC can greet instead
 *  of re-quizzing). */
export function alreadyUnlocked(characterId: string): boolean {
    return isAvatarUnlocked(characterId);
}
