# The torso of the extra looks, enlarged: python3 crop-extra.py <dir> <out> <name>...
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
W, H = 640, 800
sheet = Image.new('RGB', (W * len(names), H), (20, 22, 28))
d = ImageDraw.Draw(sheet)
for k, name in enumerate(names):
    im = Image.open(os.path.join(src, name + '.png')).convert('RGB')
    w, h = im.size
    cx = int(w * 0.295)
    box = (cx - int(h * 0.2), int(h * 0.2), cx + int(h * 0.2), int(h * 0.7))
    sheet.paste(im.crop(box).resize((W, H), Image.LANCZOS), (k * W, 0))
    d.text((k * W + 10, 8), name, fill=(255, 255, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
sheet.save(out, quality=90)
print(out, sheet.size, im.size)
