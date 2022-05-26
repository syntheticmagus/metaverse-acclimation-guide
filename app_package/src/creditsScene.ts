import { Observable, Engine, AmmoJSPlugin, Sound, SceneLoader, CubeTexture, TransformNode, Quaternion, TargetCamera, Vector3, SSAO2RenderingPipeline, Color3, Color4 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, StackPanel } from "@babylonjs/gui";
import { PhysicsPostLoader } from "@syntheticmagus/physics-post-loader/lib";
import { IGameParams, SoundEffectTrack, Model, HdrEnvironment } from "./gameParams";
import { RenderTargetScene } from "./renderTargetScene";

export class CreditsScene extends RenderTargetScene {
    public requestTitleSceneObservable: Observable<void>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestTitleSceneObservable = new Observable<void>();
    }

    public static async CreateAsync(engine: Engine, params: IGameParams): Promise<CreditsScene> {
        document.exitPointerLock();

        const scene = new CreditsScene(engine);
        new TargetCamera("camera", new Vector3(), scene);
        scene.clearColor = new Color4(0, 0, 0, 1);

        const music = new Sound("music", params.assetToUrl.get(SoundEffectTrack.Music), scene);
        music.autoplay = true;
        music.loop = true;

        const clickSound = new Sound("click", params.assetToUrl.get(SoundEffectTrack.Click), scene);
        clickSound.setVolume(0.1);

        const creditsGui = AdvancedDynamicTexture.CreateFullscreenUI("creditsGui");
        await creditsGui.parseFromURLAsync("http://localhost:8181/credits_gui.json");
        
        const stackPanel = creditsGui.getControlByName("creditsStackPanel")! as StackPanel;
        scene.onBeforeRenderObservable.runCoroutineAsync(function *() {
            for (stackPanel.topInPixels = 0; stackPanel.topInPixels > -5000; stackPanel.topInPixels -= scene.deltaTime / 12) {
                yield;
            }

            scene.requestTitleSceneObservable.notifyObservers();
        }());

        const skipButton = creditsGui.getControlByName("skipButton")! as Button;
        skipButton.onPointerClickObservable.add(() => {
            clickSound.play();
            scene.requestTitleSceneObservable.notifyObservers();
        });

        return scene;
    }
}
