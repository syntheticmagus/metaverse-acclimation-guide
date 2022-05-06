import { ThinEngine } from "@babylonjs/core/Engines/thinEngine";
import { EffectRenderer, EffectWrapper } from "@babylonjs/core/Materials/effectRenderer";
import { ThinTexture } from "@babylonjs/core/Materials/Textures/thinTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";

const FADE_TO_COLOR_EFFECT_FRAGMENT_SOURCE = `
precision highp float;

varying vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D blurSampler;
uniform vec4 color;
uniform float colorStrength;
uniform float blurStrength;

void main(void) {
    vec4 pixel = (1. - blurStrength) * texture2D(textureSampler, vUV) + blurStrength * texture2D(blurSampler, vUV);
    gl_FragColor = colorStrength * color + (1. - colorStrength) * pixel;
}
`;

interface FadeToColorEffectOptions {
    engine: ThinEngine;
    effectRenderer: EffectRenderer;
}

export class FadeToColorEffect {
    private _engine: ThinEngine;
    private _effectRenderer: EffectRenderer;
    private _fadeToColorEffectWrapper: EffectWrapper;

    constructor (options: FadeToColorEffectOptions) {
        this._engine = options.engine;
        this._effectRenderer = options.effectRenderer

        this._fadeToColorEffectWrapper = new EffectWrapper({
            engine: this._engine,
            name: "fadeToColorEffectWrapper",
            fragmentShader: FADE_TO_COLOR_EFFECT_FRAGMENT_SOURCE,
            uniformNames: ["color", "colorStrength", "blurStrength"],
            samplerNames: ["textureSampler", "blurSampler"]
        });
    }

    public render(inputTexture: ThinTexture, blurTexture: ThinTexture, color: Color3, colorStrength: number, blurStrength: number): void {
        this._effectRenderer.applyEffectWrapper(this._fadeToColorEffectWrapper);
        this._fadeToColorEffectWrapper.effect.setTexture("textureSampler", inputTexture);
        this._fadeToColorEffectWrapper.effect.setTexture("blurSampler", blurTexture);
        this._fadeToColorEffectWrapper.effect.setColor4("color", color, 1);
        this._fadeToColorEffectWrapper.effect.setFloat("colorStrength", colorStrength);
        this._fadeToColorEffectWrapper.effect.setFloat("blurStrength", blurStrength);
        this._effectRenderer.draw();
        this._effectRenderer.restoreStates();
    }
}
