"""Count differing pixels between same-named PNGs in two folders.

usage: python3 pixdiff.py <dirA> <dirB> [label]
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops

a_dir, b_dir = Path(sys.argv[1]), Path(sys.argv[2])
label = sys.argv[3] if len(sys.argv) > 3 else ""
for a in sorted(a_dir.glob("*.png")):
    b = b_dir / a.name
    ia, ib = Image.open(a).convert("RGBA"), Image.open(b).convert("RGBA")
    if ia.size != ib.size:
        print(f"{label}{a.name}: size {ia.size} vs {ib.size}")
        continue
    diff = ImageChops.difference(ia, ib)
    px = sum(1 for p in diff.getdata() if max(p) > 0)
    maxd = max(max(p) for p in diff.getdata())
    print(f"{label}{a.name}: {px} pixels differ (max channel delta {maxd})")
