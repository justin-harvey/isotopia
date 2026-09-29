// The Evolution Lab's compound recipes: which caught Elementals fuse into which
// molecule, plus the real VSEPR geometry the Fusion chamber quizzes on.
//
// PLACEHOLDER ART: `name`/`tint` are stand-ins until Justin supplies evolved
// artwork. When art arrives, add it (e.g. assets/compounds/<id>.png) and swap the
// disc for it in EvolveOverlay; the chemistry (steric number, hybrid, bond angle,
// shape) is the real teaching content and shouldn't change.

import { getElement } from './elements';

export interface CompoundRecipe {
    id: string;            // stable id (also the evolved-progress key)
    name: string;          // placeholder monster name (art/name TBD)
    formula: string;       // e.g. "H₂O"
    // Reactant Elementals by element id -> how many atoms (display + gating).
    ingredients: { id: string; count: number }[];
    stericNumber: number;  // VSEPR steric number (bonding regions + lone pairs)
    hybrid: string;        // "sp" | "sp²" | "sp³"
    bondAngle: number;     // ideal bond angle in degrees
    shape: string;         // VSEPR shape name
    fact: string;          // one-line teaching payoff shown on a successful fuse
    tint: number;          // placeholder colour for the no-art disc
}

// A tolerance (± degrees) the dial must land within to fuse. Loose enough to be
// fair on a touch slider, tight enough to force the right VSEPR angle.
export const ANGLE_TOLERANCE = 2.5;

export const COMPOUNDS: CompoundRecipe[] = [
    { id: 'water', name: 'Aquadrip', formula: 'H₂O',
      ingredients: [{ id: 'hydrogen', count: 2 }, { id: 'oxygen', count: 1 }],
      stericNumber: 4, hybrid: 'sp³', bondAngle: 104.5, shape: 'Bent',
      fact: 'Two lone pairs on O squeeze water down to a bent 104.5°.', tint: 0x4fc3f7 },
    { id: 'carbon-dioxide', name: 'Fizzfume', formula: 'CO₂',
      ingredients: [{ id: 'carbon', count: 1 }, { id: 'oxygen', count: 2 }],
      stericNumber: 2, hybrid: 'sp', bondAngle: 180, shape: 'Linear',
      fact: 'No lone pairs on C — O=C=O stretches out to a linear 180°.', tint: 0x90a4ae },
    { id: 'methane', name: 'Marshmuck', formula: 'CH₄',
      ingredients: [{ id: 'carbon', count: 1 }, { id: 'hydrogen', count: 4 }],
      stericNumber: 4, hybrid: 'sp³', bondAngle: 109.5, shape: 'Tetrahedral',
      fact: 'Four equal bonds, zero lone pairs — a perfect tetrahedral 109.5°.', tint: 0xa1887f },
    { id: 'ammonia', name: 'Whiffnix', formula: 'NH₃',
      ingredients: [{ id: 'nitrogen', count: 1 }, { id: 'hydrogen', count: 3 }],
      stericNumber: 4, hybrid: 'sp³', bondAngle: 107, shape: 'Trigonal pyramidal',
      fact: 'One lone pair on N nudges H–N–H from 109.5° down to about 107°.', tint: 0x9ccc65 },
    { id: 'boron-trifluoride', name: 'Triflora', formula: 'BF₃',
      ingredients: [{ id: 'boron', count: 1 }, { id: 'fluorine', count: 3 }],
      stericNumber: 3, hybrid: 'sp²', bondAngle: 120, shape: 'Trigonal planar',
      fact: 'Electron-deficient B, no lone pairs — flat trigonal planar 120°.', tint: 0x64b5f6 },
    { id: 'sulfur-dioxide', name: 'Chokemist', formula: 'SO₂',
      ingredients: [{ id: 'sulfur', count: 1 }, { id: 'oxygen', count: 2 }],
      stericNumber: 3, hybrid: 'sp²', bondAngle: 119, shape: 'Bent',
      fact: 'One lone pair on S bends SO₂ to roughly 119°.', tint: 0xffca28 },
    { id: 'dioxygen', name: 'Duoxy', formula: 'O₂',
      ingredients: [{ id: 'oxygen', count: 2 }],
      stericNumber: 2, hybrid: 'sp', bondAngle: 180, shape: 'Linear (diatomic)',
      fact: 'Any diatomic molecule is linear by definition — 180°.', tint: 0xef5350 },
    { id: 'dinitrogen', name: 'Dinite', formula: 'N₂',
      ingredients: [{ id: 'nitrogen', count: 2 }],
      stericNumber: 2, hybrid: 'sp', bondAngle: 180, shape: 'Linear (diatomic)',
      fact: 'A nitrogen triple bond holds N₂ in a straight 180° line.', tint: 0x64b5f6 },
];

export function getCompound(id: string): CompoundRecipe | undefined {
    return COMPOUNDS.find(c => c.id === id);
}

// Element ids in a recipe the student hasn't caught yet (soft gating + labels).
export function missingIngredients(recipe: CompoundRecipe, caught: (id: string) => boolean): string[] {
    return recipe.ingredients.filter(r => !caught(r.id)).map(r => r.id);
}

// The reactant Elemental's silly display name, for chips/labels.
export function elementalName(id: string): string {
    return getElement(id)?.monster ?? id;
}
