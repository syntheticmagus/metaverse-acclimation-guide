import { Sound, SSAO2RenderingPipeline, Tools } from "@babylonjs/core";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observable } from "@babylonjs/core/Misc/observable";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/Plugins/ammoJSPlugin";
import { AdvancedDynamicTexture, Button } from "@babylonjs/gui";
import { PhysicsPostLoader } from "@syntheticmagus/physics-post-loader/lib/physicsPostLoader";
import { GuiFile, HdrEnvironment, IGameParams, Model, SoundEffectTrack } from "./gameParams";
import { RenderTargetScene } from "./renderTargetScene";

export class TitleScene extends RenderTargetScene {
    public requestLevel1SceneObservable: Observable<void>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestLevel1SceneObservable = new Observable<void>();
    }

    public static async CreateAsync(engine: Engine, params: IGameParams): Promise<TitleScene> {
        document.exitPointerLock();

        const scene = new TitleScene(engine);
        const physicsPlugin = new AmmoJSPlugin();
        scene.enablePhysics(undefined, physicsPlugin);

        const clickSound = new Sound("click", params.assetToUrl.get(SoundEffectTrack.Click), scene);
        clickSound.setVolume(0.1);

        const loadResult = await SceneLoader.ImportMeshAsync("", params.assetToUrl.get(Model.MainLevel)!, undefined, scene);
        PhysicsPostLoader.AddPhysicsToHierarchy(loadResult.meshes[0], scene);

        const environmentTexture = CubeTexture.CreateFromPrefilteredData(params.assetToUrl.get(HdrEnvironment.MainLevel)!, scene);
        scene.environmentTexture = environmentTexture;
        scene.createDefaultSkybox(environmentTexture, true, 500, 0.3, false);

        const cameraParent = new TransformNode("cameraParent", scene);
        cameraParent.rotationQuaternion = new Quaternion();
        const animatedCameraParent = scene.getTransformNodeByName("title_camera")!;
        scene.onBeforeRenderObservable.runCoroutineAsync(function* () {
            while (true) {
                cameraParent.position.copyFrom(animatedCameraParent.absolutePosition);
                cameraParent.rotationQuaternion!.copyFrom(animatedCameraParent.absoluteRotationQuaternion);
                cameraParent.addRotation(-Math.PI / 2, 0, 0);
                yield;
            }
        }());

        const camera = new TargetCamera("camera", new Vector3(), scene);
        camera.parent = cameraParent;
        camera.minZ = 0.1;
        camera.maxZ = 1000;
        
        const ssao = new SSAO2RenderingPipeline("ssao", scene, {
            ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
            blurRatio: 0.5  // Ratio of the combine post-process (combines the SSAO and the scene)
        });
        ssao.radius = 1;
        ssao.totalStrength = 0.5;
        ssao.expensiveBlur = true;
        ssao.samples = 16;
        ssao.maxZ = 250;
        ssao.textureSamples = 4;
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", scene.activeCamera!);

        const titleGui = AdvancedDynamicTexture.CreateFullscreenUI("titleGui");
        await titleGui.parseFromURLAsync(params.assetToUrl.get(GuiFile.Title)!);
        
        const mainButtonsStackPanel = titleGui.getControlByName("mainButtonsStackPanel")!;
        const settingsButtonsStackPanel = titleGui.getControlByName("settingsButtonsStackPanel")!;

        const playButton = titleGui.getControlByName("playButton") as Button;
        playButton.onPointerClickObservable.add(() => {
            clickSound.play();

            engine.getRenderingCanvas()!.requestPointerLock();
            scene.requestLevel1SceneObservable.notifyObservers();
        });

        const settingsButton = titleGui.getControlByName("settingsButton") as Button;
        settingsButton.onPointerClickObservable.add(() => {
            clickSound.play();

            mainButtonsStackPanel.isVisible = false;
            settingsButtonsStackPanel.isVisible = true;
        });

        const settingsBackButton = titleGui.getControlByName("settingsBackButton") as Button;
        settingsBackButton.onPointerClickObservable.add(() => {
            clickSound.play();
            mainButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isVisible = false;
        });

        return scene;
    }
}
