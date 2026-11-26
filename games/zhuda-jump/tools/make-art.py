# The few pictures the game draws, cut from games/zhuda-swarm's atlas (the same repository's own art):
# 豬大, a walker (猙), a coin.   python3 -I tools/make-art.py
import json, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); swarm = os.path.join(here, '..', '..', 'zhuda-swarm', 'assets')
atlas = Image.open(os.path.join(swarm, 'atlas.png')); frames = json.load(open(os.path.join(swarm, 'atlas.json')))['frames']
for name, out in (('pig', 'pig'), ('zheng', 'walker'), ('coin', 'coin')):
    x, y, w, h = frames[name]
    atlas.crop((x, y, x + w, y + h)).save(os.path.join(here, '..', 'assets', out + '.png'), optimize=True)
