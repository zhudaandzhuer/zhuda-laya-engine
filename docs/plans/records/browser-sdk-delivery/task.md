# Agent task: browser-sdk-delivery

Status: Implemented; desktop browser and hosted release verified; mobile unavailable  
Owner: Compiler/browser delivery adapter  
Last reviewed: 2026-11-05

## Source requirement

User requests a Zhuda engine bundle hosted at the existing
`game.qianlongxundao.com` service so agents can author one HTML file and load the
real SDK directly. Existing service capabilities and headers were inspected:
immutable release URLs, CORS `*`, cross-origin resource policy; sandboxed hosted
pages allow only their own release's resources.

## Goal

Provide deterministic 2D and 3D browser bundles, a versioned public SDK release,
and a single-HTML example verified against the hosted bundle in real WebGL.

## Invariants

- Bundle actual ordered vendor libraries and the public SDK. No replacement
  renderer, fake facade, game content or platform upload credentials.
- Reuse the responsive official splash. One bundle per page; duplicate/foreign
  runtimes fail before overwriting a running engine.
- Pin immutable release URL and integrity hash, record exact source inputs.
- Keep existing ESM/CJS/consumer build gates. A browser script load does not
  replace Prefab evidence, game tests, strict source types or device acceptance.
- Keep hosting CSP/isolation unchanged. Hosted games package the same SDK in
  their own release when cross-release loading is forbidden.

## Dependencies and scope

Engine: existing topology, public runtime, branding, browser packaging CLI,
neutral HTML fixtures, build tests, documentation, SDK distribution files.
The independent 2D fixture exposed inspectSceneResources using instanceof Mesh
when the optional 3D module was absent; fix that shared diagnostic and add a
minimal failing regression.
Hosting adapter: existing qianlong publishing API, new dedicated SDK ID; no
server administration, credentials in output, paid service or CSP changes.

## Non-goals

General HTML bundling of arbitrary game assets, arbitrary plugin/physics/WASM
module delivery, permissive CSP, new engine gameplay APIs, mobile certification.

## Acceptance checks

1. Deterministic bundles/manifest; topology and hashes reflect source. Invalid
   profile and duplicate load fail clearly. SDK symbol set matches public exports.
2. npm run verify, git diff --check, clean commit; browser global declarations
   refer to existing public types, never Laya:any.
3. Real WebGL 2D/3D draw, boot, responsive canvas and official splash, resource
   disposal; isolated deterministic neutral Prefab and composed scene use same data.
4. Publish dedicated immutable release, match ZIP SHA, inspect JS MIME/CORS/cache
   headers, external-origin HTML with SRI draws and wrong SRI fails.
5. Verify own-release hosted demo. Record unsupported sandbox/CDN restrictions
   explicitly, with no physical-device claim.

## Evidence and rollback

External artifact/evidence root: /Users/yaowei/Desktop/zhuda-browser-sdk-acceptance-20261105.
Last good engine commit: ce9dfccf45d7ef07956f7350370d3af997ac0014.
Keep existing game releases unchanged; use immutable SDK URLs, never /latest.

Verification: [verification.md](verification.md).
