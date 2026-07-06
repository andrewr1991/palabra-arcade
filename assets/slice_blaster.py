"""Slice Blaster sprites from 'sprite asset map.webp' with transparent
backgrounds. Uses edge flood-fill so only the poster background (connected
to the crop border) is removed - dark pixels *inside* a sprite are kept."""
from PIL import Image
from collections import deque
import os

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "sprite asset map.webp")
OUT = os.path.join(HERE, "blaster")
os.makedirs(OUT, exist_ok=True)

BOXES = {
    # player ships (2 rows x 3)
    "ship-red":     (22, 850, 60, 898),
    "ship-blue":    (70, 850, 109, 898),
    "ship-orange":  (114, 850, 157, 898),
    "ship-red2":    (18, 904, 62, 956),
    "ship-cyan":    (68, 904, 111, 956),
    "ship-green":   (112, 904, 158, 956),
    # enemies (3 rows x 3)
    "enemy-blue":   (192, 853, 227, 889),
    "enemy-red":    (238, 853, 273, 889),
    "enemy-orange": (286, 853, 321, 889),
    "enemy-green":  (192, 899, 227, 935),
    "enemy-pink":   (238, 899, 273, 935),
    "enemy-lime":   (286, 899, 321, 935),
    "enemy-cyan":   (192, 942, 227, 978),
    "enemy-redoct": (238, 942, 273, 978),
    "enemy-purple": (286, 942, 321, 978),
    # bosses
    "boss-fortress":(344, 858, 444, 957),
    "boss-octopus": (446, 862, 525, 956),
    "boss-skull":   (526, 858, 625, 958),
}

def key_transparent(img, tol=42):
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    # background reference = average of the four corners
    corners = [px[0, 0], px[w-1, 0], px[0, h-1], px[w-1, h-1]]
    br = sum(c[0] for c in corners) // 4
    bg_ = sum(c[1] for c in corners) // 4
    bb = sum(c[2] for c in corners) // 4
    def is_bg(p):
        return (abs(p[0]-br) + abs(p[1]-bg_) + abs(p[2]-bb)) <= tol
    seen = [[False]*w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        if not is_bg(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
    return img

im = Image.open(SRC).convert("RGB")
for name, box in BOXES.items():
    cut = key_transparent(im.crop(box))
    cut.save(os.path.join(OUT, name + ".png"))
print("sliced", len(BOXES), "->", OUT)

# contact sheet on magenta to verify cutouts
names = list(BOXES)
cols = 6
cell = 110
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGBA", (cols*cell, rows*cell), (255, 0, 255, 255))
for i, n in enumerate(names):
    s = Image.open(os.path.join(OUT, n + ".png"))
    s = s.resize((int(s.width*2), int(s.height*2)), Image.NEAREST)
    cx = (i % cols)*cell + (cell - s.width)//2
    cy = (i // cols)*cell + (cell - s.height)//2
    sheet.alpha_composite(s, (max(0, cx), max(0, cy)))
sheet.convert("RGB").save(os.path.join(OUT, "_contact.png"))
print("contact saved")
