import "@babylonjs/loaders";

import { EffectRenderer, Engine, MeshBuilder, Tools } from "@babylonjs/core";
import { RenderTargetScene } from "./renderTargetScene";
import { SceneRenderer } from "./sceneRenderer";

class Level1Scene extends RenderTargetScene {
    private constructor(engine: Engine) {
        super(engine);

        MeshBuilder.CreateBox("box", { size: 1 }, this);
        this.createDefaultCameraOrLight(true, true, true);
    }

    public static async CreateAsync(engine: Engine): Promise<Level1Scene> {
        return new Level1Scene(engine);
    }
}

class TitleScene extends RenderTargetScene {
    private constructor(engine: Engine) {
        super(engine);

        MeshBuilder.CreateSphere("sphere", { diameter: 1 }, this);
        this.createDefaultCameraOrLight(true, true, true);
    }

    public static async CreateAsync(engine: Engine): Promise<TitleScene> {
        return new TitleScene(engine);
    }
}

class Game {
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

        while (true) {
            await game._sceneRenderer.loadSceneAsync(TitleScene.CreateAsync);
            await Tools.DelayAsync(1000);
            await game._sceneRenderer.loadSceneAsync(Level1Scene.CreateAsync);
            await Tools.DelayAsync(1000);
        }

        return game;
    }
}

export interface InitializeBabylonAppOptions {
    canvas: HTMLCanvasElement;
    assetsHostUrl?: string;
}

export function initializeBabylonApp(options: InitializeBabylonAppOptions) {
    Game.CreateAsync(options.canvas);
}
