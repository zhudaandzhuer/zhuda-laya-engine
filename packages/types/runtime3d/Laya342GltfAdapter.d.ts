// Generated from TypeScript source; run npm run types:generate.
/** Version-pinned importer repairs. Applied to one owned glTFResource, never to
 * global prototypes. The native Animator remains the sole pose evaluator. */
export declare function prepareLaya342GltfResource(resource: any, runtime: any): void;
/** Native MeshRenderer cloning does not consistently preserve authored weights.
 * Copy values through the public setter to retain independent dirty tracking. */
export declare function copyLaya342MorphWeights(source: any, target: any, runtime: any): void;
/** Native create() retains its partial trees on failure. Retire their components
 * before the caller releases the parsed resource and its shared dependencies. */
export declare function createLaya342ModelTemplate(resource: any, runtime: any): Laya.Sprite3D;
