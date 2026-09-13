import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// The Gray Hardware Store (red storefront in town) — placeholder interior art
// for now. Home to Iron (Ironclank — nails, tools, steel) and Aluminum
// (Aluminio — foil, ladders, gutters). Carbon (Carbocrunch) now roams the North
// Woods instead.
export default class HardwareScene extends InteriorScene {
    constructor() {
        super(SceneName.Hardware, 'treats-interior.png', ['iron'], 'room_treats');
    }
}
