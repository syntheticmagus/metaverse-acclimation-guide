import { AbstractMesh, CubeTexture, Logger, Matrix, Ray, Sound, SSAO2RenderingPipeline, Tools, Vector2, Vector3 } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Observable } from "@babylonjs/core/Misc/observable";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/Plugins/ammoJSPlugin";
import { Scene } from "@babylonjs/core/scene";
import { Control, Rectangle, TextBlock } from "@babylonjs/gui";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { InputSamplerAxis } from "@syntheticmagus/first-person-player/lib";
import { FirstPersonPlayer } from "@syntheticmagus/first-person-player/lib/firstPersonPlayer";
import { PhysicsPostLoader } from "@syntheticmagus/physics-post-loader/lib/physicsPostLoader";
import { FiniteStateMachine } from "./finiteStateMachine";
import { RenderTargetScene } from "./renderTargetScene";
import { VoiceOverTrack, SoundEffectTrack, IGameParams, Model, HdrEnvironment } from "./gameParams";
import { sceneUboDeclaration } from "@babylonjs/core/Shaders/ShadersInclude/sceneUboDeclaration";

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
                    vo.onTrackFinishedObservable.notifyObservers(track);
                    if (vo._currentlyPlayingTrack === vo._tracks[track]) {
                        vo._currentlyPlayingTrack = undefined;
                    }
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

    public static async CreateAsync(scene: Level1Scene, trackToUrl: Map<SoundEffectTrack, string>): Promise<SoundEffects> {
        const sfx = new SoundEffects(scene);

        return new Promise<SoundEffects>((resolve) => {
            let unloadedTracks = 0;
            const initializeVoiceTrack = (track: SoundEffectTrack, url: string) => {
                ++unloadedTracks;
                sfx._tracks[track] = new Sound(SoundEffectTrack[track], url, scene, () => {
                    --unloadedTracks;
                    if (unloadedTracks === 0) {
                        resolve(sfx);
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

    public play(track: SoundEffectTrack, loop: boolean = false, volume: number = 1) {
        this._tracks[track].play();
        this._tracks[track].loop = loop;
        this._tracks[track].setVolume(volume);
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
    private _pauseVoiceOverWhenGamePauses: boolean;
    private _updateObservable: Observable<Scene>;
    private _triggerInteractionObservable: Observable<string>;

    private _interactKeyBinding?: string;

    private _interactionTriggerUnitCubes: Array<UnitCubeTriggerVolume>;
    private _activeInteractionTriggerName?: string;

    private _mainRoomTriggerUnitCube?: UnitCubeTriggerVolume;
    private _hallwayTriggerUnitCube?: UnitCubeTriggerVolume;
    private _elevatorTriggerUnitCube?: UnitCubeTriggerVolume;

    private _doorState: DoorState;
    private _elevatorState: DoorState;

    private _player?: FirstPersonPlayer;

    private _soundEffects?: SoundEffects;
    private _voiceOver?: VoiceOver;

    private _keyBindingsGrid?: Control;
    private _settingsKeyBindingsButton?: Control;
    private _keyBindingsInteractButton?: Button;
    private _achievementRectangle?: Rectangle;
    private _achievementTextBlock?: TextBlock;

    private constructor(engine: Engine) {
        super(engine);

        this.requestTitleSceneObservable = new Observable<void>();
        this.requestLevel1SceneObservable = new Observable<void>();

        this._paused = false;
        this._pauseVoiceOverWhenGamePauses = true;
        this._updateObservable = new Observable<Scene>();
        this._triggerInteractionObservable = new Observable<string>();

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

                this._interactionTriggerUnitCubes.forEach((trigger) => {
                    trigger.triggerOnVector(result.hasHit ? result.hitPointWorld : undefined);
                });
            }

            this._updateObservable.notifyObservers(this);
        });

        this.onKeyboardObservable.add((eventData) => {
            if (eventData.type === 2 && eventData.event.key === this._interactKeyBinding && this._activeInteractionTriggerName) {
                this._triggerInteractionObservable.notifyObservers(this._activeInteractionTriggerName);
            }
        });

        this._triggerInteractionObservable.add((trigger) => {
            if (trigger === "door") {
                if (this._doorState === DoorState.Closed) {
                    this._updateObservable.runCoroutineAsync(this._openDoorCoroutine());
                } else if (this._doorState === DoorState.Open) {
                    this._updateObservable.runCoroutineAsync(this._closeDoorCoroutine());
                }
            } else if (trigger === "button") {
                if (this._elevatorState === DoorState.Closed) {
                    this._updateObservable.runCoroutineAsync(this._openElevatorCoroutine());
                } else if (this._elevatorState === DoorState.Open) {
                    this._updateObservable.runCoroutineAsync(this._closeElevatorCoroutine());
                }
            }
        });

        this._interactionTriggerUnitCubes = [];

        this._doorState = DoorState.Closed;
        this._elevatorState = DoorState.Closed;
    }

    private *_openDoorCoroutine() {
        this._soundEffects?.play(SoundEffectTrack.Hinge, false, 0.5);

        this._doorState = DoorState.Animating;
        const door = this.getTransformNodeByName("physics_compound_door")!;
        door.reIntegrateRotationIntoRotationQuaternion = true;
        for (let t = 0; t < 120; ++t) {
            door.rotation.y = 0.008 * 1.1 * -Math.PI / 2;
            yield;
        }
        this._doorState = DoorState.Open;
    }

    private *_closeDoorCoroutine() {
        this._soundEffects?.play(SoundEffectTrack.Hinge, false, 0.5);

        this._doorState = DoorState.Animating;
        const door = this.getTransformNodeByName("physics_compound_door")!;
        door.reIntegrateRotationIntoRotationQuaternion = true;
        for (let t = 0; t < 120; ++t) {
            door.rotation.y = 0.008 * 1.1 * Math.PI / 2;
            yield;
        }
        this._doorState = DoorState.Closed;
    }

    private *_openElevatorCoroutine() {
        this._soundEffects?.play(SoundEffectTrack.Elevator);

        this._elevatorState = DoorState.Animating;
        yield this._delayAsync(1000);
        const leftDoor = this.getMeshByName("physics_box_elevator_door_left")!;
        const rightDoor = this.getMeshByName("physics_box_elevator_door_right")!;
        for (let t = 0; t < 150; ++t) {
            leftDoor.position.z -= 0.005;
            rightDoor.position.z += 0.005;
            yield;
        }
        this._elevatorState = DoorState.Open;
    }

    private *_closeElevatorCoroutine() {
        this._soundEffects?.play(SoundEffectTrack.Elevator);

        this._elevatorState = DoorState.Animating;
        yield this._delayAsync(1000);
        const leftDoor = this.getMeshByName("physics_box_elevator_door_left")!;
        const rightDoor = this.getMeshByName("physics_box_elevator_door_right")!;
        for (let t = 0; t < 150; ++t) {
            leftDoor.position.z += 0.005;
            rightDoor.position.z -= 0.005;
            yield;
        }
        this._elevatorState = DoorState.Closed;
    }

    private *_showAchievementCoroutine(text: string) {
        this._achievementTextBlock!.text = text;

        for (let px = 30; px >= 0; --px) {
            this._achievementRectangle!.topInPixels = 10 * px;
            yield;
        }

        for (let idx = 0; idx < 240; ++idx) {
            yield;
        }

        for (let px = 0; px <= 30; ++px) {
            this._achievementRectangle!.topInPixels = 10 * px;
            yield;
        }
    }

    private *_footstepsCoroutine() {
        const stride = 0.65;
        let distance = 0;
        const priorPosition = new Vector2(this.activeCamera!.globalPosition.x, this.activeCamera!.globalPosition.z);
        const currentPosition = priorPosition.clone();
        while (true) {
            currentPosition.copyFromFloats(this.activeCamera!.globalPosition.x, this.activeCamera!.globalPosition.z);
            distance += Vector2.Distance(priorPosition, currentPosition);
            if (distance > stride) {
                distance = 0;
                this._soundEffects?.play(SoundEffectTrack.Footstep);
            }
            distance *= 0.95;
            priorPosition.copyFrom(currentPosition);

            yield;
        }
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

        this._player.lookSensitivity = 0;
        this._player.moveSpeed = 0;
        this._player.jumpForce = 0;
    }

    private async _initializeGameGuiAsync() {
        const gameGui = AdvancedDynamicTexture.CreateFullscreenUI("gameGui");
        await gameGui.parseFromURLAsync("http://localhost:8181/game_gui.json");
        
        const pauseMenu = gameGui.getControlByName("pauseMenu")!;
        const mainButtonsStackPanel = gameGui.getControlByName("mainButtonsStackPanel")!;
        const settingsButtonsStackPanel = gameGui.getControlByName("settingsButtonsStackPanel")!;
        this._keyBindingsGrid = gameGui.getControlByName("keyBindingsGrid")!;
        
        this._settingsKeyBindingsButton = gameGui.getControlByName("settingsKeyBindingsButton")!;
        this._settingsKeyBindingsButton.isEnabled = false;
        this._settingsKeyBindingsButton.isVisible = false;

        const gameplayUI = gameGui.getControlByName("gameplayUI")!;
        gameplayUI.isEnabled = false;
        
        const keyBindingsWalkButton = gameGui.getControlByName("keyBindingsWalkButton")! as Button;
        this._keyBindingsInteractButton = gameGui.getControlByName("keyBindingsInteractButton")! as Button;
        const keyBindingsJumpButton = gameGui.getControlByName("keyBindingsJumpButton")! as Button;
        // TODO: Retrieve bindings from local storage, if available.
        let walkKeyBinding = keyBindingsWalkButton.textBlock!.text;
        let interactKeyBinding = this._keyBindingsInteractButton.textBlock!.text;
        let jumpKeyBinding = keyBindingsJumpButton.textBlock!.text;

        const keyBindingPromptModal = gameGui.getControlByName("keyBindingPromptModal")!;

        const interactPromptRectangle = gameGui.getControlByName("interactPromptRectangle")!;
        const interactTextBlock = gameGui.getControlByName("interactTextBlock")! as TextBlock;
        interactPromptRectangle.alpha = 0;
        this._updateObservable.add(() => {
            interactPromptRectangle.alpha *= 0.8;
            interactPromptRectangle.alpha += (0.2 * (this._activeInteractionTriggerName && !this._activeInteractionTriggerName.startsWith("door_") ? 1 : 0));
        });

        this._achievementRectangle = gameGui.getControlByName("achievementRectangle")! as Rectangle;
        this._achievementTextBlock = gameGui.getControlByName("achievementText")! as TextBlock;
        this._achievementRectangle.topInPixels = 300;

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
        this._keyBindingsGrid.isVisible = false;
        this._keyBindingsGrid.isEnabled = false;

        const setButtonClickHandler = (buttonName: string, handler: () => void) => {
            const button = gameGui.getControlByName(buttonName) as Button;
            button.onPointerClickObservable.add(handler);
        }

        setButtonClickHandler("resumeButton", () => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);

            this._paused = false;
            this.physicsEnabled = true;
            if (this._pauseVoiceOverWhenGamePauses) {
                this._voiceOver?.resume();
            }
            this._soundEffects?.resume();
            
            pauseMenu.isVisible = false;
            pauseMenu.isEnabled = false;
            mainButtonsStackPanel.isVisible = false;
            mainButtonsStackPanel.isEnabled = false;
            this.getEngine().getRenderingCanvas()!.requestPointerLock();
        });

        setButtonClickHandler("settingsButton", () => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            mainButtonsStackPanel.isVisible = false;
            mainButtonsStackPanel.isEnabled = false;
            settingsButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isEnabled = true;
        });

        setButtonClickHandler("exitButton", () => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            this.requestTitleSceneObservable.notifyObservers();
        });

        setButtonClickHandler("settingsKeyBindingsButton", () => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            keyBindingsWalkButton.textBlock!.text = walkKeyBinding;
            this._keyBindingsInteractButton!.textBlock!.text = interactKeyBinding;
            keyBindingsJumpButton.textBlock!.text = jumpKeyBinding;

            settingsButtonsStackPanel.isVisible = false;
            settingsButtonsStackPanel.isEnabled = false;
            this._keyBindingsGrid!.isVisible = true;
            this._keyBindingsGrid!.isEnabled = true;
        });

        setButtonClickHandler("settingsBackButton", () => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            mainButtonsStackPanel.isVisible = true;
            mainButtonsStackPanel.isEnabled = true;
            settingsButtonsStackPanel.isVisible = false;
            settingsButtonsStackPanel.isEnabled = false;
        });

        setButtonClickHandler("keyBindingsApplyButton", () => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            walkKeyBinding = keyBindingsWalkButton.textBlock!.text;
            interactKeyBinding = this._keyBindingsInteractButton!.textBlock!.text;
            jumpKeyBinding = keyBindingsJumpButton.textBlock!.text;

            setKeyBindings();

            this._keyBindingsGrid!.isVisible = false;
            this._keyBindingsGrid!.isEnabled = false;
            settingsButtonsStackPanel.isVisible = true;
            settingsButtonsStackPanel.isEnabled = true;
        });

        keyBindingsWalkButton.onPointerClickObservable.add(() => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            keyBindingPromptModal.isVisible = true;
            keyBindingPromptModal.isEnabled = true;
            
            const observable = this.onKeyboardObservable.add((eventData) => {
                if (eventData.type === 2 && "abcdefghijklmnopqrstuvwxyz ".indexOf(eventData.event.key.toLowerCase()) >= 0) {
                    this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
                    
                    keyBindingsWalkButton.textBlock!.text = eventData.event.key === " " ? "Space" : eventData.event.key.toUpperCase();

                    keyBindingPromptModal.isVisible = false;
                    keyBindingPromptModal.isEnabled = false;

                    this.onKeyboardObservable.remove(observable);
                }
            });
        });

        this._keyBindingsInteractButton.onPointerClickObservable.add(() => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            keyBindingPromptModal.isVisible = true;
            keyBindingPromptModal.isEnabled = true;
            
            const observable = this.onKeyboardObservable.add((eventData) => {
                if (eventData.type === 2 && "abcdefghijklmnopqrstuvwxyz ".indexOf(eventData.event.key.toLowerCase()) >= 0) {
                    this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
                    
                    this._keyBindingsInteractButton!.textBlock!.text = eventData.event.key === " " ? "Space" : eventData.event.key.toUpperCase();

                    keyBindingPromptModal.isVisible = false;
                    keyBindingPromptModal.isEnabled = false;

                    this.onKeyboardObservable.remove(observable);
                }
            });
        });

        keyBindingsJumpButton.onPointerClickObservable.add(() => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            keyBindingPromptModal.isVisible = true;
            keyBindingPromptModal.isEnabled = true;
            
            const observable = this.onKeyboardObservable.add((eventData) => {
                if (eventData.type === 2 && "abcdefghijklmnopqrstuvwxyz ".indexOf(eventData.event.key.toLowerCase()) >= 0) {
                    this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
                    
                    keyBindingsJumpButton.textBlock!.text = eventData.event.key === " " ? "Space" : eventData.event.key.toUpperCase();

                    keyBindingPromptModal.isVisible = false;
                    keyBindingPromptModal.isEnabled = false;

                    this.onKeyboardObservable.remove(observable);
                }
            });
        });

        setButtonClickHandler("keyBindingsCancelButton", () => {
            this._soundEffects?.play(SoundEffectTrack.Click, false, 0.1);
            
            this._keyBindingsGrid!.isVisible = false;
            this._keyBindingsGrid!.isEnabled = false;
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
                if (this._pauseVoiceOverWhenGamePauses) {
                    this._voiceOver?.pause();
                }
                this._soundEffects?.pause();
                
                pauseMenu.isVisible = true;
                mainButtonsStackPanel.isVisible = true;
                pauseMenu.isEnabled = true;
                mainButtonsStackPanel.isEnabled = true;
            }
        });
    }

    private async _delayAsync(millis: number) {
        const scene = this;
        await this._updateObservable.runCoroutineAsync(function *() {
            while (millis > 0) {
                millis -= scene.deltaTime;
                yield;
            }
        }());
    }

    private async _initializeSoundEffectsAsync(params: IGameParams) {
        this._soundEffects = await SoundEffects.CreateAsync(this, params.assetToUrl);

        this._soundEffects.play(SoundEffectTrack.Music, true);

        this._updateObservable.runCoroutineAsync(this._footstepsCoroutine());
    }

    private async _initializeVoiceOverAsync(params: IGameParams) {
        this._voiceOver = await VoiceOver.CreateAsync(this, params.assetToUrl);

        let mouseLookFinished = false;
        this._voiceOver.onTrackFinishedObservable.add((track) => {
            switch (track) {
                case VoiceOverTrack.InvoluntaryFloorInspection:
                    this._voiceOver!.play(VoiceOverTrack.PleaseRemainCalm);
                    break;
                case VoiceOverTrack.PleaseRemainCalm:
                    this._delayAsync(4000).then(() => {
                        this._voiceOver!.play(VoiceOverTrack.AchievementsInCalmness);
                    });
                    break;
                case VoiceOverTrack.AchievementsInCalmness:
                    this._updateObservable.runCoroutineAsync(this._showAchievementCoroutine("Remain Calm"));
                    this._voiceOver!.play(VoiceOverTrack.UnactionableInformation);
                    break;
                case VoiceOverTrack.UnactionableInformation:
                    this._updateObservable.runCoroutineAsync(this._showAchievementCoroutine("Remain Attentive"));
                    this._voiceOver!.play(VoiceOverTrack.NoteworthyAchievements);
                    break;
                case VoiceOverTrack.NoteworthyAchievements:
                    this._updateObservable.runCoroutineAsync(this._showAchievementCoroutine("Remain Patient"));
                    this._voiceOver!.play(VoiceOverTrack.BanalitiesOfInteractions);
                    break;
                case VoiceOverTrack.BanalitiesOfInteractions:
                    this._voiceOver!.play(VoiceOverTrack.StaringAtTheFloor);
                    break;
                case VoiceOverTrack.StaringAtTheFloor:
                    this._delayAsync(4000).then(() => {
                        this._voiceOver!.play(VoiceOverTrack.MoveTheMouseUp);
                    });
                    break;
                case VoiceOverTrack.MouseLook:
                    mouseLookFinished = true;
                    break;
                case VoiceOverTrack.PressTheUnboundKey:
                    this._delayAsync(4000).then(() => {
                        this._voiceOver!.play(VoiceOverTrack.ExperienceMenu);
                    });
                    break;
                case VoiceOverTrack.AvoidUsingMenus:
                    this._voiceOver!.play(VoiceOverTrack.KeyBindingsSubmenu);
                    break;
                case VoiceOverTrack.OverlyLiteralInterpretation:
                    this._updateObservable.runCoroutineAsync(this._showAchievementCoroutine("Golf Clap"));
                    break;
            }
        });

        this._voiceOver.onTrackStartedObservable.add((track) => {
            const scene = this;
            switch (track) {
                case VoiceOverTrack.MoveTheMouseUp:
                    this._player!.lookSensitivity = 1 / 400;
                    this._updateObservable.runCoroutineAsync(function *() {
                        while (scene._activeCamera!.getWorldMatrix().m[5] < 0.9) {
                            yield;
                        }

                        yield scene._delayAsync(1000);

                        scene._voiceOver!.play(VoiceOverTrack.MouseLook);
                    }());
                    break;
                case VoiceOverTrack.MouseLook:
                    this._updateObservable.runCoroutineAsync(function *() {
                        while (scene._activeCamera!.getWorldMatrix().m[2] < 0.3) {
                            yield;
                        }

                        while (!mouseLookFinished) {
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.WAsInWalk);
                    }());
                    break;
                case VoiceOverTrack.WAsInWalk:
                    this._player!.moveSpeed = 0.04;
                    this._player!.jumpForce = 30;
                    const startingPosition = this.activeCamera!.globalPosition.clone();
                    this._updateObservable.runCoroutineAsync(function *() {
                        while (Vector3.DistanceSquared(scene._activeCamera!.globalPosition, startingPosition) < 2) {
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.ContainsOtherRooms);
                    }());
                    break;
                case VoiceOverTrack.ContainsOtherRooms:
                    this._updateObservable.runCoroutineAsync(this._showAchievementCoroutine("Get Movin'!"));
                    this._updateObservable.runCoroutineAsync(function *() {
                        while (scene._activeInteractionTriggerName !== "door") {
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.PressTheUnboundKey);
                    }());
                    break;
                case VoiceOverTrack.ExperienceMenu:
                    this._settingsKeyBindingsButton!.isEnabled = true;
                    this._settingsKeyBindingsButton!.isVisible = true;
                    this._pauseVoiceOverWhenGamePauses = false;
                    this.onBeforeRenderObservable.runCoroutineAsync(function *() {
                        while (!scene._paused) {
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.AvoidUsingMenus);
                    }());
                    break;
                case VoiceOverTrack.AvoidUsingMenus:
                    this.onBeforeRenderObservable.runCoroutineAsync(function *() {
                        while (!scene._keyBindingsGrid!.isVisible) {
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.Dvorak);
                    }());
                    
                    this.onBeforeRenderObservable.runCoroutineAsync(function *() {
                        while (scene._keyBindingsInteractButton!.textBlock!.text === "[unbound]") {
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.Apply);
                    }());
                    
                    this._updateObservable.runCoroutineAsync(function *() {
                        while (scene._interactKeyBinding === "[unbound]") {
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.InteractKey);
                    }());
                    break;
                case VoiceOverTrack.InteractKey:
                    this._updateObservable.runCoroutineAsync(function *() {
                        while (scene._doorState !== DoorState.Animating) {
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.TakeOnTheChallenges);
                    }());
                    break;
                case VoiceOverTrack.TakeOnTheChallenges:
                    this._pauseVoiceOverWhenGamePauses = true;
                    this._updateObservable.runCoroutineAsync(this._showAchievementCoroutine("Already Ready"));
                    this._updateObservable.runCoroutineAsync(function *() {
                        let hallwayTriggered = false;
                        scene._hallwayTriggerUnitCube!.onTriggerEntered.addOnce(() => {
                            hallwayTriggered = true;
                        });

                        while (!hallwayTriggered) {
                            scene._hallwayTriggerUnitCube!.triggerOnVector(scene.activeCamera!.globalPosition);
                            yield;
                        }
                        
                        scene._voiceOver!.play(VoiceOverTrack.ThisIsAHallway);
                    }());
                    break;
                case VoiceOverTrack.ThisIsAHallway:
                    let elevatorTriggered = false;
                    this._updateObservable.runCoroutineAsync(function *() {
                        scene._elevatorTriggerUnitCube!.onTriggerEntered.addOnce(() => {
                            elevatorTriggered = true;
                        });

                        while (!elevatorTriggered) {
                            scene._elevatorTriggerUnitCube!.triggerOnVector(scene.activeCamera!.globalPosition);
                            yield;
                        }
                        
                        yield scene._updateObservable.runCoroutineAsync(scene._closeElevatorCoroutine());
                        scene.requestTitleSceneObservable.notifyObservers();
                    }());

                    this._updateObservable.runCoroutineAsync(function *() {
                        let mainRoomTriggered = false;
                        scene._mainRoomTriggerUnitCube!.onTriggerEntered.addOnce(() => {
                            mainRoomTriggered = true;
                        });

                        while (!mainRoomTriggered) {
                            scene._mainRoomTriggerUnitCube!.triggerOnVector(scene.activeCamera!.globalPosition);
                            yield;
                        }
                        
                        if (!elevatorTriggered) {
                            scene._voiceOver!.play(VoiceOverTrack.OverlyLiteralInterpretation);
                        }
                    }());

                    const buttonObserver = scene._triggerInteractionObservable.add((trigger) => {
                        if (trigger === "button") {
                            scene._triggerInteractionObservable.remove(buttonObserver);
                            scene._voiceOver!.play(VoiceOverTrack.Congratulations);
                        }
                    });

                    const doorShapedWallObserver = scene._triggerInteractionObservable.add((trigger) => {
                        if (trigger.startsWith("door_shaped_wall_")) {
                            scene._triggerInteractionObservable.remove(doorShapedWallObserver);
                            if (!elevatorTriggered) {
                                scene._voiceOver!.play(VoiceOverTrack.DoorShapedWall);
                            }
                        }
                    });
                    break;
            }
        });

        // Kick off the sequence.
        await this._delayAsync(10000);
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

        const triggerNames = [
            "door",
            "button",
            "door_shaped_wall_1",
            "door_shaped_wall_2",
            "door_shaped_wall_3",
            "door_shaped_wall_4",
            "door_shaped_wall_5",
            "door_shaped_wall_6",
            "door_shaped_wall_7"
        ];
        triggerNames.forEach((name) => {
            const mesh = scene.getMeshByName(`trigger_unit_cube_${name}`)!;
            const trigger = new UnitCubeTriggerVolume(mesh);
            trigger.onTriggerEntered.add(() => {
                scene._activeInteractionTriggerName = name;
            });
            trigger.onTriggerExited.add(() => {
                if (scene._activeInteractionTriggerName! === name) {
                    scene._activeInteractionTriggerName = undefined;
                }
            });
            scene._interactionTriggerUnitCubes.push(trigger);
        });

        scene._mainRoomTriggerUnitCube = new UnitCubeTriggerVolume(scene.getMeshByName("trigger_unit_cube_main_room")!);
        scene._hallwayTriggerUnitCube = new UnitCubeTriggerVolume(scene.getMeshByName("trigger_unit_cube_hallway")!);
        scene._elevatorTriggerUnitCube = new UnitCubeTriggerVolume(scene.getMeshByName("trigger_unit_cube_elevator")!);

        scene._loadHdrLighting(params);
        scene._spawnPlayer();

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
