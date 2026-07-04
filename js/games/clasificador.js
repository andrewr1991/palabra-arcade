// Clasificador — words fall one at a time; sort them into the right
// category bin (click or keys 1/2/3) before they hit the ground.
// Category knowledge is a weak meaning signal: evidence weight 0.3.

import { allWords } from "../customwords.js";
import { CATEGORIES } from "../data/words.js";
import { active, addXP, saveNow } from "../profile.js";
import { shuffle } from "../brain.js";

const ROUND_WORDS = 20;
const WEIGHT = 0.3;

let deps, bound = false;
const $ = (id) => document.getElementById(id);

let cats = [], queue = [], falling = null, lives = 3, score = 0, correct = 0;
let speed = 60, rafId = 0, lastT = 0, playing = false;

export function initClasificador(dependencies) {
  deps = dependencies;
  if (bound) return;
  bound = true;
  $("cl-quit").addEventListener("click", quit);
  $("cl-again").addEventListener("click", startRound);
  $("cl-back").addEventListener("click", quit);
  document.querySelectorAll(".cl-bin").forEach((bin, i) => {
    bin.addEventListener("click", () => choose(i));
  });
  window.addEventListener("keydown", (e) => {
    if (!playing) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") choose(Number(e.key) - 1);
  });
}

export function enterClasificador() { startRound(); }

function quit() {
  stop();
  $("cl-over").classList.add("hidden");
  deps.onExit();
}
function stop() {
  playing = false;
  cancelAnimationFrame(rafId);
  if (falling) { falling.el.remove(); falling = null; }
}

function startRound() {
  stop();
  $("cl-over").classList.add("hidden");
  const brain = active().brain;

  // 3 categories with enough words, weighted toward what needs work
  const catKeys = shuffle(Object.keys(CATEGORIES).filter(
    (c) => allWords().filter((w) => w.cat === c).length >= 6
  )).slice(0, 3);
  cats = catKeys;
  queue = [];
  for (const c of catKeys) {
    const pool = allWords().filter((w) => w.cat === c);
    queue.push(...brain.pickWeak(pool, Math.ceil(ROUND_WORDS / 3)));
  }
  shuffle(queue);
  queue = queue.slice(0, ROUND_WORDS);

  document.querySelectorAll(".cl-bin").forEach((bin, i) => {
    bin.querySelector(".cl-bin-name").textContent = CATEGORIES[cats[i]];
    bin.querySelector(".cl-bin-key").textContent = i + 1;
  });

  lives = 3; score = 0; correct = 0; speed = 55;
  updateHud();
  playing = true;
  nextWord();
  lastT = performance.now();
  rafId = requestAnimationFrame(tick);
}

function nextWord() {
  if (falling) { falling.el.remove(); falling = null; }
  const word = queue.shift();
  if (!word) { finish(); return; }
  const area = $("cl-area");
  const el = document.createElement("div");
  el.className = "cl-word";
  el.textContent = word.es;
  area.appendChild(el);
  const x = 10 + Math.random() * (area.clientWidth - el.offsetWidth - 20);
  el.style.left = x + "px";
  falling = { word, el, y: -36 };
  el.style.top = falling.y + "px";
}

function tick(now) {
  if (!playing) return;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (falling) {
    falling.y += speed * dt;
    falling.el.style.top = falling.y + "px";
    const floor = $("cl-area").clientHeight - falling.el.offsetHeight - 4;
    if (falling.y >= floor) miss("¡se cayó!");
  }
  rafId = requestAnimationFrame(tick);
}

function choose(binIdx) {
  if (!playing || !falling) return;
  const brain = active().brain;
  if (falling.word.cat === cats[binIdx]) {
    correct++;
    score += 10;
    speed += 6;
    brain.report(falling.word.es, { correct: true, weight: WEIGHT });
    saveNow();
    flashBin(binIdx, true);
    updateHud();
    nextWord();
  } else {
    brain.report(falling.word.es, { correct: false, weight: WEIGHT });
    saveNow();
    flashBin(binIdx, false);
    miss("bin equivocado");
  }
}

function miss(reason) {
  lives--;
  updateHud();
  if (falling) {
    falling.el.classList.add("cl-lost");
    const el = falling.el;
    setTimeout(() => el.remove(), 400);
    falling = null;
  }
  if (lives <= 0) { finish(); return; }
  nextWord();
}

function flashBin(i, good) {
  const bin = document.querySelectorAll(".cl-bin")[i];
  const cls = good ? "cl-good" : "cl-bad";
  bin.classList.remove("cl-good", "cl-bad");
  void bin.offsetWidth;
  bin.classList.add(cls);
}

function updateHud() {
  $("cl-score").textContent = score;
  $("cl-lives").textContent = "❤️".repeat(Math.max(0, lives));
}

function finish() {
  stop();
  const data = active().data;
  if (score > (data.clasificadorBest || 0)) data.clasificadorBest = score;
  const xp = Math.round(score / 2);
  const { leveledUp } = addXP(xp); // always — streak counts even at 0 points
  saveNow();
  $("cl-over-stats").textContent =
    `${correct} correctas · ${score} puntos (mejor: ${data.clasificadorBest}) · +${xp} XP${leveledUp ? " · ¡LEVEL UP!" : ""}`;
  $("cl-over").classList.remove("hidden");
  deps.onSessionEnd();
}
