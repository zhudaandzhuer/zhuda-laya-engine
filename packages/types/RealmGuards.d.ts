// Generated from TypeScript source; run npm run types:generate.
/**
 * Realm ownership checks for the LayaAir global runtime.
 *
 * LayaAir 3.4.2 keeps its stage, renderer and several prototype patches in a
 * JavaScript realm singleton.  A Zhuda session may share that realm with a
 * later Zhuda session after dispose, but it must never silently attach to a
 * Laya application that was initialized by somebody else.
 */
export declare const ZHUDA_LAYA_REALM_MARKER = "__ZHUDA_LAYA_REALM_OWNER__";
export interface LayaRealmReport {
    layaPresent: boolean;
    initialized: boolean;
    owner: 'none' | 'uninitialized' | 'zhuda' | 'foreign';
    reason: string;
}
/** Inspect only the observable Laya initialization state; this is side-effect free. */
export declare function inspectLayaRealm(value?: typeof globalThis): LayaRealmReport;
/** Mark a successfully created Zhuda realm without replacing any Laya global. */
export declare function markZhudaLayaRealm(value?: typeof globalThis): void;
/**
 * Fail closed before Laya.init when a foreign app already owns this realm.
 * The error names the supported isolation path so an agent can recover without
 * guessing or attempting to copy a second renderer into the page.
 */
export declare function assertZhudaRealmAvailable(value?: typeof globalThis): LayaRealmReport;
