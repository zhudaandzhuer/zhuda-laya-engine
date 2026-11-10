# Consumer boot branding follow-up

Source: the user's mandatory responsive 豬大 × LayaAir boot-logo requirement;
independent RPG integration found that only the engine showcase generated it.
Scope: shared compiler markup/CSS, consumer HTML injection, reserved-ID guard.
No gameplay or consumer artwork is added to the engine.

Invariants: identical official source image, one splash, ordered libraries,
standalone delivery and asset allowlists. The branding script is a boot-page
presentation timer; it never advances the runtime's gameplay clock.

Acceptance: compiler regression with neutral HTML, duplicate-ID failure,
full verify, independent consumer rebuild; desktop wide/portrait/landscape
screenshots. Physical mobile remains unavailable.

Validation: `npm run verify` passed 145/145 on Node 26.12.0 / macOS arm64.
Log: `/tmp/zhuda-branding-verify.log`. Shared markup preserves the already tested
showcase behavior; the new test rejects duplicate IDs and verifies embedded
image bytes, responsive constraints and placement before runtime scripts.
The independent neutral consumer and RPG provide the real browser check; their
media remains outside this engine repository.

Independent package check: neutral consumer `npm run verify` PASS with packed
1.4.1, tarball SHA-256
`66e0e6f56bd360ad15792844b98ba1708322af946c8dd78bac16478adfb54878`.
Evidence directory: `<external-evidence>/zhuda-runtime-acceptance-20261105`;
log `branding-verify.log`, images `evidence/consumer-brand-{desktop,portrait,landscape}.png`.
Measured browser viewport/DPR: 1280×720/2, 390×844/1, 844×390/1.
During the animation, portrait image bounds were x≈24–367, y≈341–449;
landscape bounds x≈53–791, y≈111–243. Both stayed inside the measured viewport.
The CSS object-fit contains the SVG when a short landscape view constrains height.
The overlay releases input after playback. These are desktop resize results,
not physical-device acceptance. Status: desktop checks passed; mobile unavailable.
