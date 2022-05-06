import { Engine } from "@babylonjs/core/Engines/engine";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { Scene } from "@babylonjs/core/scene";

export class RenderTargetScene extends Scene {
    public renderTarget?: RenderTargetTexture;

    public constructor(engine: Engine) {
        super(engine);

        const createRenderTarget = () => {
            this.renderTarget?.dispose();

            if (this.activeCamera) {
                this.renderTarget = new RenderTargetTexture("gameSceneRenderTarget", { 
                    width: this.getEngine().getRenderWidth(), 
                    height: this.getEngine().getRenderHeight()
                }, this, false, true);
                this.renderTarget.samples = 4;
                this.activeCamera!.outputRenderTarget = this.renderTarget;
            }
        };
        
        this.onActiveCameraChanged.add(createRenderTarget);

        const resizeObserver = engine.onResizeObservable.add(createRenderTarget);
        this.onDisposeObservable.add(() => {
            engine.onResizeObservable.remove(resizeObserver);
        });
    }
}
