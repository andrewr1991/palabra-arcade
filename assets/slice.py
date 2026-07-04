"""Slice UI art out of the flat mockup into individual assets."""
from PIL import Image
import os

SRC = os.path.join(os.path.dirname(__file__), "Palabra Arcade Art Layout.png")
OUT = os.path.join(os.path.dirname(__file__), "ui")
os.makedirs(OUT, exist_ok=True)

BOXES = {
    "hero":            (483, 108, 1016, 348),
    "cab-blaster":     (488, 666, 661, 840),
    "cab-memoria":     (664, 666, 837, 840),
    "cab-loteria":     (840, 666, 1013, 840),
    "cab-palabrle":    (488, 845, 661, 1014),
    "cab-clasificador":(664, 845, 837, 1014),
    "cab-ahorcado":    (840, 845, 1013, 1014),
    "panel-nuevas":    (487, 500, 744, 629),
    "panel-repaso":    (748, 500, 1014, 629),
    "panel-codice":    (487, 1046, 744, 1139),
    "panel-taller":    (748, 1046, 1014, 1139),
    "nav-misiones":    (483, 1158, 590, 1203),
    "nav-logros":      (593, 1158, 700, 1203),
    "nav-tienda":      (813, 1158, 920, 1203),
    "nav-ajustes":     (923, 1158, 1017, 1203),
    "pepe-1":          (18, 848, 130, 992),
    "pepe-2":          (133, 848, 246, 992),
    "pepe-3":          (249, 848, 356, 992),
    "pepe-4":          (358, 848, 463, 992),
}

im = Image.open(SRC).convert("RGB")
for name, box in BOXES.items():
    im.crop(box).save(os.path.join(OUT, name + ".png"))
    print(name, box)
print("done ->", OUT)
