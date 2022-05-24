import { Engine } from "@babylonjs/core/Engines/engine";
import { EffectRenderer } from "@babylonjs/core/Materials/effectRenderer";
import { ThinTexture } from "@babylonjs/core/Materials/Textures/thinTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Tools } from "@babylonjs/core/Misc/tools";
import { BlurEffect } from "./blurEffect";
import { FadeToColorEffect } from "./fadeToColorEffect";
import { IGameParams } from "./gameParams";
import { RenderTargetScene } from "./renderTargetScene";

export class SceneRenderer {
    private readonly _engine: Engine;
    private readonly _blurEffect: BlurEffect;
    private readonly _fadeEffect: FadeToColorEffect;
    private readonly _params: IGameParams;

    private _activeScene?: RenderTargetScene;
    private _fadeStrength: number;
    private _blurStrength: number;

    public constructor(engine: Engine, effectRenderer: EffectRenderer, params: IGameParams) {
        this._engine = engine;
        const effectArgs = { engine: this._engine, effectRenderer: effectRenderer };
        this._blurEffect = new BlurEffect(effectArgs)
        this._fadeEffect = new FadeToColorEffect(effectArgs);
        this._params = params;
        this._fadeStrength = 1;
        this._blurStrength = 1;
    
        let blurred: ThinTexture | undefined;
        this._engine.runRenderLoop(() => {
            if (this._activeScene) {
                this._activeScene.render();

                if (this._activeScene.renderTarget) {
                    if (!blurred || this._blurStrength > 0.01) {
                        blurred = this._blurEffect.render(this._activeScene.renderTarget);
                    }
                    this._fadeEffect.render(this._activeScene.renderTarget, blurred, Color3.BlackReadOnly, this._fadeStrength, this._blurStrength);
                }
            }
        });
    
        const resizeEventListener = () => {
            this._engine.resize();
        };
        window.addEventListener("resize", resizeEventListener);
        this._engine.onDisposeObservable.add(() => {
            window.removeEventListener("resize", resizeEventListener);
        });
    }

    public async loadSceneAsync<SceneT extends RenderTargetScene>(sceneLoader: (engine: Engine, params: IGameParams) => Promise<SceneT>, paddingMillis: number = 1000): Promise<SceneT> {
        await this._engine.onEndFrameObservable.runCoroutineAsync(this._blurCoroutine(1));
        await this._engine.onEndFrameObservable.runCoroutineAsync(this._fadeCoroutine(1));
        this._activeScene?.dispose();
        this._activeScene = undefined;
        await Tools.DelayAsync(paddingMillis);
        const scene = await sceneLoader(this._engine, this._params);
        this._activeScene = scene;
        await this._engine.onEndFrameObservable.runCoroutineAsync(this._fadeCoroutine(0));
        await this._engine.onEndFrameObservable.runCoroutineAsync(this._blurCoroutine(0));
        return scene;
    }

    private *_blurCoroutine(target: number, speed: number = 0.04) {
        while (Math.abs(target - this._blurStrength) > speed) {
            this._blurStrength += Math.sign(target - this._blurStrength) * speed;
            yield;
        }
        this._blurStrength = target;
        yield;
    }

    private *_fadeCoroutine(target: number, speed: number = 0.02) {
        while (Math.abs(target - this._fadeStrength) > speed) {
            this._fadeStrength += Math.sign(target - this._fadeStrength) * speed;
            yield;
        }
        this._fadeStrength = target;
        yield;
    }
}
