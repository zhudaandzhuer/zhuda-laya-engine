// systems/minigame-host/package-assets: an AssetProvider for both hosts.
// From the workspace game zhuda-raft-survival (`src/assets.ts`, 2026-11-19); the constructor is
// written without a parameter property so that Node can run the file as it is.
//
// Asset transport for both hosts. WeChat mini game: files inside the package, read through the
// platform file system (no fetch, no URLs). Browser: fetch relative to the page. The engine's
// DirectoryAssetProvider is browser-only (the mini-game build rejects it), so the game owns this.
import type { AssetLoadOptions, AssetProvider, LoadedAssetBytes } from 'zhuda-laya-engine';

type Wx = { getFileSystemManager?: () => { readFile: (o: Record<string, unknown>) => void } };
const wx = (globalThis as { wx?: Wx }).wx;

export class PlatformAssetProvider implements AssetProvider {
  readonly name = 'platform-package';
  private readonly base: string;
  constructor(base = 'assets/') {
    this.base = base;
  }

  async load(id: string, options?: AssetLoadOptions): Promise<LoadedAssetBytes> {
    const path = this.base + id;
    options?.onProgress?.({ id, phase: 'downloading' });
    let bytes: Uint8Array;
    if (wx?.getFileSystemManager) {
      bytes = await new Promise<Uint8Array>((resolve, reject) =>
        wx.getFileSystemManager!().readFile({
          filePath: path,
          success: (res: { data: ArrayBuffer }) => resolve(new Uint8Array(res.data)),
          fail: (err: { errMsg?: string }) => reject(Error(`readFile ${path}: ${err?.errMsg ?? 'failed'}`)),
        }),
      );
    } else {
      const res = await (globalThis as { fetch: typeof fetch }).fetch(path, { signal: options?.signal });
      if (!res.ok) throw Error(`fetch ${path}: ${res.status}`);
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    if (options?.maxBytes && bytes.byteLength > options.maxBytes) throw Error(`${id} is larger than ${options.maxBytes} bytes`);
    options?.onProgress?.({ id, phase: 'ready', loadedBytes: bytes.byteLength, totalBytes: bytes.byteLength });
    return { id, bytes };
  }
}
