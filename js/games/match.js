// Memoria — game #2. Flip cards to pair Spanish words with English
// meanings. Recognition-level evidence to the brain (weight 0.4). The calm
// counterpart to Blaster: no timers, just a brisk, satisfying memory round.

import { active, addXP, saveNow } from "../profile.js";
import { shuffle } from "../brain.js";
import { speak } from "../audio.js";
import { boop, fxPop } from "../ui.js";
import { getSettings } from "../settings.js";
import { pepeChip } from "../pepechip.js";

const WEIGHT = 0.4;
const PEPE_WINS = ["¡Buena memoria!", "¡Eso, campeón!", "¡Qué ojo, güey!"];

let deps, bound = false;
const $ = (id) => document.getElementById(id);

let roundPairs = 6;    // RÁPIDA by default; CLÁSICA = 10
let first = null, lock = false, moves = 0, matched = 0, startTime = 0, pairsRound = 6;
let combo = 0, maxCombo = 0, mismatches = {}, finished = false, milestoneShown = false;

function snd(freq, vol = 0.06, dur = 0.1, type = "square") {
  const v = getSettings().sfxVol;
  if (v > 0) boop(vol * v, freq, dur, type);
}

export function initMatch(dependencies) {
  deps = dependencies;
  if (bound) return;
  bound = true;
  $("mt-quit").addEventListener("click", () => deps.onExit());
  $("mt-again").addEventListener("click", startRound);
  $("mt-back").addEventListener("click", () => { $("mt-over").classList.add("hidden"); deps.onExit(); });
  $("mt-mode-rapida").addEventListener("click", () => setMode(6));
  $("mt-mode-clasica").addEventListener("click", () => setMode(10));
}

function setMode(pairs) {
  roundPairs = pairs;
  $("mt-mode-rapida").classList.toggle("active", pairs === 6);
  $("mt-mode-clasica").classList.toggle("active", pairs === 10);
  startRound();
}

export function enterMatch() { startRound(); }

function startRound() {
  $("mt-over").classList.add("hidden");
  first = null; lock = false; moves = 0; matched = 0; combo = 0; maxCombo = 0;
  mismatches = {}; finished = false; milestoneShown = false;
  startTime = Date.now();
  $("mt-moves").textContent = "0";
  $("mt-combo").textContent = "0";

  // over-fetch, then drop words whose English display collides (saber/conocer
  // are both "to know" — two identical cards would be unfair)
  const fetched = active().brain.requestWords(roundPairs * 2 + 4, { newCount: 3 });
  const seenEn = new Set();
  const words = [];
  for (const w of fetched) {
    const en = w.en[0].toLowerCase();
    if (seenEn.has(en)) continue;
    seenEn.add(en);
    words.push(w);
    if (words.length === roundPairs) break;
  }
  pairsRound = words.length;
  $("mt-found").textContent = `0 / ${pairsRound}`;

  const cards = [];
  words.forEach((w, i) => {
    cards.push({ pair: i, es: w.es, side: "es", label: w.es });
    cards.push({ pair: i, es: w.es, side: "en", label: w.en[0] });
  });
  shuffle(cards);

  const grid = $("mt-grid");
  grid.className = "mt-" + (pairsRound <= 6 ? "6" : "10");
  grid.innerHTML = "";
  for (const c of cards) {
    const el = document.createElement("button");
    el.className = "mcard side-" + c.side;
    el.dataset.pair = c.pair;
    el.dataset.side = c.side;
    el.dataset.es = c.es;
    el.innerHTML =
      `<div class="mc-inner">` +
      `<div class="mc-face mc-back"></div>` +
      `<div class="mc-face mc-front"><span class="mc-badge"></span><span class="mc-label"></span></div>` +
      `</div>`;
    el.querySelector(".mc-badge").textContent = c.side === "es" ? "ES" : "EN";
    el.querySelector(".mc-label").textContent = c.label;
    el.addEventListener("click", () => flip(el));
    grid.appendChild(el);
  }
  pepeChip($("mt-pepe"), "Encuentra las parejas.", "happy", 3200);
}

