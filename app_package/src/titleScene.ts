import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observable } from "@babylonjs/core/Misc/observable";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/Plugins/ammoJSPlugin";
import { AdvancedDynamicTexture, Button } from "@babylonjs/gui";
import { PhysicsPostLoader } from "@syntheticmagus/physics-post-loader/lib/physicsPostLoader";
import { RenderTargetScene } from "./renderTargetScene";

export class TitleScene extends RenderTargetScene {
    public requestLevel1SceneObservable: Observable<void>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestLevel1SceneObservable = new Observable<void>();
    }

    public static async CreateAsync(engine: Engine): Promise<TitleScene> {
        const scene = new TitleScene(engine);
        const physicsPlugin = new AmmoJSPlugin();
        scene.enablePhysics(undefined, physicsPlugin);

        const loadResult = await SceneLoader.ImportMeshAsync("", "http://127.0.0.1:8181/", "level1.glb", scene);
        PhysicsPostLoader.AddPhysicsToHierarchy(loadResult.meshes[0], scene);

        scene.createDefaultEnvironment({ createSkybox: false, createGround: false });

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

        const camera = new TargetCamera("camera", Vector3.ZeroReadOnly, scene);
        camera.parent = cameraParent;
        camera.minZ = 0.1;
        camera.maxZ = 1000;

        const titleGui = AdvancedDynamicTexture.CreateFullscreenUI("titleGui");
        await titleGui.parseFromURLAsync("http://localhost:8181/title_gui.json");
        
        const mainButtonsStackPanel = titleGui.getControlByName("mainButtonsStackPanel")!;
        const settingsButtonsStackPanel = titleGui.getControlByName("settingsButtonsStackPanel")!;

        const playButton = titleGui.getControlByName("playButton") as Button;
        playButton.onPointerClickObservable.add(() => {
            engine.getRenderingCanvas()!.requestPointerLock();
            scene.requestLevel1SceneObservable.notifyObservers();
        });

        const settingsButton = titleGui.getControlByName("settingsButton") as Button;
        settingsButton.onPointerClickObservable.add(() => {
            mainButtonsStackPanel.isVisible = false;
            settingsButtonsStackPanel.isVisible = true;
        });

        const settingsBackButton = titleGui.getControlByName("settingsBackButton") as Button;
        settingsBackButton.onPointerClickObservable.add(() => {
            mainButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isVisible = false;
        });

        return scene;
    }
}
