# Before and after of the same picture, cropped to the figure: python3 pair.py <before dir> <after dir> <out> <name>...
import sys, os
from PIL import Image, ImageDraw, ImageFont
before, after, out, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 30)
W, H = 620, 1100
sheet = Image.new('RGB', (W * 2 * len(names), H), (20, 22, 28))
d = ImageDraw.Draw(sheet)
for k, name in enumerate(names):
    for j, (src, label) in enumerate(((before, 'before'), (after, 'after'))):
        im = Image.open(os.path.join(src, name + '.jpg'))
        w, h = im.size
        cw = int(h * 0.92 * W / H)
        left = int(w * 0.295 - cw / 2)
        cell = im.crop((left, int(h * 0.06), left + cw, int(h * 0.98))).resize((W, H), Image.LANCZOS)
        sheet.paste(cell, ((k * 2 + j) * W, 0))
        d.text(((k * 2 + j) * W + 12, 10), f'{label}: {name}', fill=(255, 255, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
sheet.save(out, quality=88)
print(out, sheet.size)
