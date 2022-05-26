import { Sound } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { EffectRenderer } from "@babylonjs/core/Materials/effectRenderer";
import { CreditsScene } from "./creditsScene";
import { IGameParams, SoundEffectTrack } from "./gameParams";
import { Level1Scene } from "./level1Scene";
import { SceneRenderer } from "./sceneRenderer";
import { TitleScene } from "./titleScene";

export class Game {
    private readonly _engine: Engine;
    private readonly _effectRenderer: EffectRenderer;
    private readonly _sceneRenderer: SceneRenderer;

    private constructor(params: IGameParams) {
        this._engine = new Engine(params.canvas);
        this._effectRenderer = new EffectRenderer(this._engine);
        this._sceneRenderer = new SceneRenderer(this._engine, this._effectRenderer, params);
    }

    public static async CreateAsync(params: IGameParams): Promise<Game> {
        const game = new Game(params);
        await game._loadTitleSceneAsync(0);
        return game;
    }

    private async _loadTitleSceneAsync(delay: number = 1000): Promise<void> {
        const titleScene = await this._sceneRenderer.loadSceneAsync(TitleScene.CreateAsync, delay);
        titleScene.requestLevel1SceneObservable.add(() => { this._loadLevel1SceneAsync(); });
    }

    private async _loadLevel1SceneAsync(): Promise<void> {
        const level1Scene = await this._sceneRenderer.loadSceneAsync(Level1Scene.CreateAsync);
        level1Scene.requestTitleSceneObservable.add(() => { this._loadTitleSceneAsync(); });
        level1Scene.requestLevel1SceneObservable.add(() => { this._loadLevel1SceneAsync(); });
        level1Scene.requestCreditsSceneObservable.add(() => { this._loadCreditsSceneAsync(); });
    }

    private async _loadCreditsSceneAsync(): Promise<void> {
        const creditsScene = await this._sceneRenderer.loadSceneAsync(CreditsScene.CreateAsync);
        creditsScene.requestTitleSceneObservable.add(() => { this._loadTitleSceneAsync(); });
    }
}
