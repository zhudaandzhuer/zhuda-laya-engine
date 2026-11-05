/** Consumer build uses project-relative logo files. Browser preconfiguration
 * accepts relative/HTTPS/base64 image sources. Default is the engine brand. */
export type ZhudaBrandingConfig =
  | {readonly mode?: 'engine'}
  | {readonly mode: 'none'}
  | {readonly mode: 'custom'; readonly brandId: string; readonly logo: string; readonly title?: string; readonly caption?: string};
