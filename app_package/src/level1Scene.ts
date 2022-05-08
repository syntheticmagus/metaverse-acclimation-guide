import { Engine } from "@babylonjs/core/Engines/engine";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Tools } from "@babylonjs/core/Misc/tools";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { RenderTargetScene } from "./renderTargetScene";

export class Level1Scene extends RenderTargetScene {
    public requestTitleSceneObservable: Observable<void>;
    public requestLevel1SceneObservable: Observable<void>;

    private constructor(engine: Engine) {
        super(engine);

        this.requestTitleSceneObservable = new Observable<void>();
        this.requestLevel1SceneObservable = new Observable<void>();

        MeshBuilder.CreateBox("box", { size: 1 }, this);
        this.createDefaultCameraOrLight(true, true, true);

        const guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("guiTexture");

        const titleButton = Button.CreateSimpleButton("loadTitleButton", "Load Title Screen");
        titleButton.onPointerClickObservable.add(() => {
            this.requestTitleSceneObservable.notifyObservers();
        });
        titleButton.widthInPixels = 200;
        titleButton.heightInPixels = 60;
        titleButton.verticalAlignment = Button.VERTICAL_ALIGNMENT_TOP;
        titleButton.horizontalAlignment = Button.HORIZONTAL_ALIGNMENT_LEFT;
        titleButton.background = "gray";

        const level1Button = Button.CreateSimpleButton("loadLevel1Button", "Reload Level 1");
        level1Button.onPointerClickObservable.add(() => {
            this.requestLevel1SceneObservable.notifyObservers();
        });
        level1Button.widthInPixels = 200;
        level1Button.heightInPixels = 60;
        level1Button.verticalAlignment = Button.VERTICAL_ALIGNMENT_BOTTOM;
        level1Button.horizontalAlignment = Button.HORIZONTAL_ALIGNMENT_LEFT;
        level1Button.background = "gray";

        guiTexture.addControl(titleButton);
        guiTexture.addControl(level1Button);
    }

    public static async CreateAsync(engine: Engine): Promise<Level1Scene> {
        const scene = new Level1Scene(engine);
        return scene;
    }
}