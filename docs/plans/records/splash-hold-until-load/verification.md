# Verification: the start splash waits for the page

Base commit `e835b26` plus uncommitted changes. macOS, headless Chrome, 2026-11-15.

| Command                                                                                                                    | Result                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`                                                                                                           | pass, 833 tests (before the check-script edit below; the splash change itself included)                                                                                                          |
| `node --test tests/engine-splash.test.mjs`                                                                                 | pass, 4: holds past the intro until load with `is-waiting`; a page that loads during the intro still shows the whole intro; `none` completes at once                                             |
| `node packages/compiler/browser-sdk.mjs --out <dir>` then `SDK_BROWSER_DIR=<dir> node scripts/verify-branding-browser.mjs` | PASS 18 brand/profile/viewport scenarios; each page's load is held 8 s by a slow `/__hold.png`, and the check asserts `is-waiting` with `completed: false`, then `completed` with `loaded: true` |
| `npm run lint`, `git diff --check`                                                                                         | pass                                                                                                                                                                                             |

`scripts/verify-branding-browser.mjs` was already failing on `e835b26`: it
waited for an image animation of 1100 ms, but the tribute mark's animation is
680 ms, so the condition never held. It now waits for the intro animations to
finish, whatever their length.

## Not verified

- Real phones. The consumer that reported the gap (a game outside this
  repository) has not yet been rebuilt with this change.
- WeChat's in-app browser; minigame hosts.
