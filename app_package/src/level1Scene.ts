import { AbstractMesh, CubeTexture, Matrix, Ray, Sound, Tools, Vector3 } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Observable } from "@babylonjs/core/Misc/observable";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/Plugins/ammoJSPlugin";
import { Scene } from "@babylonjs/core/scene";
import { InputText, Rectangle, TextBlock } from "@babylonjs/gui";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { InputSamplerAxis } from "@syntheticmagus/first-person-player/lib";
import { FirstPersonPlayer } from "@syntheticmagus/first-person-player/lib/firstPersonPlayer";
import { PhysicsPostLoader } from "@syntheticmagus/physics-post-loader/lib/physicsPostLoader";
import { FiniteStateMachine } from "./finiteStateMachine";
import { RenderTargetScene } from "./renderTargetScene";
import { VoiceOverTrack, SoundEffectTrack, IGameParams, Model, HdrEnvironment } from "./gameParams";

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

function enumCount(T: any): number {
    return T._end - T._start - 1;
}

class VoiceOver {
    public onTrackStartedObservable: Observable<VoiceOverTrack>;
    public onTrackFinishedObservable: Observable<VoiceOverTrack>;

    private _tracks: Sound[];
    private _currentlyPlayingTrack: Sound | undefined;

    private constructor(scene: Level1Scene) {
        this.onTrackStartedObservable = new Observable<VoiceOverTrack>();
        this.onTrackFinishedObservable = new Observable<VoiceOverTrack>();

        this._tracks = new Array<Sound>(enumCount(VoiceOverTrack));
    }

    public static async CreateAsync(scene: Level1Scene, trackToUrl: Map<VoiceOverTrack, string>): Promise<VoiceOver> {
        const vo = new VoiceOver(scene);

        return new Promise<VoiceOver>((resolve) => {
            let unloadedTracks = 0;
            const initializeVoiceTrack = (track: VoiceOverTrack, url: string) => {
                ++unloadedTracks;
                vo._tracks[track] = new Sound(VoiceOverTrack[track], url, scene, () => {
                    --unloadedTracks;
                    if (unloadedTracks === 0) {
                        resolve(vo);
                    }
                });

                vo._tracks[track].onEndedObservable.add(() => {
                    if (vo._currentlyPlayingTrack !== vo._tracks[track]) {
                        throw new Error("Finished playing a track that shouldn't have been playing.");
                    }
                    vo.onTrackFinishedObservable.notifyObservers(track);
                    vo._currentlyPlayingTrack = undefined;
                });
            }
            
            for (let track = VoiceOverTrack._start + 1; track < VoiceOverTrack._end; ++track) {
                const url = trackToUrl.get(track);
                if (url) {
                    initializeVoiceTrack(track, url);
                }
            }
        });
    }

    public play(track: VoiceOverTrack) {
        if (this._currentlyPlayingTrack) {
            this._currentlyPlayingTrack.stop();
        }
        this._currentlyPlayingTrack = this._tracks[track];
        this._currentlyPlayingTrack.play();
        this.onTrackStartedObservable.notifyObservers(track);
    }

    public pause() {
        this._currentlyPlayingTrack?.pause();
    }

    public resume() {
        this._currentlyPlayingTrack?.play();
    }
}

class SoundEffects {
    private _tracks: Sound[];

    private constructor(scene: Level1Scene) {
        this._tracks = new Array<Sound>(enumCount(SoundEffectTrack));
    }

    public async createAsync(scene: Level1Scene, trackToUrl: Map<SoundEffectTrack, string>): Promise<void> {
        const sfx = new SoundEffects(scene);

        return new Promise<void>((resolve) => {
            let unloadedTracks = 0;
            const initializeVoiceTrack = (track: SoundEffectTrack, url: string) => {
                ++unloadedTracks;
                sfx._tracks[track] = new Sound(SoundEffectTrack[track], url, scene, () => {
                    --unloadedTracks;
                    if (unloadedTracks === 0) {
                        resolve();
                    }
                });
            }
            
            for (let track = SoundEffectTrack._start + 1; track < SoundEffectTrack._end; ++track) {
                const url = trackToUrl.get(track);
                if (url) {
                    initializeVoiceTrack(track, url);
                }
            }
        });
    }

    public play(track: SoundEffectTrack) {
        this._tracks[track].play();
    }

    public pause() {
        this._tracks.forEach((track) => {
            if (track.isPlaying) {
                track.pause();
            }
        });
    }

