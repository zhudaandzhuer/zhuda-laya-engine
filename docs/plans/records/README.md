# Verification record retention

The files in this directory are the durable source of truth for engine
verification. They retain the command, revision, environment, result and
limits needed to understand an accepted capability.

Raw browser screenshots, device media, copied SDK bundles, ZIPs, installed
`node_modules` and consumer game assets stay outside this repository. The
temporary Desktop evidence roots used while running the checks were retired on
2026-11-06 after their normalized results had been recorded in the linked
verification documents. Paths to those roots in older records are historical
run locations; they are not required inputs for the current engine checkout.

Use the record's command and current pinned release to reproduce a check. If a
raw artifact is required for a new acceptance run, create a new external
evidence directory and update the record with its revision, environment and
retention decision. Do not add game assets or device media to this repository.
