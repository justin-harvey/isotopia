// Extra-credit quiz questions for the roaming "avatar NPCs". Walk up to one of these
// characters out in the world and answer its question correctly to earn the right to
// wear it from the 🎨 Avatar panel (see ui/UnlockQuiz + data/progress unlockAvatar).
// One question per unlockable character, keyed by the character id in data/characters.
// Kept separate from the Elemental battle questions (data/questions) so these can be
// lighter, standalone chemistry trivia rather than per-element mastery items.

export interface AvatarQuestion {
    prompt: string;
    choices: string[];      // exactly 4
    correctIndex: number;   // 0..3
}

export const AVATAR_QUESTIONS: Record<string, AvatarQuestion> = {
    // --- Townsfolk (split between the Town and the City) ---
    tf1:  { prompt: 'What is the chemical symbol for oxygen?', choices: ['O', 'Ox', 'Og', 'Om'], correctIndex: 0 },
    tf2:  { prompt: 'What is the chemical symbol for sodium?', choices: ['S', 'So', 'Na', 'Sd'], correctIndex: 2 },
    tf3:  { prompt: 'How many atoms are in one molecule of water (H₂O)?', choices: ['2', '3', '4', '1'], correctIndex: 1 },
    tf4:  { prompt: 'Which of these is a noble gas?', choices: ['Oxygen', 'Neon', 'Iron', 'Carbon'], correctIndex: 1 },
    tf5:  { prompt: 'What is the atomic number of carbon?', choices: ['4', '6', '8', '12'], correctIndex: 1 },
    tf6:  { prompt: 'What is the chemical symbol for gold?', choices: ['Gd', 'Go', 'Au', 'Ag'], correctIndex: 2 },
    tf7:  { prompt: 'What is the chemical symbol for iron?', choices: ['Ir', 'Fe', 'In', 'Io'], correctIndex: 1 },
    tf8:  { prompt: 'What charge does a proton carry?', choices: ['Negative', 'Neutral', 'Positive', 'It has none'], correctIndex: 2 },
    tf9:  { prompt: 'Which gas do plants take in to make their food?', choices: ['Oxygen', 'Carbon dioxide', 'Helium', 'Nitrogen'], correctIndex: 1 },
    tf10: { prompt: 'What is the chemical symbol for potassium?', choices: ['P', 'Po', 'K', 'Pt'], correctIndex: 2 },
    tf11: { prompt: 'What is the atomic number of hydrogen?', choices: ['0', '1', '2', '3'], correctIndex: 1 },
    tf12: { prompt: 'Which metal is a liquid at room temperature?', choices: ['Iron', 'Mercury', 'Copper', 'Zinc'], correctIndex: 1 },
    tf13: { prompt: 'What is the chemical symbol for silver?', choices: ['Si', 'Ag', 'Au', 'Sv'], correctIndex: 1 },
    tf14: { prompt: 'How many valence (outer) electrons does carbon have?', choices: ['2', '4', '6', '8'], correctIndex: 1 },
    tf15: { prompt: 'Which is the lightest element on the periodic table?', choices: ['Helium', 'Hydrogen', 'Lithium', 'Oxygen'], correctIndex: 1 },

    // --- Animals (all out in the Woods) ---
    cat_gray:   { prompt: 'What is the chemical symbol for helium?', choices: ['H', 'He', 'Ho', 'Hl'], correctIndex: 1 },
    cat_orange: { prompt: 'Which element has the symbol Cu?', choices: ['Copper', 'Calcium', 'Carbon', 'Cobalt'], correctIndex: 0 },
    fox:        { prompt: 'What is the dense center of an atom called?', choices: ['Electron', 'Nucleus', 'Shell', 'Ion'], correctIndex: 1 },
    raccoon:    { prompt: 'What is the chemical symbol for nitrogen?', choices: ['Ni', 'N', 'Nt', 'Na'], correctIndex: 1 },
    bird_white: { prompt: "Which gas makes up most of Earth's atmosphere?", choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctIndex: 1 },
    bird_blue:  { prompt: 'What is the chemical symbol for chlorine?', choices: ['C', 'Ch', 'Cl', 'Cr'], correctIndex: 2 },
    hamster:    { prompt: 'How many protons does a helium atom have?', choices: ['1', '2', '3', '4'], correctIndex: 1 },

    // --- City birds ---
    pigeon: { prompt: 'Which gas do humans need to breathe to stay alive?', choices: ['Nitrogen', 'Oxygen', 'Argon', 'Neon'], correctIndex: 1 },
    gull:   { prompt: 'Table salt is sodium combined with which other element?', choices: ['Chlorine', 'Carbon', 'Calcium', 'Oxygen'], correctIndex: 0 },
};

export function getAvatarQuestion(characterId: string): AvatarQuestion | undefined {
    return AVATAR_QUESTIONS[characterId];
}