    public resume() {
        this._tracks.forEach((track) => {
            if (track.isPaused) {
                track.play();
            }
        });
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

    private _player?: FirstPersonPlayer;

    private _voiceOver?: VoiceOver;

    private constructor(engine: Engine) {
        super(engine);

        this.requestTitleSceneObservable = new Observable<void>();
        this.requestLevel1SceneObservable = new Observable<void>();

        this._paused = false;
        this._updateObservable = new Observable<Scene>();

        const ray = new Ray(new Vector3(), new Vector3());
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
                        this._updateObservable.runCoroutineAsync(this._openDoorCoroutine());
                    } else if (this._doorState === DoorState.Open) {
                        this._updateObservable.runCoroutineAsync(this._closeDoorCoroutine());
                    }
                } else if (this._activeTriggerName === "button") {
                    if (this._elevatorState === DoorState.Closed) {
                        this._updateObservable.runCoroutineAsync(this._openElevatorCoroutine());
                    } else if (this._elevatorState === DoorState.Open) {
                        this._updateObservable.runCoroutineAsync(this._closeElevatorCoroutine());
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

    private _loadHdrLighting(params: IGameParams) {
        const environmentTexture = CubeTexture.CreateFromPrefilteredData(params.assetToUrl.get(HdrEnvironment.MainLevel)!, this);
        this.environmentTexture = environmentTexture;
        this.createDefaultSkybox(environmentTexture, true, 500, 0.3, false);
    }

    private _spawnPlayer() {
        const playerSpawn = this.getTransformNodeByName("player_spawn")!;
        this._player = new FirstPersonPlayer(this, playerSpawn.absolutePosition, this._updateObservable);
        this._player.camera.maxZ = 1000;

        this._player.camera.rotation.x += 4 * Math.PI / 9;
        this._player.camera.rotation.y += Math.PI / 2;
    }

    private async _initializeGameGuiAsync() {
        const gameGui = AdvancedDynamicTexture.CreateFullscreenUI("gameGui");
        await gameGui.parseFromURLAsync("http://localhost:8181/game_gui.json");
        
        const pauseMenu = gameGui.getControlByName("pauseMenu")!;
        const mainButtonsStackPanel = gameGui.getControlByName("mainButtonsStackPanel")!;
        const settingsButtonsStackPanel = gameGui.getControlByName("settingsButtonsStackPanel")!;
        const keyBindingsGrid = gameGui.getControlByName("keyBindingsGrid")!;

        const gameplayUI = gameGui.getControlByName("gameplayUI")!;
        gameplayUI.isEnabled = false;
        
        const keyBindingsWalkButton = gameGui.getControlByName("keyBindingsWalkButton")! as Button;
        const keyBindingsInteractButton = gameGui.getControlByName("keyBindingsInteractButton")! as Button;
        const keyBindingsJumpButton = gameGui.getControlByName("keyBindingsJumpButton")! as Button;
        // TODO: Retrieve bindings from local storage, if available.
        let walkKeyBinding = keyBindingsWalkButton.textBlock!.text;
        let interactKeyBinding = keyBindingsInteractButton.textBlock!.text;
        let jumpKeyBinding = keyBindingsJumpButton.textBlock!.text;

        const keyBindingPromptModal = gameGui.getControlByName("keyBindingPromptModal")!;

        const interactPromptRectangle = gameGui.getControlByName("interactPromptRectangle")!;
        const interactTextBlock = gameGui.getControlByName("interactTextBlock")! as TextBlock;
        interactPromptRectangle.alpha = 0;
        this._updateObservable.add(() => {
            interactPromptRectangle.alpha *= 0.8;
            interactPromptRectangle.alpha += (0.2 * (this._activeTriggerName ? 1 : 0));
        });

        const achievementRectangle = gameGui.getControlByName("achievementRectangle")! as Rectangle;
        const achievementText = gameGui.getControlByName("achievementText")! as TextBlock;
        achievementRectangle.topInPixels = 300;

        const setKeyBindings = () => {
            let binding = walkKeyBinding.toLocaleLowerCase();
            this._player?.setKeyBinding(InputSamplerAxis.Forward, binding === "space" ? " " : binding);
            binding = interactKeyBinding.toLocaleLowerCase();
            this._interactKeyBinding = binding === "space" ? " " : binding;
            binding = jumpKeyBinding.toLowerCase();
            this._player?.setKeyBinding(InputSamplerAxis.Jump, binding === "space" ? " " : binding);

            interactTextBlock.text = interactKeyBinding;
        };
        setKeyBindings();

        pauseMenu.isVisible = false;
        pauseMenu.isEnabled = false;
        mainButtonsStackPanel.isVisible = false;
        mainButtonsStackPanel.isEnabled = false;
        settingsButtonsStackPanel.isVisible = false;
        settingsButtonsStackPanel.isEnabled = false;
        keyBindingsGrid.isVisible = false;
        keyBindingsGrid.isEnabled = false;

        const setButtonClickHandler = (buttonName: string, handler: () => void) => {
            const button = gameGui.getControlByName(buttonName) as Button;
            button.onPointerClickObservable.add(handler);
        }

        setButtonClickHandler("resumeButton", () => {
            this._paused = false;
            this.physicsEnabled = true;
            
            pauseMenu.isVisible = false;
            pauseMenu.isEnabled = false;
            mainButtonsStackPanel.isVisible = false;
            mainButtonsStackPanel.isEnabled = false;
            this.getEngine().getRenderingCanvas()!.requestPointerLock();
        });

        setButtonClickHandler("settingsButton", () => {
            mainButtonsStackPanel.isVisible = false;
            mainButtonsStackPanel.isEnabled = false;
            settingsButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isEnabled = true;
        });

        setButtonClickHandler("exitButton", () => {
            this.requestTitleSceneObservable.notifyObservers();
        });

        setButtonClickHandler("settingsKeyBindingsButton", () => {
            keyBindingsWalkButton.textBlock!.text = walkKeyBinding;
            keyBindingsInteractButton.textBlock!.text = interactKeyBinding;
            keyBindingsJumpButton.textBlock!.text = jumpKeyBinding;

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
            walkKeyBinding = keyBindingsWalkButton.textBlock!.text;
            interactKeyBinding = keyBindingsInteractButton.textBlock!.text;
            jumpKeyBinding = keyBindingsJumpButton.textBlock!.text;

            setKeyBindings();

            keyBindingsGrid.isVisible = false;
            keyBindingsGrid.isEnabled = false;
            settingsButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isEnabled = true;
        });

        keyBindingsWalkButton.onPointerClickObservable.add(() => {
            keyBindingPromptModal.isVisible = true;
            keyBindingPromptModal.isEnabled = true;
            
            const observable = this.onKeyboardObservable.add((eventData) => {
                if (eventData.type === 2 && "abcdefghijklmnopqrstuvwxyz ".indexOf(eventData.event.key.toLowerCase()) >= 0) {
                    keyBindingsWalkButton.textBlock!.text = eventData.event.key === " " ? "Space" : eventData.event.key.toUpperCase();

                    keyBindingPromptModal.isVisible = false;
                    keyBindingPromptModal.isEnabled = false;

                    this.onKeyboardObservable.remove(observable);
                }
            });
        });

        keyBindingsInteractButton.onPointerClickObservable.add(() => {
            keyBindingPromptModal.isVisible = true;
            keyBindingPromptModal.isEnabled = true;
            
            const observable = this.onKeyboardObservable.add((eventData) => {
                if (eventData.type === 2 && "abcdefghijklmnopqrstuvwxyz ".indexOf(eventData.event.key.toLowerCase()) >= 0) {
                    keyBindingsInteractButton.textBlock!.text = eventData.event.key === " " ? "Space" : eventData.event.key.toUpperCase();

                    keyBindingPromptModal.isVisible = false;
                    keyBindingPromptModal.isEnabled = false;

                    this.onKeyboardObservable.remove(observable);
                }
            });
        });

        keyBindingsJumpButton.onPointerClickObservable.add(() => {
            keyBindingPromptModal.isVisible = true;
            keyBindingPromptModal.isEnabled = true;
            
            const observable = this.onKeyboardObservable.add((eventData) => {
                if (eventData.type === 2 && "abcdefghijklmnopqrstuvwxyz ".indexOf(eventData.event.key.toLowerCase()) >= 0) {
                    keyBindingsJumpButton.textBlock!.text = eventData.event.key === " " ? "Space" : eventData.event.key.toUpperCase();

                    keyBindingPromptModal.isVisible = false;
                    keyBindingPromptModal.isEnabled = false;

                    this.onKeyboardObservable.remove(observable);
                }
            });
        });

        setButtonClickHandler("keyBindingsCancelButton", () => {
            keyBindingsGrid.isVisible = false;
            keyBindingsGrid.isEnabled = false;
            settingsButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isEnabled = true;
        });

        this.onPointerDown = () => {
            if (document.pointerLockElement !== this.getEngine().getRenderingCanvas()) {
                this.getEngine().getRenderingCanvas()!.requestPointerLock();
            }
        };

        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement !== this.getEngine().getRenderingCanvas()) {
                this._paused = true;
                this.physicsEnabled = false;
                
                pauseMenu.isVisible = true;
                mainButtonsStackPanel.isVisible = true;
                pauseMenu.isEnabled = true;
                mainButtonsStackPanel.isEnabled = true;
            }
        });
    }

    private async _initializeSoundEffectsAsync(params: IGameParams) {

    }

    private async _initializeVoiceOverAsync(params: IGameParams) {
        this._voiceOver = await VoiceOver.CreateAsync(this, params.assetToUrl);
        await Tools.DelayAsync(5000);
        this._voiceOver.play(VoiceOverTrack.InvoluntaryFloorInspection);
    }

    public static async CreateAsync(engine: Engine, params: IGameParams): Promise<Level1Scene> {
        const scene = new Level1Scene(engine);
        const physicsPlugin = new AmmoJSPlugin();
        scene.enablePhysics(undefined, physicsPlugin);

        const loadResult = await SceneLoader.ImportMeshAsync("", params.assetToUrl.get(Model.MainLevel)!, undefined, scene);
        PhysicsPostLoader.AddPhysicsToHierarchy(loadResult.meshes[0], scene);

        loadResult.meshes.forEach((mesh) => {
            mesh.isPickable = false;
        });

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

        scene._loadHdrLighting(params);
        scene._spawnPlayer();

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

        await scene._initializeGameGuiAsync();

        scene._initializeSoundEffectsAsync(params);
        scene._initializeVoiceOverAsync(params);

        return scene;
    }
}
