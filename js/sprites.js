// Sprite pipeline — loads assets/atlas.json + sheet image when present.
// Games call hasSprite/drawSprite and keep their vector fallbacks, so the
// app works with zero assets and upgrades itself as art lands.

let atlas = null, sheet = null;

export async function initSprites() {
  try {
    const r = await fetch("assets/atlas.json");
    if (!r.ok) return;
    atlas = await r.json();
    sheet = new Image();
    sheet.src = "assets/" + atlas.image;
    await sheet.decode();
  } catch { atlas = null; sheet = null; }
}

export function hasSprite(name) {
  return !!(atlas && sheet && atlas.frames && atlas.frames[name]);
}

// draws centered on (x, y); scale multiplies native pixel size
export function drawSprite(ctx, name, x, y, scale = 1) {
  const f = atlas.frames[name];
  const w = f.w * scale, h = f.h * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, f.x, f.y, f.w, f.h, x - w / 2, y - h / 2, w, h);
}
