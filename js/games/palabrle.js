// Palabrle — Wordle for Spanish vocab. Guess the word from its English clue.
// Letters compare accent-insensitively but ñ is its own letter.
// Daily mode (same word for everyone that day) + free play with weak words.

import { allWords } from "../customwords.js";
import { active, addXP, saveNow } from "../profile.js";
import { speak } from "../audio.js";

const TRIES = 6;
const WEIGHT = 0.6;
const KEY_ROWS = ["qwertyuiop", "asdfghjklñ", "zxcvbnm"];

let deps, bound = false;
const $ = (id) => document.getElementById(id);

let answer = null;     // word object
let target = "";       // normalized letters (ñ preserved)
let row = 0, guess = "", done = false, activeScreen = false, daily = false;

// lowercase + strip accents, keep ñ as its own letter
const ENYE = String.fromCharCode(1);
function letters(s) {
  s = s.toLowerCase().split("ñ").join(ENYE);
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.split(ENYE).join("ñ");
  return s.replace(/[^a-zñ]/g, "");
}

function eligible() {
  return allWords().filter((w) => {
    const l = letters(w.es);
    return l.length >= 4 && l.length <= 6 && !w.es.includes(" ") && l.length === w.es.length;
  });
}

export function initPalabrle(dependencies) {
  deps = dependencies;
  if (bound) return;
  bound = true;
  $("pl-quit").addEventListener("click", quit);
  $("pl-daily").addEventListener("click", () => startRound(true));
  $("pl-free").addEventListener("click", () => startRound(false));
  $("pl-again").addEventListener("click", () => { $("pl-over").classList.add("hidden"); startRound(false); });
  $("pl-back").addEventListener("click", quit);

  const kb = $("pl-keyboard");
  KEY_ROWS.forEach((rowStr, i) => {
    const rowEl = document.createElement("div");
    rowEl.className = "pl-krow";
    if (i === 2) rowEl.appendChild(key("ENTER", "wide", () => submit()));
    for (const ch of rowStr) rowEl.appendChild(key(ch, "", () => type(ch)));
    if (i === 2) rowEl.appendChild(key("⌫", "wide", () => backspace()));
    kb.appendChild(rowEl);
  });

  window.addEventListener("keydown", (e) => {
    if (!activeScreen || done) return;
    if (e.key === "Enter") submit();
    else if (e.key === "Backspace") backspace();
    else {
      const ch = e.key.toLowerCase();
      if (/^[a-zñ]$/.test(letters(ch))) type(letters(ch));
    }
  });
}

function key(label, cls, fn) {
  const b = document.createElement("button");
  b.className = "pl-key " + cls;
  b.textContent = label;
  b.dataset.key = label;
  b.addEventListener("click", fn);
  return b;
}

export function enterPalabrle() {
  activeScreen = true;
  startRound(true);
}

function quit() {
  activeScreen = false;
  $("pl-over").classList.add("hidden");
  deps.onExit();
}

function startRound(isDaily) {
  daily = isDaily;
  const pool = eligible();
  if (isDaily) {
    const dayNum = Math.floor(Date.now() / 86400000);
    answer = pool[dayNum % pool.length];
  } else {
    answer = active().brain.pickWeak(pool, 1)[0] || pool[Math.floor(Math.random() * pool.length)];
  }
  target = letters(answer.es);
  row = 0; guess = ""; done = false;
  $("pl-mode").textContent = isDaily ? "palabra del día" : "juego libre";
  $("pl-clue").textContent = `pista: ${answer.en[0]}`;
  $("pl-over").classList.add("hidden");

  const grid = $("pl-grid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${target.length}, 1fr)`;
  for (let i = 0; i < TRIES * target.length; i++) {
    const c = document.createElement("div");
    c.className = "pl-cell";
    grid.appendChild(c);
  }
  for (const k of document.querySelectorAll(".pl-key")) {
    k.classList.remove("k-hit", "k-near", "k-miss");
  }
}

function cells() { return $("pl-grid").children; }

function paintGuess() {
  const base = row * target.length;
  for (let i = 0; i < target.length; i++) {
    cells()[base + i].textContent = guess[i] || "";
  }
}

function type(ch) {
  if (done || guess.length >= target.length) return;
  guess += ch;
  paintGuess();
}
function backspace() {
  if (done) return;
  guess = guess.slice(0, -1);
  paintGuess();
}

function submit() {
  if (done || guess.length !== target.length) return;
  const base = row * target.length;
  const remaining = target.split("");
  const marks = new Array(target.length).fill("miss");
  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) { marks[i] = "hit"; remaining[i] = null; }
  }
  for (let i = 0; i < target.length; i++) {
    if (marks[i] !== "hit") {
      const j = remaining.indexOf(guess[i]);
      if (j !== -1) { marks[i] = "near"; remaining[j] = null; }
    }
  }
  for (let i = 0; i < target.length; i++) {
    cells()[base + i].classList.add("pl-" + marks[i]);
    const keyEl = document.querySelector(`.pl-key[data-key="${guess[i]}"]`);
    if (keyEl) {
      const rank = { "k-hit": 3, "k-near": 2, "k-miss": 1 };
      const cur = Object.keys(rank).find((c) => keyEl.classList.contains(c));
      const next = "k-" + marks[i];
      if (!cur || rank[next] > rank[cur]) {
        keyEl.classList.remove("k-hit", "k-near", "k-miss");
        keyEl.classList.add(next);
      }
    }
  }

  const won = guess === target;
  row++;
  guess = "";
  if (won || row >= TRIES) finish(won);
}

function finish(won) {
  done = true;
  const brain = active().brain;
  brain.report(answer.es, { correct: won, weight: WEIGHT });
  const data = active().data;
  let xp = 0;
  if (won) {
    data.palabrleWins = (data.palabrleWins || 0) + 1;
    xp = 20 + (TRIES - row) * 8;
    addXP(xp);
  } else {
    saveNow();
  }
  speak(answer.es);
  $("pl-over-title").textContent = won ? "¡ÉSO!" : "NI MODO…";
  $("pl-over-stats").textContent =
    `La palabra era "${answer.es}" (${answer.en[0]})` + (won ? ` · +${xp} XP` : "");
  $("pl-over").classList.remove("hidden");
  deps.onSessionEnd();
}
