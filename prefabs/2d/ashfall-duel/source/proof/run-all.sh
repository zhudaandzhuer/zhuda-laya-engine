#!/bin/zsh
# Every comparison of 2026-11-25 (detplay with integer Date.now). Logs keep the whole state.
#   ORIG=<original checkout>/dist/web LIB=<library-game>/dist/web OUT=<dir> zsh run-all.sh   (from anywhere)
# then: python3 variants.py <dirs…> per scenario, python3 states.py <logs…>
G=<workspace>
P=${0:A:h}
D=${DETPLAY:-$G/prefabs/tools/detplay.mjs}   # needs PRELOAD= (routes/tools after 2026-11-25)
O=${OUT:?OUT=<dir>}
ORIG=${ORIG:?ORIG=<original dist/web>}
VIEW=${VIEW:-$G/prefabs/viewer2d/dist/web}
LIB=${LIB:?LIB=<library-game dist/web>}
mkdir -p $O
export NOTRANSITIONS=1 LOG_CHARS=100000
run() { # name root scenario query preload [viewport]
  local name=$1 root=$2 sc=$3 q=$4 pre=$5 vp=${6:-1280x720}
  VIEWPORT=$vp PRELOAD=$pre node $D $root $P/$sc.json "$q" $O/$name > $O/$name.log 2>&1
  echo "$name done $(tail -c 120 $O/$name.log | tr -d '\n' | cut -c1-120)"
}
for r in a b c; do run duel-orig-$r $ORIG duel "" $P/qa-helpers.js,$P/original-hook.js; run duel-view-$r $VIEW duel "scene=ashfall-duel" $P/qa-helpers.js; done
run duel-lib-a $LIB duel "" $P/qa-helpers.js,$P/original-hook.js
for r in a b; do run portrait-orig-$r $ORIG portrait "" $P/qa-helpers.js,$P/original-hook.js 390x844; run portrait-view-$r $VIEW portrait "scene=ashfall-duel" $P/qa-helpers.js 390x844; done
for r in a b; do run victory-orig-$r $ORIG victory "" $P/qa-helpers.js,$P/original-hook.js; run victory-view-$r $VIEW victory "scene=ashfall-duel" $P/qa-helpers.js; done
run defeat-orig-a $ORIG defeat "" $P/qa-helpers.js,$P/original-hook.js
run defeat-view-a $VIEW defeat "scene=ashfall-duel" $P/qa-helpers.js
echo ALL-DONE
