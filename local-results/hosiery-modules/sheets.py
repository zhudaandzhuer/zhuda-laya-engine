# Contact sheets of a look-book run: python3 sheets.py <run dir> <out dir> [suffix]
import sys, os
from PIL import Image
run, out = sys.argv[1], sys.argv[2]
suffix = sys.argv[3] if len(sys.argv) > 3 else ''
os.makedirs(out, exist_ok=True)
TYPES = ['ultra8', 'sheer20', 'semi40', 'opaque80', 'thick120', 'glossy15', 'seam15', 'lacetop', 'garter', 'laceTights', 'micronet', 'fishnet', 'whalenet', 'rib', 'dots']
BOTTOMS = ['mini', 'pleated', 'tennis', 'houndstooth', 'midiPleats', 'pencil', 'midi', 'denimShorts', 'rippedShorts', 'woolShorts', 'jeans', 'slacks', 'none']
SPECIAL = ['jeans-torn', 'jeans-fishnet-through-hole', 'ripped-shorts', 'skirt-lifted', 'seam-from-behind', 'garter', 'lace-tights-shorts', 'houndstooth']
def sheet(names, cols, cell, crop, name):
    rows = (len(names) + cols - 1) // cols
    s = Image.new('RGB', (cols * cell[0], rows * cell[1]), (5, 8, 15))
    for i, n in enumerate(names):
        im = Image.open(os.path.join(run, n + '.png')).convert('RGB')
        if crop: im = im.crop(crop(im.size))
        im = im.resize(cell, Image.LANCZOS)
        s.paste(im, ((i % cols) * cell[0], (i // cols) * cell[1]))
    s.save(os.path.join(out, name + suffix + '.jpg'), quality=86)
    print(name + suffix, s.size)
middle = lambda size: (size[0] // 2 - size[1] * 5 // 12, 0, size[0] // 2 + size[1] * 5 // 12, size[1])
sheet(['type-' + t for t in TYPES], 5, (400, 480), middle, 'types')
sheet(['bottom-' + b for b in BOTTOMS], 7, (300, 360), middle, 'bottoms')
sheet(SPECIAL, 4, (400, 288), None, 'by-hand')
