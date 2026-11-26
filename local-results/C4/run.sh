#!/bin/sh
# C4: each game's own recorded run (real clicks, keys, drags), on the installed Chrome and the
# machine's graphics card instead of headless Chromium in software. Same sizes and queries as the
# commands in each game's README or tools/play.mjs; only --gpu is added.
#   PLAYWRIGHT_PATH=<node_modules with playwright> sh local-results/C4/run.sh [out dir]
out=${1:-local-results/C4/mac-raw}
run() { # game, name, the rest of shot.mjs's arguments
  game=$1; name=$2; shift 2
  mkdir -p "$out/$game"
  start=$(date +%s)
  (cd "games/$game" && node ../tools/shot.mjs . --gpu "$@" --out "$OLDPWD/$out/$game" --name "$name") > "$out/$game/$name.stdout.txt" 2>&1
  echo "$game $name exit $? $(( $(date +%s) - start )) s"
}
case "$out" in /*) echo "give the out dir relative to the repository root"; exit 2;; esac
run zhuda-beat keys --query "fresh=1" --size 540x960 --timeout 120000 --script tools/play.mjs
run zhuda-guard hands --size 960x540 --query "speed=4" --script tools/play.mjs
run zhuda-hunt q1 --query "quest=q1&auto=legs&speed=6&seed=3" --script tools/play-auto.mjs
run zhuda-idle first --size 540x960 --query "fresh=1&fast=1" --script tools/play.mjs
run zhuda-jump keys --query "fresh=1" --script tools/play.mjs
run zhuda-match hands --query "fresh=1&seed=7" --size 540x960 --script tools/play.mjs
run zhuda-merge first --size 540x960 --query "fresh=1" --script tools/play.mjs
run zhuda-swarm hands --query "seed=5&fresh=1&speed=3" --script tools/play.mjs
run zhuda-wardrobe hands --size 1280x720 --query "look=_._._._._" --script tools/play.mjs --timeout 300000
