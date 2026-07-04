# Asset drop zone

Generated pixel art lands here. The app runs fine with this folder empty —
games use vector fallbacks until sprites exist.

## Atlas format

`atlas.json`:

```json
{
  "image": "sheet.png",
  "frames": {
    "ship":  { "x": 0,  "y": 0, "w": 32, "h": 32 },
    "boss1": { "x": 32, "y": 0, "w": 96, "h": 64 },
    "pepe":  { "x": 128,"y": 0, "w": 21, "h": 18 }
  }
}
```

Names games look for (add as art is generated): `ship`, `boss1`, `enemy-green`,
`enemy-red`, `enemy-blue`, `pepe`, plus `bg-ciudad`, `bg-jungla`, `bg-playa`,
`bg-desierto`, `bg-espacio` (drawn full-canvas behind Blaster waves).

## Style prompt (from the art direction doc)

SNES-era pixel art, 16-bit RPG/platformer feel (Chrono Trigger, Zelda: ALttP,
SMW). Bright warm palette, high contrast, clear silhouettes readable at small
sizes. 8×8 / 16×16 grid discipline; sprite sheets with animation rows (idle,
walk, attack). Mascot: Pepe the parrot — green body, red/orange accents, red
cap with a "P". Environments: Ciudad Mexicana, Jungla, Playa, Desierto,
Espacio, Submarino.
