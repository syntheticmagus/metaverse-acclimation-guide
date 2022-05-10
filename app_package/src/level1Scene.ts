import { Color3, CubeTexture, MeshBuilder, PBRMaterial } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Observable } from "@babylonjs/core/Misc/observable";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/Plugins/ammoJSPlugin";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import { ScreenSpaceReflectionPostProcess } from "@babylonjs/core/PostProcesses/screenSpaceReflectionPostProcess";
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
        const params = {
            assetUrlRoot: "http://127.0.0.1:8181/",
            assetUrlLevel1: "level1.glb",
            assetUrlEnvironmentTexture: "environment.env"
        };

        const scene = new Level1Scene(engine);
        const physicsPlugin = new AmmoJSPlugin();
        scene.enablePhysics(undefined, physicsPlugin);

        const loadResult = await SceneLoader.ImportMeshAsync("", "http://127.0.0.1:8181/", "level1.glb", scene);
        PhysicsPostLoader.AddPhysicsToHierarchy(loadResult.meshes[0], scene);

        const environmentTexture = CubeTexture.CreateFromPrefilteredData(params.assetUrlRoot + params.assetUrlEnvironmentTexture, scene);
        scene.environmentTexture = environmentTexture;
        scene.createDefaultSkybox(environmentTexture, true, 500, 0.3, false);

        const playerSpawn = scene.getTransformNodeByName("player_spawn");
        if (playerSpawn) {
            const player = new FirstPersonPlayer(scene, playerSpawn.absolutePosition);
            player.camera.maxZ = 10000;

            player.camera.rotation.x += 4 * Math.PI / 9;
            player.camera.rotation.y += Math.PI / 2;

            scene.onPointerDown = () => {
                engine.getRenderingCanvas()!.requestPointerLock();
            };
        } else {
            scene.createDefaultCamera(true, true, true);
        }

        /* var ssao = new SSAO2RenderingPipeline("ssao", scene, {
            ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
            blurRatio: 0.5  // Ratio of the combine post-process (combines the SSAO and the scene)
        });
        ssao.radius = 1;
        ssao.totalStrength = 0.5;
        ssao.expensiveBlur = true;
        ssao.samples = 16;
        ssao.maxZ = 250;
        // Attach camera to the SSAO render pipeline
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", scene.activeCamera!); // Create the SSR post-process! */
        
        /* var ssr = new ScreenSpaceReflectionPostProcess("ssr", scene, 1.0, scene.activeCamera!);
        ssr.reflectionSamples = 32; // Low quality.
        ssr.strength = 1; // Set default strength of reflections.
        ssr.reflectionSpecularFalloffExponent = 2; // Attenuate the reflections a little bit. (typically in interval [1, 3])
        scene.materials.forEach((material) => {
            if (material instanceof PBRMaterial) {
                const mat = material as PBRMaterial;
                mat.reflectivityColor = Color3.BlackReadOnly;
            }
        }); */

        const titleGui = AdvancedDynamicTexture.CreateFullscreenUI("pauseGui");
        await titleGui.parseFromURLAsync("http://localhost:8181/pause_gui.json");
        
        const pauseMenu = titleGui.getControlByName("pauseMenu")!;
        const mainButtonsStackPanel = titleGui.getControlByName("mainButtonsStackPanel")!;
        const settingsButtonsStackPanel = titleGui.getControlByName("settingsButtonsStackPanel")!;
        const keyBindingsGrid = titleGui.getControlByName("keyBindingsGrid")!;

        pauseMenu.isVisible = false;
        pauseMenu.isEnabled = false;
        mainButtonsStackPanel.isVisible = false;
        mainButtonsStackPanel.isEnabled = false;
        settingsButtonsStackPanel.isVisible = false;
        settingsButtonsStackPanel.isEnabled = false;
        keyBindingsGrid.isVisible = false;
        keyBindingsGrid.isEnabled = false;

        const setButtonClickHandler = (buttonName: string, handler: () => void) => {
            const button = titleGui.getControlByName(buttonName) as Button;
            button.onPointerClickObservable.add(handler);
        }

        setButtonClickHandler("resumeButton", () => {
            // TODO: Unpause
            pauseMenu.isVisible = false;
            pauseMenu.isEnabled = false;
            mainButtonsStackPanel.isVisible = false;
            mainButtonsStackPanel.isEnabled = false;
            engine.getRenderingCanvas()!.requestPointerLock();
        });

        setButtonClickHandler("settingsButton", () => {
            mainButtonsStackPanel.isVisible = false;
            mainButtonsStackPanel.isEnabled = false;
            settingsButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isEnabled = true;
        });

        setButtonClickHandler("exitButton", () => {
            scene.requestTitleSceneObservable.notifyObservers();
        });

        setButtonClickHandler("settingsKeyBindingsButton", () => {
            settingsButtonsStackPanel.isVisible = false;
            settingsButtonsStackPanel.isEnabled = false;
            keyBindingsGrid.isVisible = true;
            keyBindingsGrid.isEnabled = true;
        });

        setButtonClickHandler("settingsBackButton", () => {
            mainButtonsStackPanel.isVisible = true;
            mainButtonsStackPanel.isEnabled = true;
            settingsButtonsStackPanel.isVisible = false;
            settingsButtonsStackPanel.isEnabled = false;
        });

        setButtonClickHandler("keyBindingsApplyButton", () => {
            // TODO: Apply the changed settings.
            keyBindingsGrid.isVisible = false;
            keyBindingsGrid.isEnabled = false;
            settingsButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isEnabled = true;
        });

        setButtonClickHandler("keyBindingsCancelButton", () => {
            keyBindingsGrid.isVisible = false;
            keyBindingsGrid.isEnabled = false;
            settingsButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isEnabled = true;
        });

        document.addEventListener("pointerlockchange", (event) => {
            if (document.pointerLockElement !== engine.getRenderingCanvas()) {
                // TODO: Pause
                pauseMenu.isVisible = true;
                mainButtonsStackPanel.isVisible = true;
                pauseMenu.isEnabled = true;
                mainButtonsStackPanel.isEnabled = true;
            }
        })

        return scene;
    }
}