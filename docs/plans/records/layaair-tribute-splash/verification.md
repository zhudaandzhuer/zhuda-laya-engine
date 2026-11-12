# Verification: LayaAir tribute splash

Base commit `404e8bc` plus uncommitted changes. macOS, headless Chrome, 2026-11-12.

| Command                                                                                                                          | Result                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run verify`                                                                                                                 | pass, 423 tests (the engine's own page and the consumer branding tests read the new file)             |
| `node packages/compiler/browser-sdk.mjs --out <fresh dir>` then `SDK_BROWSER_DIR=<dir> node scripts/verify-branding-browser.mjs` | pass, 18 brand/profile/viewport scenarios; the engine mode's image alt is "Powered by LayaAir Engine" |
| Consumer game (outside this repository), default branding, 390×844 at 2x and 1280×720                                            | the mark, the words and the bar are drawn centred; `__ZHUDA_SPLASH__.mode` is `engine`                |

`npm run verify:branding` against `dist/browser/1.17.0` fails by design: that
folder is the released 1.17.0 and is not rebuilt in place.

## Not verified

- Real phones; WeChat's in-app browser; minigame hosts.
- The mark against an official source file (none was available).
