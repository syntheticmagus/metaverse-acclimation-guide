import { ThinEngine, ISize, ThinTexture, EffectRenderer, EffectWrapper } from "@babylonjs/core";
import { RenderTargetWrapper } from "@babylonjs/core/Engines/renderTargetWrapper";

const BLUR_EFFECT_FRAGMENT_SOURCE = `
precision highp float;

varying vec2 vUV;

uniform sampler2D inputSampler;
uniform vec3[NUM_SAMPLES] kernelSamples;

void main(void) {
    vec4 color = vec4(0., 0., 0., 0.);
    for (int idx = 0; idx < NUM_SAMPLES; ++idx) {
        vec3 currentSample = kernelSamples[idx];
        color += (currentSample.z * texture2D(inputSampler, vUV + currentSample.xy));
    }
    gl_FragColor = color;
}
`;

interface BlurEffectOptions {
    engine: ThinEngine;
    effectRenderer: EffectRenderer;
}

function erf(x: number, stddev: number = 1, mean: number = 0): number {
    return 1 / (stddev * Math.sqrt(2 * Math.PI * Math.exp(Math.pow((x - mean) / stddev, 2))));
}

export class BlurEffect {
    private static KERNEL_SIZE = 15;
    private static KERNEL_RADIUS = 0.02;

    private _engine: ThinEngine;
    private _effectRenderer: EffectRenderer;
    private _blurEffectWrapper: EffectWrapper;
    private _size: ISize;
    private _innerRenderTargetWrapper?: RenderTargetWrapper;
    private _innerTexture?: ThinTexture;
    private _outputRenderTargetWrapper?: RenderTargetWrapper;
    private _outputTexture?: ThinTexture;
    private _horizontalKernel: Array<number>;
    private _verticalKernel: Array<number>;

    constructor (options: BlurEffectOptions) {
        this._engine = options.engine;
        this._effectRenderer = options.effectRenderer
        this._size = { width: -1, height: -1 };

        this._blurEffectWrapper = new EffectWrapper({
            engine: this._engine,
            name: "blurEffectWrapper",
            fragmentShader: BLUR_EFFECT_FRAGMENT_SOURCE,
            defines: [
                `#define NUM_SAMPLES ${BlurEffect.KERNEL_SIZE}`
            ],
            samplerNames: ["inputSampler"],
            uniformNames: ["kernelSamples"]
        });

        this._horizontalKernel = [];
        this._verticalKernel = [];
    }

    private _reinitializeTextures() {
        const RTT_OPTIONS = {
            generateDepthBuffer: false,
            generateStencilBuffer: false,
            generateMipMaps: false,
            samplingMode: 1
        };

        if (this._innerRenderTargetWrapper) {
            this._innerRenderTargetWrapper.dispose();
            this._innerTexture!.dispose();
        }
        this._innerRenderTargetWrapper = this._engine.createRenderTargetTexture(
            this._size,
            RTT_OPTIONS
        );
        this._innerTexture = new ThinTexture(this._innerRenderTargetWrapper.texture);
        this._innerTexture.wrapU = 0;
        this._innerTexture.wrapV = 0;

        if (this._outputRenderTargetWrapper) {
            this._outputRenderTargetWrapper.dispose();
            this._outputTexture!.dispose();
        }
        this._outputRenderTargetWrapper = this._engine.createRenderTargetTexture(
            this._size,
            RTT_OPTIONS
        );
        this._outputTexture = new ThinTexture(this._outputRenderTargetWrapper.texture);
        this._outputTexture.wrapU = 0;
        this._outputTexture.wrapV = 0;
        
        const halfKernel = Math.floor(BlurEffect.KERNEL_SIZE / 2);

        // Compute Gaussian kernel weights.
        // Normalize weights to deal with the fact that we're not a continuum.
        const weights = [];
        let totalWeight = 0;
        for (let idx = 0; idx < BlurEffect.KERNEL_SIZE; ++idx) {
            const weight = erf(2 * (idx - halfKernel) / halfKernel);
            totalWeight += weight;
            weights.push(weight);
        }

        this._horizontalKernel = [];
        this._verticalKernel = [];
        for (let idx = 0; idx < BlurEffect.KERNEL_SIZE; ++idx) {
            const offset =  idx * BlurEffect.KERNEL_RADIUS / halfKernel - BlurEffect.KERNEL_RADIUS;

            this._horizontalKernel.push(offset * this._engine.getRenderHeight() / this._engine.getRenderWidth());
            this._horizontalKernel.push(0);
            this._horizontalKernel.push(weights[idx] / totalWeight);
            
            this._verticalKernel.push(0);
            this._verticalKernel.push(offset);
            this._verticalKernel.push(weights[idx] / totalWeight);
        }
    }

    public render(inputTexture: ThinTexture): ThinTexture {
        const inputSize = inputTexture.getSize();
        if (inputSize.width !== this._size.width || inputSize.height !== this._size.height) {
            this._size = inputSize;
            this._reinitializeTextures();
        }

        this._engine.bindFramebuffer(this._innerRenderTargetWrapper!);
        this._effectRenderer.applyEffectWrapper(this._blurEffectWrapper);
        this._blurEffectWrapper.effect.setTexture("inputSampler", inputTexture);
        this._blurEffectWrapper.effect.setFloatArray3("kernelSamples", this._horizontalKernel);
        this._effectRenderer.draw();

        this._engine.bindFramebuffer(this._outputRenderTargetWrapper!);
        this._effectRenderer.applyEffectWrapper(this._blurEffectWrapper);
        this._blurEffectWrapper.effect.setTexture("inputSampler", this._innerTexture!);
        this._blurEffectWrapper.effect.setFloatArray3("kernelSamples", this._verticalKernel);
        this._effectRenderer.draw();

        this._engine.unBindFramebuffer(this._outputRenderTargetWrapper!);

        return this._outputTexture!;
    }
}
