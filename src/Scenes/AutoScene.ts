import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// The Gray auto-repair garage (brown storefront in town) — placeholder interior
// art for now. Home to Magnesium (Magflash — alloy wheels/flares) and Scandium
// (Scandion — Al-Sc aerospace/frame alloys). Nitrogen (Nitronoodle) now lives
// wild in the North Woods.
export default class AutoScene extends InteriorScene {
    constructor() {
        super(SceneName.Auto, 'treats-interior.png', ['magnesium'], 'room_treats');
    }
}
