# One sheet per look from the look-book's pictures: rows front, side, back; columns walk, run, arms, crouch, kick.
#   python3 local-results/B1/sheets.py <dir with the 90 pictures> <out dir>
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
LOOKS = ['1-bare', '2-tee-trousers', '3-shirt-skirt', '4-sun-dress', '5-tank-shorts-hat-pack', '6-robe']
POSES = ['walk', 'run', 'arms', 'crouch', 'kick']
VIEWS = ['front', 'side', 'back']
CELL_W, CELL_H = 520, 760
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
except OSError:
    font = ImageFont.load_default()
for look in LOOKS:
    sheet = Image.new('RGB', (CELL_W * len(POSES), CELL_H * len(VIEWS)), (20, 22, 28))
    draw = ImageDraw.Draw(sheet)
    for r, view in enumerate(VIEWS):
        for c, pose in enumerate(POSES):
            im = Image.open(os.path.join(src, f'{look}-{pose}-{view}.jpg'))
            w, h = im.size
            # the panel covers the right of the stage and the figure stands at 0.295 of the width; keep the full height
            crop_w = int(h * CELL_W / CELL_H)
            left = max(0, min(w - crop_w, int(w * 0.295 - crop_w / 2)))
            cell = im.crop((left, 0, left + crop_w, h)).resize((CELL_W, CELL_H), Image.LANCZOS)
            sheet.paste(cell, (c * CELL_W, r * CELL_H))
            draw.text((c * CELL_W + 12, r * CELL_H + 10), f'{pose} / {view}', fill=(255, 255, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    sheet.save(os.path.join(out, f'{look}.jpg'), quality=86)
    print(look, sheet.size, os.path.getsize(os.path.join(out, f'{look}.jpg')) // 1024, 'KB')
