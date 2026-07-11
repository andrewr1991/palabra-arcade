// Memoria — game #2. Flip cards to pair Spanish words with English
// meanings. Reports recognition-level evidence to the brain (weight 0.4),
// proving cross-game knowledge tracking.

import { active, addXP, saveNow } from "../profile.js";
import { shuffle } from "../brain.js";

const PAIRS = 10;
const WEIGHT = 0.4;

let deps, bound = false;
const $ = (id) => document.getElementById(id);

let first = null, lock = false, moves = 0, matched = 0, startTime = 0, pairsRound = PAIRS;
let mismatches = {};   // es → count of wrong pairings this round
let finished = false;  // ensures the round's XP is awarded exactly once

export function initMatch(dependencies) {
  deps = dependencies;
  if (bound) return;
  bound = true;
  $("mt-quit").addEventListener("click", () => deps.onExit());
  $("mt-again").addEventListener("click", startRound);
  $("mt-back").addEventListener("click", () => {
    $("mt-over").classList.add("hidden");
    deps.onExit();
  });
}

export function enterMatch() { startRound(); }

function startRound() {
  $("mt-over").classList.add("hidden");
  first = null; lock = false; moves = 0; matched = 0; mismatches = {};
  finished = false;                    // guard: XP is awarded once per round
  startTime = Date.now();
  $("mt-moves").textContent = "0";
  $("mt-found").textContent = `0 / ${PAIRS}`;

  // over-fetch, then drop words whose English display collides
  // (saber/conocer are both "to know" — two identical cards would be unfair)
  const fetched = active().brain.requestWords(PAIRS * 2, { newCount: 4 });
  const seenEn = new Set();
  const words = [];
  for (const w of fetched) {
    const en = w.en[0].toLowerCase();
    if (seenEn.has(en)) continue;
    seenEn.add(en);
    words.push(w);
    if (words.length === PAIRS) break;
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
  grid.innerHTML = "";
  for (const c of cards) {
    const el = document.createElement("button");
    el.className = "mcard";
    el.dataset.pair = c.pair;
    el.dataset.side = c.side;
    el.dataset.es = c.es;
    el.textContent = "?";
    el._label = c.label;
    el.addEventListener("click", () => flip(el));
    grid.appendChild(el);
  }
}

function flip(el) {
  if (lock || el.classList.contains("revealed") || el.classList.contains("matched")) return;
  reveal(el);
  if (!first) { first = el; return; }

  moves++;
  $("mt-moves").textContent = moves;
  const a = first, b = el;
  first = null;

  if (a.dataset.pair === b.dataset.pair && a.dataset.side !== b.dataset.side) {
    a.classList.add("matched");
    b.classList.add("matched");
    matched++;
    $("mt-found").textContent = `${matched} / ${pairsRound}`;
    active().brain.report(a.dataset.es, { correct: true, weight: WEIGHT });
    saveNow();
    if (matched === pairsRound) finish();
  } else {
    // pairing a Spanish card with the wrong meaning is weak "wrong" evidence
    for (const c of [a, b]) {
      if (c.dataset.side === "es") mismatches[c.dataset.es] = (mismatches[c.dataset.es] || 0) + 1;
    }
    lock = true;
    setTimeout(() => {
      unreveal(a);
      unreveal(b);
      lock = false;
    }, 900);
  }
}

function reveal(el) {
  el.classList.add("revealed", el.dataset.side === "es" ? "side-es" : "side-en");
  el.textContent = el._label;
}
function unreveal(el) {
  el.classList.remove("revealed", "side-es", "side-en");
  el.textContent = "?";
}

function finish() {
  if (finished) return;                // award XP / bump stats only once
  finished = true;

  const brain = active().brain;
  for (const [es, n] of Object.entries(mismatches)) {
    if (n >= 3) brain.report(es, { correct: false, weight: WEIGHT });
  }
  const secs = Math.round((Date.now() - startTime) / 1000);
  const xp = 40 + Math.max(0, pairsRound * 3 - moves) * 3;
  const { leveledUp } = addXP(xp);      // saved through profile/Brain

  const data = active().data;
  if (moves === pairsRound) data.matchPerfect = true;
  const best = data.matchBest;
  if (!best || moves < best.moves || (moves === best.moves && secs < best.secs)) {
    data.matchBest = { moves, secs };
  }
  saveNow();
  if (deps.onSessionEnd) deps.onSessionEnd();

  // clear completion summary — XP earned is front and centre
  $("mt-over-stats").textContent =
    `+${xp} XP · ${moves} movimientos · ${secs}s` +
    (data.matchBest ? ` · mejor: ${data.matchBest.moves}` : "") +
    (leveledUp ? " · ¡SUBISTE DE NIVEL!" : "");
  $("mt-over").classList.remove("hidden");
}
