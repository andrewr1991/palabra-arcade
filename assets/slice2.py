"""Slice v2 assets from 'prompt and artwork 2.png' (1024x1536)."""
from PIL import Image
import os

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "prompt and artwork 2.png")
OUT = os.path.join(HERE, "ui")

BOXES = {
    "hero":            (437, 93, 1006, 287),
    "cab-blaster":     (440, 597, 630, 757),
    "cab-memoria":     (635, 597, 820, 757),
    "cab-loteria":     (825, 597, 1010, 757),
    "cab-palabrle":    (440, 762, 630, 915),
    "cab-clasificador":(635, 762, 820, 915),
    "cab-ahorcado":    (825, 762, 1010, 915),
    "panel-nuevas":    (440, 437, 715, 565),
    "panel-repaso":    (722, 437, 1010, 565),
    "panel-codice":    (440, 940, 715, 1042),
    "panel-taller":    (722, 940, 1010, 1042),
    "nav-misiones":    (443, 1055, 560, 1095),
    "nav-logros":      (575, 1055, 700, 1095),
    "nav-tienda":      (718, 1055, 840, 1095),
    "nav-ajustes":     (855, 1055, 1010, 1095),
    "pepe-neutral":    (15, 1155, 88, 1252),
    "pepe-happy":      (90, 1155, 163, 1252),
    "pepe-thinking":   (166, 1155, 240, 1252),
    "pepe-excited":    (242, 1155, 315, 1252),
    "pepe-wink":       (317, 1155, 390, 1252),
    "pepe-surprised":  (392, 1155, 465, 1252),
    "fx-sparkle":      (350, 1360, 420, 1432),
    "fx-starburst":    (424, 1360, 500, 1432),
    "fx-confetti":     (504, 1360, 580, 1432),
    "fx-levelup":      (450, 1442, 535, 1520),
    "bg-lobby":        (590, 1358, 1015, 1528),
}

im = Image.open(SRC).convert("RGB")
for name, box in BOXES.items():
    im.crop(box).save(os.path.join(OUT, name + ".png"))
print("sliced", len(BOXES))

names = list(BOXES)
sheet = Image.new("RGB", (1200, 1000), (18, 18, 28))
x = y = 4
rowh = 0
for n in names:
    tile = Image.open(os.path.join(OUT, n + ".png"))
    if x + tile.width > 1196:
        x = 4
        y += rowh + 6
        rowh = 0
    sheet.paste(tile, (x, y))
    x += tile.width + 6
    rowh = max(rowh, tile.height)
sheet.save(os.path.join(OUT, "_contact2.png"))
print("contact2 saved")
