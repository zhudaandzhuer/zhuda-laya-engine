#!/bin/sh
# A1: the pinned toolchain, every step, each with its own log and exit code.
# Run from the repository root: sh local-results/A1/run.sh   (OUT=<dir> for another place)
out=${OUT:-local-results/A1}
: > "$out/exit-codes.log"
step() {
  name=$1; shift
  echo "== $name: $*" | tee -a "$out/exit-codes.log"
  start=$(date +%s)
  "$@" > "$out/$name.log" 2>&1
  code=$?
  echo "   exit $code, $(( $(date +%s) - start )) s" | tee -a "$out/exit-codes.log"
  return $code
}
step 1-npm-ci npm ci || { echo "npm ci failed; the rest was not run" | tee -a "$out/exit-codes.log"; exit 1; }
step 2-verify npm run verify
step 3-lint npm run lint
step 4-format-check npm run format:check
step 5-verify-games npm run verify:games
echo "done" | tee -a "$out/exit-codes.log"
