import { Engine } from "@babylonjs/core/Engines/engine";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Tools } from "@babylonjs/core/Misc/tools";
import { AdvancedDynamicTexture, Button } from "@babylonjs/gui";
import { RenderTargetScene } from "./renderTargetScene";

export class TitleScene extends RenderTargetScene {
    public requestLevel1SceneObservable: Observable<void>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestLevel1SceneObservable = new Observable<void>();

        MeshBuilder.CreateSphere("sphere", { diameter: 1 }, this);
        this.createDefaultCameraOrLight(true, true, true);

        const guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("guiTexture");

        const button = Button.CreateSimpleButton("loadLevel1Button", "Load Level 1");
        button.onPointerClickObservable.add(() => {
            this.requestLevel1SceneObservable.notifyObservers();
        });
        button.widthInPixels = 200;
        button.heightInPixels = 60;
        button.verticalAlignment = Button.VERTICAL_ALIGNMENT_TOP;
        button.horizontalAlignment = Button.HORIZONTAL_ALIGNMENT_LEFT;
        button.background = "gray";

        guiTexture.addControl(button);
    }

    public static async CreateAsync(engine: Engine): Promise<TitleScene> {
        const scene = new TitleScene(engine);
        return scene;
    }
}
