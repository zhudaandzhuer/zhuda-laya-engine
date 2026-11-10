export type PreviewResourcePolicy = 'release' | 'retain';

/** The safe default releases large hidden Scene/3D preview trees. */
export function resolvePreviewResourcePolicy(search: string): PreviewResourcePolicy {
  return new URLSearchParams(search).get('resources') === 'retain' ? 'retain' : 'release';
}

export function shouldReleaseHiddenPreview(
  policy: PreviewResourcePolicy,
  activeMode: 'prefab' | 'scene' | 'model',
  nextMode: 'prefab' | 'scene' | 'model',
): boolean {
  return (
    policy === 'release' &&
    activeMode !== nextMode &&
    (activeMode === 'scene' || activeMode === 'model')
  );
}
