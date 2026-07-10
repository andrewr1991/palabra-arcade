// Lotería — Mexican bingo. The caller announces a Spanish word (voice first,
// text a moment later); find its picture on your tabla. Word→image recognition,
// no English involved. Evidence weight 0.5.

import { allWords } from "../customwords.js";
import { active, addXP, saveNow } from "../profile.js";
import { speak, canSpeak } from "../audio.js";
import { shuffle } from "../brain.js";
import { boop, fxPop } from "../ui.js";
import { getSettings } from "../settings.js";

const SIZE = 16;                 // 4×4 tabla
const WEIGHT = 0.5;
const CHEERS = ["¡Buena!", "¡Sí!", "¡Eso!", "¡Ándale!"];
const PEPE_WINS = [
  "¡Lotería! ¡Como en casa de la abuela!",
  "¡Qué buena tabla, campeón!",
  "¡Eso es! Puro ojo de águila. 🦅",
];
// win the moment any pattern fills — rows, columns, diagonals, four corners.
// Rounds end fast and feel like real bingo instead of a long blackout.
const LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12], [0, 3, 12, 15],
];

let deps, bound = false;
const $ = (id) => document.getElementById(id);

// chip-tone wrapper that respects the sfx volume setting
function snd(freq, vol = 0.06, dur = 0.1, type = "square") {
  const v = getSettings().sfxVol;
  if (v > 0) boop(vol * v, freq, dur, type);
}

// emoji → self-hosted Twemoji SVG filename (same rule as fetch_emoji.py):
// drop the FE0F variation selector unless the sequence has a ZWJ.
function emojiFile(emo) {
  const s = emo.indexOf("‍") < 0 ? emo.replace(/️/g, "") : emo;
  return [...s].map((c) => c.codePointAt(0).toString(16)).join("-");
}

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
  $("lt-repeat").addEventListener("click", () => {
    if (!current) return;
    speak(current.es);
    // the replay button also reveals the word on demand (safety net for TTS)
    $("lt-called").textContent = current.es;
    $("lt-called").classList.remove("lt-listening");
  });
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
    el.innerHTML = `<span class="lt-pic"><img class="lt-img" alt="" draggable="false"></span><span class="lt-word">· · ·</span>`;
    const img = el.querySelector(".lt-img");
    const emo = cell.word.emo;
    img.src = `assets/emoji/${emojiFile(emo)}.svg`;
    // if a custom-word emoji has no self-hosted SVG, fall back to the glyph
    img.addEventListener("error", () => { img.parentNode.classList.add("lt-pic-fallback"); img.parentNode.textContent = emo; });
    el.addEventListener("click", () => pick(cell, el));
    grid.appendChild(el);
  }
  $("lt-machine").classList.remove("lt-win-flash");
  updateStatus();
  callTimer = setTimeout(callNext, 900);
}

// reveal the called word with announcer drama: pop + panel glow + ding
function revealCalled() {
  const el = $("lt-called");
  el.textContent = current.es;
  el.classList.remove("lt-listening", "lt-pop");
  void el.offsetWidth;
  el.classList.add("lt-pop");
  const panel = $("lt-caller");
  panel.classList.remove("calling");
  void panel.offsetWidth;
  panel.classList.add("calling");
  snd(1175, 0.04, 0.07);
}

function callNext() {
  if (!playing) return;
  current = queue[0] || null;
  if (!current) return;
  clearTimeout(revealTimer);
  speak(current.es);
  if (canSpeak()) {
    // audio-first (listening practice): hear it, then reveal the text shortly
    // after — the reveal always fires, so a silent/failed voice can't stall play
    $("lt-called").textContent = "…";
    $("lt-called").classList.add("lt-listening");
    revealTimer = setTimeout(() => {
      if (!playing || !current) return;
      revealCalled();
    }, 1300);
  } else {
    // no voice available — reveal immediately so it plays as a reading game
    revealCalled();
  }
}

function pick(cell, el) {
  if (!playing || cell.marked || !current) return;
  const brain = active().brain;
  if (cell.word.es === current.es) {
    cell.marked = true;
    el.classList.add("marked", "lt-hit");
    setTimeout(() => el.classList.remove("lt-hit"), 400);
    el.querySelector(".lt-word").textContent = cell.word.es;
    // frijolito stamp + floating cheer + rising two-tone
    const stamp = document.createElement("span");
    stamp.className = "lt-stamp";
    stamp.textContent = "🫘";
    el.appendChild(stamp);
    const cheer = document.createElement("span");
    cheer.className = "lt-cheer";
    cheer.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    el.appendChild(cheer);
    setTimeout(() => cheer.remove(), 950);
    snd(740, 0.06, 0.08);
    setTimeout(() => snd(988, 0.06, 0.1), 70);
    brain.report(cell.word.es, { correct: true, weight: WEIGHT });
    saveNow();
    queue.shift();
    updateStatus();
    const line = winningLine();
    if (line) { win(line); return; }
    callTimer = setTimeout(callNext, 600);
  } else {
    mistakes++;
    updateStatus();
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    snd(160, 0.05, 0.16, "sawtooth");   // gentle buzz, not a punishment
    brain.report(current.es, { correct: false, weight: 0.3 });
    saveNow();
  }
}

function winningLine() {
  for (const line of LINES) if (line.every((i) => board[i].marked)) return line;
  return null;
}

function updateStatus() {
  const marked = board.filter((c) => c.marked).length;
  $("lt-progress").textContent = marked;
  $("lt-mistakes").textContent = mistakes;
}

function win(line) {
  playing = false;
  clearTimeout(callTimer);
  clearTimeout(revealTimer);
  const marked = board.filter((c) => c.marked).length;
  const xp = Math.max(25, 70 - mistakes * 5);
  const data = active().data;
  data.loteriaWins = (data.loteriaWins || 0) + 1;
  const { leveledUp } = addXP(xp);

  // light up the winning line and reveal every tile's word (a mini review)
  const cards = $("lt-grid").children;
  board.forEach((c, i) => { cards[i].querySelector(".lt-word").textContent = c.word.es; });
  if (line) line.forEach((i) => cards[i].classList.add("lt-win-cell"));

  // arcade payoff: marquee flash, confetti + star burst, victory arpeggio
  $("lt-machine").classList.add("lt-win-flash");
  fxPop("fx-confetti");
  setTimeout(() => fxPop("fx-starburst"), 300);
  [523, 659, 784, 1047, 1319].forEach((f, i) =>
    setTimeout(() => snd(f, 0.07, 0.15, "triangle"), i * 90));
  speak("¡Lotería!");

  // let the win land before the over-screen slides up
  setTimeout(() => {
    $("lt-over-stats").textContent =
      `${marked} marcadas · ${mistakes} error${mistakes === 1 ? "" : "es"} · +${xp} XP${leveledUp ? " · ¡SUBISTE DE NIVEL!" : ""}`;
    $("lt-over-pepe").textContent = PEPE_WINS[Math.floor(Math.random() * PEPE_WINS.length)];
    $("lt-over").classList.remove("hidden");
  }, 1100);
  deps.onSessionEnd();
}
