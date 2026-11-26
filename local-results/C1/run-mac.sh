#!/bin/sh
# C1 on the Mac: the wardrobe's look of the request, standing and running, 30 s each.
#   PLAYWRIGHT_PATH=<node_modules with playwright> sh local-results/C1/run-mac.sh
# Chrome installed on the machine, on its graphics card (the log's `renderer` says which).
out=local-results/C1/mac
look="look=hair-bob.shirt.trousers.boots._._.pack.straw-hat"
mkdir -p "$out"
one() { # name, query, extra shot.mjs arguments
  name=$1; query=$2; shift 2
  MEASURE_SECONDS=${MEASURE_SECONDS:-30} node games/tools/shot.mjs games/zhuda-wardrobe --gpu --size 1280x720 \
    --query "$query" --script games/tools/device-measure.mjs --out "$out" --name "$name" "$@" > /dev/null 2>&1
  echo "$name exit $?"
}
one headless-dpr2-stand "$look" --dpr 2
one headless-dpr2-run "$look&clip=Run" --dpr 2
one headless-dpr1-stand "$look" --dpr 1
one headless-dpr1-run "$look&clip=Run" --dpr 1
one window-dpr2-stand "$look" --dpr 2 --headed
one window-dpr2-run "$look&clip=Run" --dpr 2 --headed
# What a frame costs with the 60 Hz limit off (not what a player sees).
SHOT_CHROME_ARGS="--disable-frame-rate-limit --disable-gpu-vsync" one unlimited-dpr1-run "$look&clip=Run" --dpr 1
SHOT_CHROME_ARGS="--disable-frame-rate-limit --disable-gpu-vsync" one unlimited-dpr2-run "$look&clip=Run" --dpr 2
