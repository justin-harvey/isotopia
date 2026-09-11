import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// The Gray Public Library (blue storefront in town) — a quiet study. Home to
// Uranium (Glowbun — the science-reference heavyweight) and Boron (Borolith —
// reactor control rods, borosilicate lab glass).
export default class LibraryScene extends InteriorScene {
    constructor() {
        super(SceneName.Library, 'library-interior.png', ['uranium', 'boron']);
    }
}