function flip(el) {
  if (lock || el.classList.contains("revealed") || el.classList.contains("matched")) return;
  el.classList.add("revealed");
  snd(660, 0.04, 0.05);
  if (!first) { first = el; return; }

  moves++;
  $("mt-moves").textContent = moves;
  const a = first, b = el;
  first = null;

  if (a.dataset.pair === b.dataset.pair && a.dataset.side !== b.dataset.side) {
    onMatch(a, b);
  } else {
    onMismatch(a, b);
  }
}

function onMatch(a, b) {
  matched++;
  combo++;
  maxCombo = Math.max(maxCombo, combo);
  for (const el of [a, b]) {
    el.classList.add("matched");
    const seal = document.createElement("span");
    seal.className = "mc-seal";
    seal.textContent = "⭐";
    el.querySelector(".mc-front").appendChild(seal);
  }
  $("mt-found").textContent = `${matched} / ${pairsRound}`;
  const cc = $("mt-combo");
  cc.textContent = combo;
  cc.classList.remove("combo-pop"); void cc.offsetWidth; cc.classList.add("combo-pop");
  // rising two-tone + one spoken Spanish word per match
  snd(740, 0.06, 0.08);
  setTimeout(() => snd(988 + combo * 30, 0.06, 0.1), 70);
  speak(a.dataset.es);
  active().brain.report(a.dataset.es, { correct: true, weight: WEIGHT });
  saveNow();

  // one meaningful, non-nagging Pepe milestone per round
  if (!milestoneShown && (combo >= 3 || matched === Math.ceil(pairsRound / 2))) {
    milestoneShown = true;
    pepeChip($("mt-pepe"), combo >= 3 ? "¡Qué racha!" : "¡Vas a la mitad!", "excited", 2400);
  }

  if (matched === pairsRound) setTimeout(finish, 550);
}

function onMismatch(a, b) {
  combo = 0;
  $("mt-combo").textContent = "0";
  for (const el of [a, b]) if (el.dataset.side === "es") mismatches[el.dataset.es] = (mismatches[el.dataset.es] || 0) + 1;
  a.classList.add("wrong"); b.classList.add("wrong");
  snd(160, 0.05, 0.16, "sawtooth");
  lock = true;
  setTimeout(() => {
    for (const el of [a, b]) { el.classList.remove("revealed", "wrong"); }
    lock = false;
  }, 850);
}

function finish() {
  if (finished) return;                // award XP / bump stats exactly once
  finished = true;

  const brain = active().brain;
  for (const [es, n] of Object.entries(mismatches)) {
    if (n >= 3) brain.report(es, { correct: false, weight: WEIGHT });
  }
  const secs = Math.round((Date.now() - startTime) / 1000);
  const eff = Math.min(100, Math.round((pairsRound / moves) * 100));
  const perfect = moves === pairsRound;
  const xp = 30 + Math.max(0, pairsRound * 3 - moves) * 3 + maxCombo * 4;
  const { leveledUp } = addXP(xp);      // saved through profile/Brain

  const data = active().data;
  if (perfect) data.matchPerfect = true;
  const best = data.matchBest;
  if (!best || moves < best.moves || (moves === best.moves && secs < best.secs)) {
    data.matchBest = { moves, secs };
  }
  saveNow();
  if (deps.onSessionEnd) deps.onSessionEnd();

  // celebration + clear results
  fxPop("fx-confetti");
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => snd(f, 0.07, 0.14, "triangle"), i * 90));
  $("mt-over-title").textContent = perfect ? "¡PERFECTO!" : "¡ESO!";
  $("mt-over-stats").textContent =
    `+${xp} XP · ${pairsRound} pares · ${moves} movimientos · ${eff}%` +
    (data.matchBest ? ` · mejor: ${data.matchBest.moves}` : "") +
    (leveledUp ? " · ¡SUBISTE DE NIVEL!" : "");
  $("mt-over-pepe").textContent = PEPE_WINS[Math.floor(Math.random() * PEPE_WINS.length)];
  $("mt-over").classList.remove("hidden");
}
