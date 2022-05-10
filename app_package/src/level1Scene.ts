import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Tools } from "@babylonjs/core/Misc/tools";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/Plugins/ammoJSPlugin";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { FirstPersonPlayer } from "@syntheticmagus/first-person-player/lib/firstPersonPlayer";
import { PhysicsPostLoader } from "@syntheticmagus/physics-post-loader/lib/physicsPostLoader";
import { RenderTargetScene } from "./renderTargetScene";

export class Level1Scene extends RenderTargetScene {
    public requestTitleSceneObservable: Observable<void>;
    public requestLevel1SceneObservable: Observable<void>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestTitleSceneObservable = new Observable<void>();
        this.requestLevel1SceneObservable = new Observable<void>();
    }

    public static async CreateAsync(engine: Engine): Promise<Level1Scene> {
        const scene = new Level1Scene(engine);
        const physicsPlugin = new AmmoJSPlugin();
        scene.enablePhysics(undefined, physicsPlugin);

        const loadResult = await SceneLoader.ImportMeshAsync("", "http://127.0.0.1:8181/", "level1.glb", scene);
        PhysicsPostLoader.AddPhysicsToHierarchy(loadResult.meshes[0], scene);

        scene.createDefaultEnvironment({ createSkybox: false, createGround: false });

        const playerSpawn = scene.getTransformNodeByName("player_spawn");
        if (playerSpawn) {
            const player = new FirstPersonPlayer(scene, playerSpawn.absolutePosition);
            player.camera.maxZ = 1000;

            const playerFocus = scene.getTransformNodeByName("player_focus");
            if (playerFocus) {
                player.camera.setTarget(playerFocus.position);
            }

            scene.onPointerDown = () => {
                engine.getRenderingCanvas()!.requestPointerLock();
            };
        } else {
            scene.createDefaultCamera(true, true, true);
        }

        const guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("guiTexture");

        const titleButton = Button.CreateSimpleButton("loadTitleButton", "Load Title Screen");
        titleButton.onPointerClickObservable.add(() => {
            scene.requestTitleSceneObservable.notifyObservers();
        });
        titleButton.widthInPixels = 200;
        titleButton.heightInPixels = 60;
        titleButton.verticalAlignment = Button.VERTICAL_ALIGNMENT_TOP;
        titleButton.horizontalAlignment = Button.HORIZONTAL_ALIGNMENT_LEFT;
        titleButton.background = "gray";

        const level1Button = Button.CreateSimpleButton("loadLevel1Button", "Reload Level 1");
        level1Button.onPointerClickObservable.add(() => {
            scene.requestLevel1SceneObservable.notifyObservers();
        });
        level1Button.widthInPixels = 200;
        level1Button.heightInPixels = 60;
        level1Button.verticalAlignment = Button.VERTICAL_ALIGNMENT_BOTTOM;
        level1Button.horizontalAlignment = Button.HORIZONTAL_ALIGNMENT_LEFT;
        level1Button.background = "gray";

        guiTexture.addControl(titleButton);
        guiTexture.addControl(level1Button);

        return scene;
    }
}