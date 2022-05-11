import { AbstractMesh, CubeTexture, Matrix, Ray, Vector3 } from "@babylonjs/core";
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

class TriggerVolume {
    public onTriggerEntered: Observable<TriggerVolume>;
    public onTriggerExited: Observable<TriggerVolume>;

    protected constructor() {
        this.onTriggerEntered = new Observable<TriggerVolume>();
        this.onTriggerExited = new Observable<TriggerVolume>();
    }
}

class UnitCubeTriggerVolume extends TriggerVolume {
    private _mesh: AbstractMesh;
    private _triggered: boolean;

    private _transform: Matrix;
    private _vector: Vector3;

    public constructor(unitCubeTriggerMesh: AbstractMesh) {
        super();

        this._mesh = unitCubeTriggerMesh;
        this._mesh.isVisible = false;
        this._triggered = false;

        this._transform = new Matrix();
        this._vector = new Vector3();
    }

    public triggerOnVector(positionWorld?: Vector3): void {
        if (!positionWorld) {
            if (this._triggered) {
                this.onTriggerExited.notifyObservers(this);
                this._triggered = false;
            }

            return;
        }

        this._mesh.getWorldMatrix().invertToRef(this._transform);
        Vector3.TransformCoordinatesToRef(positionWorld, this._transform, this._vector);
        const triggered = Math.abs(this._vector.x) < 1 && Math.abs(this._vector.y) < 1 && Math.abs(this._vector.z) < 1;

        if (triggered && !this._triggered) {
            this.onTriggerEntered.notifyObservers(this);
        } else if (!triggered && this._triggered) {
            this.onTriggerExited.notifyObservers(this);
        }

        this._triggered = triggered;
    }
}

enum DoorState{
    Closed,
    Animating,
    Open
}

export class Level1Scene extends RenderTargetScene {
    public requestTitleSceneObservable: Observable<void>;
    public requestLevel1SceneObservable: Observable<void>;

    private _paused: boolean;
    private _updateObservable: Observable<Scene>;

    private _interactKeyBinding: string;

    private _triggerUnitCubes: Array<UnitCubeTriggerVolume>;
    private _activeTriggerName?: string;

    private _doorState: DoorState;
    private _elevatorState: DoorState;

    private constructor(engine: Engine) {
        super(engine);

        this.requestTitleSceneObservable = new Observable<void>();
        this.requestLevel1SceneObservable = new Observable<void>();

        this._paused = false;
        this._updateObservable = new Observable<Scene>();

        const ray = new Ray(Vector3.ZeroReadOnly, Vector3.ZeroReadOnly);
        const raycastOrigin = new Vector3();
        const raycastDestination = new Vector3();

        this.onBeforeRenderObservable.add(() => {
            if (this._paused) {
                return;
            }

            if (this._activeCamera && this._physicsEngine) {
                raycastOrigin.copyFrom(this._activeCamera.globalPosition);
                this.activeCamera?.getForwardRayToRef(ray);
                raycastDestination.copyFrom(ray.direction);
                raycastDestination.scaleInPlace(1);
                raycastDestination.addInPlace(raycastOrigin);

                const result = this._physicsEngine.raycast(raycastOrigin, raycastDestination);

                this._triggerUnitCubes.forEach((trigger) => {
                    trigger.triggerOnVector(result.hasHit ? result.hitPointWorld : undefined);
                });
            }

            this._updateObservable.notifyObservers(this);
        });

        this._interactKeyBinding = "e";
        this.onKeyboardObservable.add((eventData) => {
            if (eventData.type === 2 && eventData.event.key === this._interactKeyBinding && this._activeTriggerName) {
                if (this._activeTriggerName === "door") {
                    if (this._doorState === DoorState.Closed) {
                        this.onBeforeRenderObservable.runCoroutineAsync(this._openDoorCoroutine());
                    } else if (this._doorState === DoorState.Open) {
                        this.onBeforeRenderObservable.runCoroutineAsync(this._closeDoorCoroutine());
                    }
                } else if (this._activeTriggerName === "button") {
                    if (this._elevatorState === DoorState.Closed) {
                        this.onBeforeRenderObservable.runCoroutineAsync(this._openElevatorCoroutine());
                    } else if (this._elevatorState === DoorState.Open) {
                        this.onBeforeRenderObservable.runCoroutineAsync(this._closeElevatorCoroutine());
                    }
                }
            }
        });

        this._triggerUnitCubes = [];

        this._doorState = DoorState.Closed;
        this._elevatorState = DoorState.Closed;
    }

