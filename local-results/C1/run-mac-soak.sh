#!/bin/sh
# C1, the second measurement on the Mac: a new random look every two seconds for 30 minutes,
# memory at the start and every ten minutes (does changing clothes leak?).
#   PLAYWRIGHT_PATH=<node_modules with playwright> sh local-results/C1/run-mac-soak.sh
out=local-results/C1/mac-soak
mkdir -p "$out"
MEASURE_SOAK_MINUTES=${MEASURE_SOAK_MINUTES:-30} node games/tools/shot.mjs games/zhuda-wardrobe --gpu --dpr 2 --size 1280x720 \
  --query "auto=1&spin=1" --script games/tools/device-measure.mjs --out "$out" --name soak > /dev/null 2>&1
echo "soak exit $?"
