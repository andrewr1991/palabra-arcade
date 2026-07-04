// Lotería — Mexican bingo. The caller announces a Spanish word (voice first,
// text a moment later); find its picture on your tabla. Word→image recognition,
// no English involved. Evidence weight 0.5.

import { allWords } from "../customwords.js";
import { active, addXP, saveNow } from "../profile.js";
import { speak } from "../audio.js";
import { shuffle } from "../brain.js";

const SIZE = 16;
const WEIGHT = 0.5;

let deps, bound = false;
const $ = (id) => document.getElementById(id);

let board = [];        // { word, marked }
let queue = [];        // words yet to be called
let current = null;    // word being called
let mistakes = 0, revealTimer = null, callTimer = null, playing = false;

export function initLoteria(dependencies) {
  deps = dependencies;
  if (bound) return;
  bound = true;
  $("lt-quit").addEventListener("click", quit);
  $("lt-again").addEventListener("click", startRound);
  $("lt-back").addEventListener("click", quit);
  $("lt-repeat").addEventListener("click", () => { if (current) speak(current.es); });
}

export function enterLoteria() { startRound(); }

function quit() {
  playing = false;
  clearTimeout(revealTimer);
  clearTimeout(callTimer);
  $("lt-over").classList.add("hidden");
  deps.onExit();
}

function startRound() {
  $("lt-over").classList.add("hidden");
  playing = true;
  mistakes = 0;
  const brain = active().brain;
  const pool = allWords().filter((w) => w.emo);
  board = brain.pickWeak(pool, SIZE).map((word) => ({ word, marked: false }));
  queue = shuffle([...board.map((b) => b.word)]);
  current = null;

  const grid = $("lt-grid");
  grid.innerHTML = "";
  for (const cell of board) {
    const el = document.createElement("button");
    el.className = "lt-card";
    el.dataset.es = cell.word.es;
    el.innerHTML = `<span class="lt-emo"></span><span class="lt-word"></span>`;
    el.querySelector(".lt-emo").textContent = cell.word.emo;
    el.addEventListener("click", () => pick(cell, el));
    grid.appendChild(el);
  }
  updateStatus();
  callTimer = setTimeout(callNext, 900);
}

function callNext() {
  if (!playing) return;
  current = queue[0] || null;
  if (!current) return;
  $("lt-called").textContent = "…";
  $("lt-called").classList.add("lt-listening");
  speak(current.es);
  // audio-first: show the written word a beat later
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    if (!playing || !current) return;
    $("lt-called").textContent = current.es;
    $("lt-called").classList.remove("lt-listening");
  }, 1400);
}

function pick(cell, el) {
  if (!playing || cell.marked || !current) return;
  const brain = active().brain;
  if (cell.word.es === current.es) {
    cell.marked = true;
    el.classList.add("marked");
    el.querySelector(".lt-word").textContent = cell.word.es;
    brain.report(cell.word.es, { correct: true, weight: WEIGHT });
    saveNow();
    queue.shift();
    updateStatus();
    if (board.every((c) => c.marked)) { win(); return; }
    callTimer = setTimeout(callNext, 700);
  } else {
    mistakes++;
    updateStatus();
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    brain.report(current.es, { correct: false, weight: 0.3 });
    saveNow();
  }
}

function updateStatus() {
  const marked = board.filter((c) => c.marked).length;
  $("lt-progress").textContent = `${marked} / ${SIZE}`;
  $("lt-mistakes").textContent = mistakes;
}

function win() {
  playing = false;
  const xp = Math.max(20, 60 - mistakes * 5);
  const data = active().data;
  data.loteriaWins = (data.loteriaWins || 0) + 1;
  const { leveledUp } = addXP(xp);
  speak("¡Lotería!");
  $("lt-over-stats").textContent =
    `${mistakes} error${mistakes === 1 ? "" : "es"} · +${xp} XP${leveledUp ? " · ¡LEVEL UP!" : ""}`;
  $("lt-over").classList.remove("hidden");
  deps.onSessionEnd();
}
