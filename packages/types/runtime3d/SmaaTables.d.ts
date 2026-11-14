// Generated from TypeScript source; run npm run types:generate.
/** Edge of the area table in texels: red and green, one byte each, row by row. */
export declare const ZHUDA_SMAA_AREA_SIZE = 80;
/** Width and height of the search table: one byte a texel, row by row. */
export declare const ZHUDA_SMAA_SEARCH_SIZE: readonly [number, number];
/** SHA-256 of the decoded bytes, in hex. */
export declare const ZHUDA_SMAA_AREA_SHA256 = "d6f73232a28d1261aa22173b223ccfca28c1eef17d470346aec26b1d4af20031";
export declare const ZHUDA_SMAA_SEARCH_SHA256 = "e5d85ae5a659337e6d6654b85d2741a0b08a2c7d2eda200151fb0b3bd41e6966";
/** The area table: `ZHUDA_SMAA_AREA_SIZE` squared texels of two bytes. */
export declare function zhudaSmaaAreaTable(): Uint8Array;
/** The search table: `ZHUDA_SMAA_SEARCH_SIZE` texels of one byte. */
export declare function zhudaSmaaSearchTable(): Uint8Array;
