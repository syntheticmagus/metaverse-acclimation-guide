import { Engine } from "@babylonjs/core/Engines/engine";
import { EffectRenderer } from "@babylonjs/core/Materials/effectRenderer";
import { Level1Scene } from "./level1Scene";
import { SceneRenderer } from "./sceneRenderer";
import { TitleScene } from "./titleScene";

export class Game {
    private readonly _engine: Engine;
    private readonly _effectRenderer: EffectRenderer;
    private readonly _sceneRenderer: SceneRenderer;

    private constructor(canvas: HTMLCanvasElement) {
        this._engine = new Engine(canvas);
        this._effectRenderer = new EffectRenderer(this._engine);
        this._sceneRenderer = new SceneRenderer(this._engine, this._effectRenderer);
    }

    public static async CreateAsync(canvas: HTMLCanvasElement): Promise<Game> {
        const game = new Game(canvas);
        await game._loadTitleSceneAsync();
        return game;
    }

    private async _loadTitleSceneAsync(): Promise<void> {
        const titleScene = await this._sceneRenderer.loadSceneAsync(TitleScene.CreateAsync);
        titleScene.requestLevel1SceneObservable.add(() => { this._loadLevel1SceneAsync(); });
    }

    private async _loadLevel1SceneAsync(): Promise<void> {
        const level1Scene = await this._sceneRenderer.loadSceneAsync(Level1Scene.CreateAsync);
        level1Scene.requestTitleSceneObservable.add(() => { this._loadTitleSceneAsync(); });
        level1Scene.requestLevel1SceneObservable.add(() => { this._loadLevel1SceneAsync(); });
    }
}
