# Windows WebGPU host

This example packages an already-built Zhuda consumer in Electron. It does not
replace the consumer compiler or add a second renderer. The host serves the
consumer's `dist/web` through a bounded secure `app://bundle` origin so relative
JavaScript, WebAssembly, provider assets and `fetch()` keep working in a packaged
application.

On a Windows GPU machine:

```powershell
cd examples/windows-webgpu
npm ci
$env:ZHUDA_WEB_ROOT = "C:\path\to\consumer\dist\web"
$env:ZHUDA_ENTRY = "index.html"
$env:ZHUDA_WINDOWS_WEBGPU_OUT = "$PWD\evidence"
npm run verify
npm run package # prepackage stages ZHUDA_WEB_ROOT into the app's web/ directory
# Install the generated Squirrel app, then run the installed executable:
& "C:\path\to\installed\zhuda-windows-webgpu-host.exe" --verify
```

`npm run verify` tests the development host. The installed executable resolves
its bundled `web/` directory independently of the source checkout or environment
variable. Its report must contain `packaged:true` for packaged acceptance.
`desktop-bundle.json` records staged file hashes. Staging rejects symlinks and
preserves the previous staged bundle when validation fails. Capture and retain
both development and installed-app reports in separate output directories.
Without an output override, installed apps write evidence under Electron's
user-data directory; development writes to `windows-webgpu-evidence/` in the
working directory. Use Node 24 LTS for the Forge build (validated on macOS);
the runtime remains the pinned Electron version.

`verify` fails unless the page reports `selected: "webgpu"`,
`nativeEngine: "WebGPURenderEngine"`, a ready state, no validation errors and no
software/fallback adapter. It records `report.json` with Windows, Electron,
Chromium, GPU feature status, complete Chromium GPU information, renderer data
and console messages. Run the consumer's own `npm run verify:webgpu` as well;
this host check proves the packaged entry and the consumer report, not every
game scene or Windows driver.

The first acceptance target is an unsigned local Squirrel package. Installer
signing, auto-update, WebView2 parity, Steam and native Laya runtime packaging
remain separate work. Do not add `--disable-gpu` or silently fall back to WebGL.
