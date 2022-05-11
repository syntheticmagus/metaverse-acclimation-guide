import { CubeTexture, PassPostProcess } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Observable } from "@babylonjs/core/Misc/observable";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/Plugins/ammoJSPlugin";
import { Scene } from "@babylonjs/core/scene";
import { InputText } from "@babylonjs/gui";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { InputSamplerAxis } from "@syntheticmagus/first-person-player/lib";
import { FirstPersonPlayer } from "@syntheticmagus/first-person-player/lib/firstPersonPlayer";
import { PhysicsPostLoader } from "@syntheticmagus/physics-post-loader/lib/physicsPostLoader";
import { RenderTargetScene } from "./renderTargetScene";

export class Level1Scene extends RenderTargetScene {
    public requestTitleSceneObservable: Observable<void>;
    public requestLevel1SceneObservable: Observable<void>;

    private _paused: boolean;
    private _updateObservable: Observable<Scene>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestTitleSceneObservable = new Observable<void>();
        this.requestLevel1SceneObservable = new Observable<void>();

        this._paused = false;
        this._updateObservable = new Observable<Scene>();
        this.onBeforeRenderObservable.add(() => {
            if (!this._paused) {
                this._updateObservable.notifyObservers(this);
            }
        });
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

        const playerSpawn = scene.getTransformNodeByName("player_spawn")!;
        const player = new FirstPersonPlayer(scene, playerSpawn.absolutePosition, scene._updateObservable);
        player.camera.maxZ = 1000;

        player.camera.rotation.x += 4 * Math.PI / 9;
        player.camera.rotation.y += Math.PI / 2;

        scene.onPointerDown = () => {
            engine.getRenderingCanvas()!.requestPointerLock();
        };

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
        
        const walkInputText = titleGui.getControlByName("walkInputText")! as InputText;
        const interactInputText = titleGui.getControlByName("interactInputText")! as InputText;
        const jumpInputText = titleGui.getControlByName("jumpInputText")! as InputText;
        // TODO: Retrieve bindings from local storage, if available.
        let walkKeyBinding = walkInputText.text;
        let interactKeyBinding = interactInputText.text;
        let jumpKeyBinding = jumpInputText.text;

        const setKeyBindings = () => {
            let binding = walkKeyBinding.toLocaleLowerCase();
            player.setKeyBinding(InputSamplerAxis.Forward, binding === "space" ? " " : binding);
            // TODO: Set the interact key binding.
            binding = jumpKeyBinding.toLowerCase();
            player.setKeyBinding(InputSamplerAxis.Jump, binding === "space" ? " " : binding);
        };

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
            scene._paused = false;
            // TODO: Resume the physics simulation.
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
            walkInputText.text = walkKeyBinding;
            interactInputText.text = interactKeyBinding;
            jumpInputText.text = jumpKeyBinding;

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
            walkKeyBinding = walkInputText.text;
            interactKeyBinding = interactInputText.text;
            jumpKeyBinding = jumpInputText.text;

            setKeyBindings();

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

        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement !== engine.getRenderingCanvas()) {
                scene._paused = true;
                // TODO: Pause the physics simulation.
                pauseMenu.isVisible = true;
                mainButtonsStackPanel.isVisible = true;
                pauseMenu.isEnabled = true;
                mainButtonsStackPanel.isEnabled = true;
            }
        })

        return scene;
    }
}
