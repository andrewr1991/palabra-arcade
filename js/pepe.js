// Pepe the Parrot — mascot, guide, and cheerleader.
// Placeholder sprite is hand-coded pixel data; swaps automatically for
// assets/pepe.png (via sprites.js) when real art lands.

const COLORS = {
  D: "#2a1c1c", R: "#e74c3c", r: "#b03429", G: "#3f9b43", g: "#6abe30",
  W: "#ffffff", B: "#111111", O: "#e8722a", Y: "#f7b32b", T: "#f2e9dc",
};
const PIXELS = [
  "......DDDD..........",
  ".....DrrrrD.........",
  "....DrrRRrrD........",
  "...DrRRRRRrD........",
  "...DGGGGGGGD........",
  "..DGGGGGGGGGD.......",
  "..DGWWBGGGGGD.......",
  "..DGWWBGGGGODD......",
  "..DGGGGGGGOOOD......",
  "...DGGGGGGGOD.......",
  "...DGGggGGGGD.......",
  "..DGGggggGGGDD......",
  "..DGGggggGGGGD......",
  ".DGGGggggGGGD.......",
  ".DYYGGggGGGD........",
  "..DYYGGGGGD.........",
  "...DDGGGDD..........",
  ".....DDD............",
];

const GREETS = [
  "¡Elige un juego, jugador!",
  "¡Órale, volviste!",
  "¿Listo para chambear?",
  "¡Vamos por esa racha!",
  "Yo repito palabras. Tú también deberías.",
];

let bubble = null, sprite = null, bubbleTimer = null;

export function initPepe(container) {
  const wrap = document.createElement("div");
  wrap.id = "pepe";
  const img = document.createElement("img");
  img.className = "pepe-img";
  img.alt = "Pepe";
  img.src = "assets/ui/pepe-1.png";
  img.onerror = () => {
    // sliced art missing — fall back to the hand-coded pixel sprite
    const canvas = document.createElement("canvas");
    canvas.width = 21; canvas.height = 18;
    canvas.className = "pepe-canvas";
    const ctx = canvas.getContext("2d");
    PIXELS.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (COLORS[ch]) { ctx.fillStyle = COLORS[ch]; ctx.fillRect(x, y, 1, 1); }
      });
    });
    img.replaceWith(canvas);
    sprite = canvas;
  };
  bubble = document.createElement("div");
  bubble.className = "pepe-bubble hidden";
  sprite = img;
  wrap.appendChild(bubble);
  wrap.appendChild(img);
  container.appendChild(wrap);

  window.addEventListener("pa-levelup", (e) =>
    say(`¡NIVEL ${e.detail.level}! ¡Qué padre, güey! 🎉`, true));
  window.addEventListener("pa-freeze-used", () =>
    say("¡Fiu! Un hielo salvó tu racha. 🧊", true));
}

export function say(text, bounce = false) {
  if (!bubble) return;
  if (sprite && sprite.tagName === "IMG") {
    sprite.src = bounce ? "assets/ui/pepe-3.png" : "assets/ui/pepe-1.png";
  }
  bubble.textContent = text;
  bubble.classList.remove("hidden");
  if (bounce) {
    sprite.classList.remove("pepe-bounce");
    void sprite.offsetWidth;
    sprite.classList.add("pepe-bounce");
  }
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.add("hidden"), 7000);
}

// contextual hub line: nag about fading words, cheer streaks, else greet
export function hubTip(stats, fadingCount, streak) {
  if (fadingCount > 0) {
    say(`Se te ${fadingCount === 1 ? "olvida 1 palabra" : `olvidan ${fadingCount} palabras`}… al Repaso, ¡ándale!`);
  } else if (stats.known === 0) {
    say("¡Bienvenido! Empieza con la prueba de nivel o Palabras nuevas.");
  } else if (streak >= 3) {
    say(`¡${streak} días seguidos! No rompas la racha, ¿eh?`);
  } else {
    say(GREETS[Math.floor(Math.random() * GREETS.length)]);
  }
}
