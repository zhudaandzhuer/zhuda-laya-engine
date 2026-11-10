// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaBootContext } from '../DeclarativeSDK';
/** Platform branding runs on the existing session clock before consumer startup. */
export declare function showMiniGameSplash(context: ZhudaBootContext, signal?: AbortSignal, timeoutMs?: number): Promise<void>;
