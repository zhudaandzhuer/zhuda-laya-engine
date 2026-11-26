# The board's item pictures: emoji drawn once into an atlas with Noto Color Emoji (OFL), so that
# every device shows the same pictures and the 2D renderer batches them from one texture.
# Writes assets/items.png and assets/items.json.   python3 -I tools/make-items.py
import json, os
from PIL import Image, ImageDraw, ImageFont
here = os.path.dirname(os.path.abspath(__file__))
FONT = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'
CHAINS = {
    'veg': ['🌱', '🥬', '🥕', '🌽', '🥗', '🍲'],
    'tea': ['💧', '🫖', '🍵', '🧋', '🥤', '🍹'],
    'bun': ['🌾', '🍚', '🍙', '🥟', '🍜', '🍱'],
    'gen': ['🧺', '🚰', '♨️'],
    'ui': ['⚡', '🪙', '⭐', '🗑️', '🔒'],
}
font = ImageFont.truetype(FONT, 109)
C = 112; cols = 8
names = [(f'{chain}-{i}', ch) for chain, items in CHAINS.items() for i, ch in enumerate(items)]
rows = (len(names) + cols - 1) // cols
atlas = Image.new('RGBA', (cols * C, 512), (0, 0, 0, 0))
frames = {}
for n, (name, ch) in enumerate(names):
    cell = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(cell).text((80, 80), ch, font=font, embedded_color=True, anchor='mm')
    box = cell.getbbox()
    if not box: raise SystemExit(f'{name} {ch}: the font has no picture for it')
    glyph = cell.crop(box); glyph.thumbnail((C - 8, C - 8), Image.LANCZOS)
    x, y = (n % cols) * C, (n // cols) * C
    atlas.paste(glyph, (x + (C - glyph.width) // 2, y + (C - glyph.height) // 2))
    frames[name] = [x, y, C, C]
atlas.save(os.path.join(here, '..', 'assets', 'items.png'), optimize=True)
json.dump({'frames': frames}, open(os.path.join(here, '..', 'assets', 'items.json'), 'w'), indent=1)
print(len(frames), 'items', rows, 'rows')
