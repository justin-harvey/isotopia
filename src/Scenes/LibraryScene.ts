import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// The Gray Public Library (blue storefront in town) — a quiet study. Re-scrambled
// for the official season (2026-10-13): Iron (Ironclank) now lives here; Uranium
// moved to the Auto shop.
export default class LibraryScene extends InteriorScene {
    constructor() {
        super(SceneName.Library, 'library-interior.png', ['iron'], 'room_library');
    }
}
