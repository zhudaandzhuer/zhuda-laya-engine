# Agent task: phone-checks

Status: Run on one phone; three checks fail there and are recorded as failing\
Owner: Engine/toolchain\
Last reviewed: 2026-11-15

## Source requirement

The owner's instruction of 2026-11-15, once the vivo V40 was reachable
again: run on it what had not been run there. `records/threejs-gap-audit/progress.md`
listed as owed: WP12 (which backend the phone's Chrome is given, whether
WebGPU starts, how long its compilers take), WP16 (compute, the surface
pictures), and the follow-ups of that day (the lit surface's hook and what it
is given to read, dither on a plain camera, Meshopt in workers). WP2, WP4,
WP7, WP10 and WP15 had no phone result either.

## Goal

Each of those packages has a result from the phone, given by the
repository's own draw check, on WebGL and on WebGPU, that another agent can
get again with one command.

## Invariants

- A check is run as it is. Its verdict on the phone is the phone's: a check
  that fails there is recorded as failing there, with the number, and no
  tolerance is widened for it.
- Nothing on the phone is changed. Only a blank tab, or one already at a
  page of this machine's loopback, is used; the phone's other tabs are not
  read.
- With the switch unset every check runs as before, on this machine.

## Dependencies

- `packages/compiler/chrome-host.mjs` (the interface the checks use), `adb`,
  Chrome's remote debugging port on Android.
- The checks: `verify-cloth`, `verify-lit-surface`, `verify-dither`,
  `verify-gltf-instancing`, `verify-gpu-depth`, `verify-physical-surfaces`,
  `verify-gltf-intake`, `verify-animation-control`,
  `verify-developer-tooling`, `verify-specular-aa`; the pages
  `verify-backend-delivery` builds.

## Scope

### Engine

- `scripts/lib/phone-chrome.mjs` (new): the checks' browser as a tab of a
  phone's Chrome (`pickPhoneTab`, `phoneReversePort`, `isAdapterNotice`,
  `phoneChromeFixture`).
- `scripts/lib/chrome-fixture.mjs`: with `ZHUDA_PHONE_CHROME` set, the
  phone's; otherwise the headless Chrome as before.
- `tests/phone-chrome.test.mjs`, `docs/agent-development.md` ("A draw check
  on a phone").
- Records and guides that said "no phone".

### Consumer or adapter

- None.

## Non-goals

- Mending what the phone shows. The three failures are findings, listed in
  the verification record with what is known of their cause.
- The older packages' checks (films, looks, effects), which had phone
  results of their own kind when they were built, and WebGPU on the phone for
  them.
- Any other phone, iOS, or another browser.

## Acceptance checks

1. `node --test tests/phone-chrome.test.mjs`: which tab may be used (never
   one that is not blank or this machine's), which addresses the phone is
   given a way back to, what is an adapter's notice, and that the fixture
   refuses, in words, when no tab is its own.
2. Each of the ten checks with `ZHUDA_PHONE_CHROME` set, on WebGL and with
   its renderer switch on WebGPU: the GPU it names is the phone's, and its
   result is recorded as it came.
3. The backend delivery pages opened in the phone's Chrome: which backend
   the loader takes and why, the time to ready, the compilers' time from the
   bundle, from the network and from the cache.
4. `npm run verify`, `npm run lint`, `npm run format:check`,
   `git diff --check`: the checks on this machine are as they were.

## Evidence to attach

- `records/phone-checks/verification.md`; reports, pictures and logs outside
  the repository.

## Unverified limits

- One phone, one run of each check on each backend (the WebGPU ones twice).
- The backend delivery check itself was not run on the phone (it starts a
  browser of its own for each case and makes the browser lie about its
  adapter); its pages were opened by a script that is not in the repository.
- Why screen reflections differ on the phone is not found.

## Rollback

`78b0dee` is the last commit before this work. The switch is one line in
`scripts/lib/chrome-fixture.mjs`; with it reverted the checks cannot be
pointed at a phone and nothing else changes.
