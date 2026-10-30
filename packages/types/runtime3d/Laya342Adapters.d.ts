/** Laya 3.4.2 allocates two process-owned fallback textures but releases only depth.
 * Keep this version-specific repair isolated from consumer scene code. */
export declare function installLaya342LifecycleFix(runtime?: any): void;
