// Generated from TypeScript source; run npm run types:generate.
/** What each built-in sprite is for. */
export declare const ZHUDA_EFFECT_SPRITES: Readonly<{
    readonly soft: "A soft round glow that fades to nothing at its edge: light, magic, embers, fireflies.";
    readonly disc: "A round dot with a firm edge: bubbles of colour, confetti, debris seen small.";
    readonly ring: "A thin ring: a shock wave, a ripple, a halo.";
    readonly spark: "A four-pointed star with a bright core: sparks, glints, stars.";
    readonly streak: "A thin line that fades at both ends, lying along the picture: rain, speed lines, sparks in flight.";
    readonly smoke: "An uneven soft puff: smoke, dust, steam, mist, cloud.";
    readonly flame: "A teardrop, round below and pointed above: a tongue of fire.";
    readonly flake: "A six-armed snow crystal.";
    readonly leaf: "A leaf with a midrib.";
    readonly petal: "A rounded petal.";
    readonly bubble: "A clear ball: a bright rim and a highlight.";
}>;
export type ZhudaEffectSpriteId = keyof typeof ZHUDA_EFFECT_SPRITES;
/** Sizes a sprite may be baked at. */
export declare const ZHUDA_EFFECT_SPRITE_SIZES: readonly [32, 64, 128, 256];
/**
 * One sprite as straight RGBA: white, with the shape in alpha (four samples a
 * pixel, so edges are smooth at any size).
 */
export declare function bakeZhudaEffectSprite(id: ZhudaEffectSpriteId, size?: number): Uint8Array;
