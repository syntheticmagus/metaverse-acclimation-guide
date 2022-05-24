import "@babylonjs/loaders";
import { Game } from "./game";
import { IGameParams } from "./gameParams";

export function runGame(params: IGameParams) {
    Game.CreateAsync(params);
}
