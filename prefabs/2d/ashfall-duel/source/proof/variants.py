# For every shot: the distinct pictures over all runs (by hash), which runs drew each, and the
# largest difference between any two variants.
import sys, os, hashlib
from PIL import Image, ImageChops
runs = [r for r in sys.argv[1:] if os.path.isdir(r)]  # a shell glob may also catch the .log files
names = sorted(n for n in os.listdir(runs[0]) if n.endswith('.png'))
for name in names:
    groups = {}
    for r in runs:
        img = Image.open(f'{r}/{name}').convert('RGB')
        h = hashlib.md5(img.tobytes()).hexdigest()[:8]
        groups.setdefault(h, []).append(r)
    keys = list(groups)
    worst = ''
    if len(keys) > 1:
        imgs = {k: Image.open(f'{groups[k][0]}/{name}').convert('RGB') for k in keys}
        stats = []
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                d = ImageChops.difference(imgs[keys[i]], imgs[keys[j]])
                box = d.getbbox()
                n = sum(1 for p in d.getdata() if max(p) > 0)
                stats.append(f'{keys[i]}~{keys[j]}: {n}px max{max(max(p) for p in d.getdata())} box{box}')
        worst = ' | '.join(stats)
    print(name, {k: v for k, v in groups.items()}, worst)
