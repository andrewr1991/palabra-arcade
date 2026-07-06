"""Slice power-up icons from the asset sheet with transparent backgrounds."""
from PIL import Image
from collections import deque
import os

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "sprite asset map.webp")
OUT = os.path.join(HERE, "blaster")

BOXES = {
    "pu-shield": (657, 856, 690, 891),
    "pu-clock":  (737, 896, 770, 929),
    "pu-double": (657, 936, 690, 969),
    "pu-heart":  (777, 856, 812, 891),
}

def key_transparent(img, tol=46):
    img = img.convert("RGBA")
    px = img.load(); w, h = img.size
    cs = [px[0, 0], px[w-1, 0], px[0, h-1], px[w-1, h-1]]
    br = sum(c[0] for c in cs)//4; bgc = sum(c[1] for c in cs)//4; bb = sum(c[2] for c in cs)//4
    def is_bg(p): return (abs(p[0]-br)+abs(p[1]-bgc)+abs(p[2]-bb)) <= tol
    seen = [[False]*w for _ in range(h)]
    q = deque([(x, y) for x in range(w) for y in (0, h-1)] + [(x, y) for y in range(h) for x in (0, w-1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]: continue
        seen[y][x] = True
        if not is_bg(px[x, y]): continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
    return img

im = Image.open(SRC).convert("RGB")
for name, box in BOXES.items():
    key_transparent(im.crop(box)).save(os.path.join(OUT, name + ".png"))
print("sliced power-ups:", list(BOXES))
