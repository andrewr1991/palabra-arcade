// Ahorcado — hangman. Clue is the English meaning; guess the Spanish
// letters. Accent-insensitive (á counts as a), ñ is its own letter.
// Spelling recall: evidence weight 0.6.

import { allWords } from "../customwords.js";
import { active, addXP, saveNow } from "../profile.js";
import { speak } from "../audio.js";

const MAX_WRONG = 6;
const WEIGHT = 0.6;
const STAGES = ["😀", "🙂", "😐", "😟", "😰", "😱", "💀"];
const LETTERS = "abcdefghijklmnñopqrstuvwxyz";

let deps, bound = false;
const $ = (id) => document.getElementById(id);

let word = null, display = [], wrong = 0, done = false, activeScreen = false;

// strip accents but keep ñ distinct
const ENYE = String.fromCharCode(1);
function base(ch) {
  let s = ch.toLowerCase().split("ñ").join(ENYE);
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return s.split(ENYE).join("ñ");
}

export function initAhorcado(dependencies) {
  deps = dependencies;
  if (bound) return;
  bound = true;
  $("ah-quit").addEventListener("click", quit);
  $("ah-next").addEventListener("click", startRound);
  $("ah-back").addEventListener("click", quit);

  const kb = $("ah-keyboard");
  for (const ch of LETTERS) {
    const b = document.createElement("button");
    b.className = "ah-key";
    b.textContent = ch;
    b.dataset.letter = ch;
    b.addEventListener("click", () => guess(ch));
    kb.appendChild(b);
  }
  window.addEventListener("keydown", (e) => {
    if (!activeScreen || done) return;
    const ch = base(e.key);
    if (ch.length === 1 && LETTERS.includes(ch)) guess(ch);
  });
}

export function enterAhorcado() {
  activeScreen = true;
  startRound();
}

function quit() {
  activeScreen = false;
  $("ah-over").classList.add("hidden");
  deps.onExit();
}

function startRound() {
  $("ah-over").classList.add("hidden");
  const pool = allWords().filter((w) => !w.es.includes(" ") && base(w.es).length >= 4);
  word = active().brain.pickWeak(pool, 1)[0];
  display = [...word.es].map(() => false);
  wrong = 0;
  done = false;
  $("ah-clue").textContent = `pista: ${word.en[0]}`;
  $("ah-stage").textContent = STAGES[0];
  $("ah-wrong").textContent = `errores: 0 / ${MAX_WRONG}`;
  for (const k of document.querySelectorAll(".ah-key")) {
    k.classList.remove("used", "good", "bad");
    k.disabled = false;
  }
  paint();
}

function paint() {
  const el = $("ah-word");
  el.innerHTML = "";
  [...word.es].forEach((ch, i) => {
    const c = document.createElement("span");
    c.className = "ah-slot";
    c.textContent = display[i] ? ch : "_";
    el.appendChild(c);
  });
}

function guess(ch) {
  if (done) return;
  const keyEl = document.querySelector(`.ah-key[data-letter="${ch}"]`);
  if (keyEl && keyEl.classList.contains("used")) return;

  let hit = false;
  [...word.es].forEach((c, i) => {
    if (!display[i] && base(c) === ch) { display[i] = true; hit = true; }
  });
  if (keyEl) {
    keyEl.classList.add("used", hit ? "good" : "bad");
    keyEl.disabled = true;
  }
  if (!hit) {
    wrong++;
    $("ah-stage").textContent = STAGES[wrong];
    $("ah-wrong").textContent = `errores: ${wrong} / ${MAX_WRONG}`;
  }
  paint();

  if (display.every(Boolean)) finish(true);
  else if (wrong >= MAX_WRONG) finish(false);
}

function finish(won) {
  done = true;
  display = display.map(() => true);
  paint();
  const brain = active().brain;
  brain.report(word.es, { correct: won, weight: WEIGHT });
  const data = active().data;
  let xp = 0;
  if (won) {
    data.ahorcadoWins = (data.ahorcadoWins || 0) + 1;
    xp = 15 + (MAX_WRONG - wrong) * 4;
    addXP(xp);
  } else {
    saveNow();
  }
  speak(word.es);
  $("ah-over-title").textContent = won ? "¡TE SALVASTE!" : "NI MODO…";
  $("ah-over-stats").textContent =
    `La palabra era "${word.es}" (${word.en[0]})` + (won ? ` · +${xp} XP` : "");
  $("ah-over").classList.remove("hidden");
  deps.onSessionEnd();
}
