# Runtime declaration repairs

The declarations retain LayaAir 3.4.2's runtime API. This is not a renderer upgrade.
Source: [official tag v3.4.2](https://github.com/layabox/LayaAir/tree/af6a0446e2e963e239a4abc2e4b2dc48d3c31e2a/src/layaAir),
commit `af6a0446e2e963e239a4abc2e4b2dc48d3c31e2a`.

- Restored dependencies omitted by upstream `stripInternal`; the per-symbol
  source list is in `restored-3.4.2.json`. These are declarations of existing
  implementation, not new public runtime helper exports.
- Restored omitted members on AnimatorState2D, GraphicsRunner, Light2DManager,
  BaseNavigationManager, pxCollider/pxJoint/pxRevoluteJoint, LayaX render types,
  scene render managers and Spine optimized renderers from the same source.
- Removed identical duplicated graphics payload enums/constants/types and the
  duplicated ERenderProxyType enum. Backend-local OneDrawPassCacheInfo types now
  have WebGL/WebGPU prefixes so their distinct fields cannot accidentally merge.
- Flattened source-local import types to their existing ambient Laya names.
- Kept nullable runtime values nullable: bridge scene, command executor sprite,
  a Spine TrackEntry's animation, and Sprite.scrollRect (clearing a clip). Specialized terrain lookup tuple arguments
  preserve the numeric rule key and optional boolean create flag.
- Added official WebGPU and i18next declaration dependencies. `wechat-media.d.ts`
  contains the 54 transitively required media declarations extracted from
  Tencent's MIT-licensed `minigame-api-typings` 3.8.21, with its license retained.
  Host globals such as console/wx/require are not imported into DOM consumers.

Run `npm run audit:declarations` for the full `strict:true`,
`skipLibCheck:false`, `types:[]` audit. Tests also compile independent consumers
with full declaration checking. Existing upstream dynamic types remain upstream
contracts; no blanket suppression or placeholder declaration was added to make
this audit pass. Type correctness does not establish every optional backend's
physical-device support.
