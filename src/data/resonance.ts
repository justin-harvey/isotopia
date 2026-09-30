// The Atlantis sanctum's "Crystalline Resonance" puzzle (see ui/ResonanceOverlay).
//
// Story hook: ancient dissonance corrupted the shrine's inscriptions, so every
// crystal shows a real element SYMBOL beneath a WRONG name (exactly the garbled
// labels in the room art: K reads "Carbon", Na reads "Calcium/Galcium", Al reads
// "Gallium"...). The player re-attunes each pedestal by choosing the element's TRUE
// name; when all are correct the Giza Core reaches full resonance ("Enlightenment").
//
// Educationally this drills symbol -> name recall and the classic symbol confusions
// the game already teaches: Fe is Iron not Fluorine, O is Oxygen not Osmium, K is
// Potassium not Carbon, Na is Sodium not Calcium.

export interface CrystalNode {
    id: string;          // stable key for persistence
    symbol: string;      // the real element symbol etched on the crystal
    wrongLabel: string;  // the corrupted inscription (a plausible but wrong name)
    answer: string;      // the element's TRUE name
    choices: string[];   // multiple-choice options (must include answer + wrongLabel)
    gem: string;         // crystal colour (hex) so each pedestal reads distinct
    fact: string;        // one-line "why" revealed once the node is attuned
}

export const RESONANCE_NODES: CrystalNode[] = [
    { id: 'k',  symbol: 'K',  wrongLabel: 'Carbon',    answer: 'Potassium', gem: '#ffc14d',
      choices: ['Potassium', 'Carbon', 'Krypton', 'Calcium'],
      fact: 'K is Potassium (Latin "kalium"). Carbon is C.' },
    { id: 'na', symbol: 'Na', wrongLabel: 'Calcium',   answer: 'Sodium', gem: '#b06cff',
      choices: ['Sodium', 'Calcium', 'Nitrogen', 'Neon'],
      fact: 'Na is Sodium (Latin "natrium"). Calcium is Ca.' },
    { id: 'al', symbol: 'Al', wrongLabel: 'Gallium',   answer: 'Aluminum', gem: '#57e0c0',
      choices: ['Aluminum', 'Gallium', 'Argon', 'Arsenic'],
      fact: 'Al is Aluminum. Gallium is Ga, one period down in group 13.' },
    { id: 'fe', symbol: 'Fe', wrongLabel: 'Fluorine',  answer: 'Iron', gem: '#9fb4c8',
      choices: ['Iron', 'Fluorine', 'Francium', 'Fermium'],
      fact: 'Fe is Iron (Latin "ferrum"). Fluorine is just F.' },
    { id: 'mg', symbol: 'Mg', wrongLabel: 'Manganese', answer: 'Magnesium', gem: '#ff8a9c',
      choices: ['Magnesium', 'Manganese', 'Mercury', 'Molybdenum'],
      fact: 'Mg is Magnesium. Manganese is Mn, Mercury is Hg.' },
    { id: 'o',  symbol: 'O',  wrongLabel: 'Osmium',    answer: 'Oxygen', gem: '#7fd4ff',
      choices: ['Oxygen', 'Osmium', 'Oganesson', 'Gold'],
      fact: 'O is Oxygen. Osmium is Os, Oganesson is Og.' },
];
