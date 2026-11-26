#!/bin/sh
# C3 on the Mac: the three 3D games on WebGL and on WebGPU, the installed Chrome on its graphics card.
# The WebGPU build is a build of its own (zhuda.config.json "renderer": "webgpu"); it is expected
# in each game's dist/webgpu (build it with that setting and "outDir": "dist/webgpu").
#   PLAYWRIGHT_PATH=<node_modules with playwright> sh local-results/C3/run.sh
out=local-results/C3/mac
mkdir -p "$out"
one() { # game, backend dir, kind, query
  name="$1-$2-$3"
  if [ "$3" = rate ]; then
    MEASURE_SECONDS=15 node games/tools/shot.mjs "games/$1" --gpu --dpr 2 --size 1280x720 --root "dist/$2" \
      --query "$4" --script games/tools/device-measure.mjs --out "$out" --name "$name" > /dev/null 2>&1
  else
    node games/tools/shot.mjs "games/$1" --gpu --dpr 2 --size 1280x720 --root "dist/$2" --query "$4" --wait 2500 --out "$out" --name "$name" > /dev/null 2>&1
  fi
  echo "$name exit $?"
}
look="look=hair-bob.shirt.trousers.boots._._.pack.straw-hat"
for backend in web webgpu; do
  one zhuda-wardrobe $backend still "$look"
  one zhuda-wardrobe $backend rate "$look&clip=Run"
  one zhuda-hunt $backend still "seed=1&fresh=1"
  one zhuda-hunt $backend rate "auto=1&seed=1&fresh=1"
  one zhuda-guard $backend still "seed=1&fresh=1"
  one zhuda-guard $backend rate "auto=1&seed=1&fresh=1"
done