    private *_openDoorCoroutine() {
        this._doorState = DoorState.Animating;
        const door = this.getTransformNodeByName("physics_compound_door")!;
        door.reIntegrateRotationIntoRotationQuaternion = true;
        for (let t = 0; t < 100; ++t) {
            door.rotation.y = 0.01 * 1.1 * -Math.PI / 2;
            yield;
        }
        this._doorState = DoorState.Open;
    }

    private *_closeDoorCoroutine() {
        this._doorState = DoorState.Animating;
        const door = this.getTransformNodeByName("physics_compound_door")!;
        door.reIntegrateRotationIntoRotationQuaternion = true;
        for (let t = 0; t < 100; ++t) {
            door.rotation.y = 0.01 * 1.1 * Math.PI / 2;
            yield;
        }
        this._doorState = DoorState.Closed;
    }

    private *_openElevatorCoroutine() {
        this._elevatorState = DoorState.Animating;
        const leftDoor = this.getMeshByName("physics_box_elevator_door_left")!;
        const rightDoor = this.getMeshByName("physics_box_elevator_door_right")!;
        for (let t = 0; t < 100; ++t) {
            leftDoor.position.z -= 0.008;
            rightDoor.position.z += 0.008;
            yield;
        }
        this._elevatorState = DoorState.Open;
    }

    private *_closeElevatorCoroutine() {
        this._elevatorState = DoorState.Animating;
        const leftDoor = this.getMeshByName("physics_box_elevator_door_left")!;
        const rightDoor = this.getMeshByName("physics_box_elevator_door_right")!;
        for (let t = 0; t < 100; ++t) {
            leftDoor.position.z += 0.008;
            rightDoor.position.z -= 0.008;
            yield;
        }
        this._elevatorState = DoorState.Closed;
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

        const triggerNames = ["door", "button"];
        triggerNames.forEach((name) => {
            const mesh = scene.getMeshByName(`trigger_unit_cube_${name}`)!;
            const trigger = new UnitCubeTriggerVolume(mesh);
            trigger.onTriggerEntered.add(() => {
                scene._activeTriggerName = name;
            });
            trigger.onTriggerExited.add(() => {
                if (scene._activeTriggerName! === name) {
                    scene._activeTriggerName = undefined;
                }
            });
            scene._triggerUnitCubes.push(trigger);
        });

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

        const pauseGui = AdvancedDynamicTexture.CreateFullscreenUI("pauseGui");
        await pauseGui.parseFromURLAsync("http://localhost:8181/pause_gui.json");
        
        const pauseMenu = pauseGui.getControlByName("pauseMenu")!;
        const mainButtonsStackPanel = pauseGui.getControlByName("mainButtonsStackPanel")!;
        const settingsButtonsStackPanel = pauseGui.getControlByName("settingsButtonsStackPanel")!;
        const keyBindingsGrid = pauseGui.getControlByName("keyBindingsGrid")!;
        
        const walkInputText = pauseGui.getControlByName("walkInputText")! as InputText;
        const interactInputText = pauseGui.getControlByName("interactInputText")! as InputText;
        const jumpInputText = pauseGui.getControlByName("jumpInputText")! as InputText;
        // TODO: Retrieve bindings from local storage, if available.
        let walkKeyBinding = walkInputText.text;
        let interactKeyBinding = interactInputText.text;
        let jumpKeyBinding = jumpInputText.text;

        const setKeyBindings = () => {
            let binding = walkKeyBinding.toLocaleLowerCase();
            player.setKeyBinding(InputSamplerAxis.Forward, binding === "space" ? " " : binding);
            binding = interactKeyBinding.toLocaleLowerCase();
            scene._interactKeyBinding = binding === "space" ? " " : binding;
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
            const button = pauseGui.getControlByName(buttonName) as Button;
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
