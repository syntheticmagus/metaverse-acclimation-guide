import "@babylonjs/loaders";

import { EffectRenderer, Engine, MeshBuilder, Tools } from "@babylonjs/core";
import { RenderTargetScene } from "./renderTargetScene";
import { SceneRenderer } from "./sceneRenderer";
import { Observable } from "@babylonjs/core/Misc/observable";

class Level1Scene extends RenderTargetScene {
    public requestTitleSceneObservable: Observable<void>;
    public requestLevel1SceneObservable: Observable<void>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestTitleSceneObservable = new Observable<void>();
        this.requestLevel1SceneObservable = new Observable<void>();

        MeshBuilder.CreateBox("box", { size: 1 }, this);
        this.createDefaultCameraOrLight(true, true, true);
    }

    public static async CreateAsync(engine: Engine): Promise<Level1Scene> {
        const scene = new Level1Scene(engine);

        Tools.DelayAsync(2000).then(() => {
            scene.requestTitleSceneObservable.notifyObservers();
        });

        return scene;
    }
}

class TitleScene extends RenderTargetScene {
    public requestLevel1SceneObservable: Observable<void>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestLevel1SceneObservable = new Observable<void>();

        MeshBuilder.CreateSphere("sphere", { diameter: 1 }, this);
        this.createDefaultCameraOrLight(true, true, true);
    }

    public static async CreateAsync(engine: Engine): Promise<TitleScene> {
        const scene = new TitleScene(engine);

        Tools.DelayAsync(2000).then(() => {
            scene.requestLevel1SceneObservable.notifyObservers();
        });

        return scene;
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
        await game._loadTitleSceneAsync();
        return game;
    }

    private async _loadTitleSceneAsync(): Promise<void> {
        const titleScene = await this._sceneRenderer.loadSceneAsync(TitleScene.CreateAsync);
        titleScene.requestLevel1SceneObservable.add(() => { this._loadLevel1SceneAsync() });
    }

    private async _loadLevel1SceneAsync(): Promise<void> {
        const level1Scene = await this._sceneRenderer.loadSceneAsync(Level1Scene.CreateAsync);
        level1Scene.requestTitleSceneObservable.add(() => { this._loadTitleSceneAsync() });
        level1Scene.requestLevel1SceneObservable.add(() => { this._loadLevel1SceneAsync() });
    }
}

export interface InitializeBabylonAppOptions {
    canvas: HTMLCanvasElement;
    assetsHostUrl?: string;
}

export function initializeBabylonApp(options: InitializeBabylonAppOptions) {
    Game.CreateAsync(options.canvas);
}
