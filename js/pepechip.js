// Reusable "Pepe chip" — a small sprite + short message shown inside a
// game-provided safe slot, auto-hiding after a moment. One implementation
// shared by every launch game so Pepe never covers gameplay and never gets
// a bespoke per-game version.
//
//   pepeChip(slotEl, "¡Vamos!", "happy", 3400)
//
// Poses available in assets/ui/: neutral, happy, thinking, excited, wink,
// surprised. The slot element decides WHERE (each screen places it in a
// safe band); this helper only handles the chip contents + timing.

export function pepeChip(slot, text, mood = "happy", ms = 3400) {
  if (!slot) return;
  slot.innerHTML =
    `<img class="pc-img" src="assets/ui/pepe-${mood}.png" alt="Pepe" draggable="false">` +
    `<span class="pc-text"></span>`;
  slot.querySelector(".pc-text").textContent = text;
  slot.classList.add("pepe-chip");
  slot.classList.remove("hidden");
  clearTimeout(slot._pcTimer);
  if (ms > 0) slot._pcTimer = setTimeout(() => pepeChipHide(slot), ms);
}

export function pepeChipHide(slot) {
  if (!slot) return;
  clearTimeout(slot._pcTimer);
  slot.classList.add("hidden");
  slot.innerHTML = "";
}
