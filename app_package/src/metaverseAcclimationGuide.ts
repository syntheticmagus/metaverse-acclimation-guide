import "@babylonjs/loaders";
import { Game } from "./game";

export interface MetaverseAcclimationGuideParameters {
    canvas: HTMLCanvasElement;
    assetsHostUrl?: string;
}

export function runGame(params: MetaverseAcclimationGuideParameters) {
    Game.CreateAsync(params.canvas);
}
