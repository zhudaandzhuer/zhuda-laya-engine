# The pictures this script reads are not in this repository (they are in the owner's verification
# repository); its outputs under assets/ are tracked. Kept as the record of how they were made.
# Card art for the game, made from pictures this repository already has:
#   heroes: the 512 px portraits of games/jiuye-seal-pact, reduced to 256 px
#   enemies: the first view of each beast in deliverables/*-hd/previews/<id>-views.jpg, cropped to 256 px
#   python3 -I tools/make-art.py
import glob, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); repo = os.path.join(here, '..', '..', '..')
for f in glob.glob(os.path.join(repo, 'games/jiuye-seal-pact/art/heroes/portraits/*.png')):
    Image.open(f).convert('RGBA').resize((256, 256), Image.LANCZOS).save(os.path.join(here, '..', 'assets', 'heroes', os.path.basename(f)), optimize=True)
for s in ('beasts-hd', 'bosses-hd'):
    for f in glob.glob(os.path.join(repo, 'deliverables', s, 'previews', '*-views.jpg')):
        # The sheet is 6 views across and 2 down; the first is the front three-quarter view. The beast
        # sits in the middle of its cell: keep the central 70 %.
        im = Image.open(f).convert('RGB'); w, h = im.size; cw, ch = w / 6, h / 2
        side = min(cw, ch) * 0.7; cx, cy = cw / 2, ch * 0.56
        im.crop((int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))).resize((256, 256), Image.LANCZOS).save(os.path.join(here, '..', 'assets', 'enemies', os.path.basename(f).replace('-views', '')), quality=88)
