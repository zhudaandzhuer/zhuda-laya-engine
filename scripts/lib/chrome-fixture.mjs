// The launcher ships in the package for the film host; tests keep this path.
// With ZHUDA_PHONE_CHROME set, a check's browser is a tab of the Chrome on a
// phone instead of a headless Chrome on this machine (phone-chrome.mjs,
// docs/agent-development.md): the checks themselves are not changed.
import { chromeFixture as headlessChrome } from '../../packages/compiler/chrome-host.mjs';
import { phoneChromeFixture } from './phone-chrome.mjs';

export const chromeFixture = (options) =>
  process.env.ZHUDA_PHONE_CHROME ? phoneChromeFixture() : headlessChrome(options);
