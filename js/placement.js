// Placement test — 12 quick multiple-choice questions for new profiles.
// Correct answers seed the brain as already-known so a 2-year learner
// doesn't start at "el gato".

import { allWords } from "./customwords.js";
import { active, addXP } from "./profile.js";
import { shuffle, norm } from "./brain.js";
import { speak } from "./audio.js";

const COUNT = 12;
const $ = (id) => document.getElementById(id);
let deps, bound = false;
let quiz = [], idx = 0, known = 0;

export function initPlacement(dependencies) {
  deps = dependencies;
  if (bound) return;
  bound = true;
  $("pt-skip").addEventListener("click", () => deps.onExit());
  $("pt-done").addEventListener("click", () => deps.onExit());
}

export function enterPlacement() {
  // spread across categories: shuffle then dedupe by cat first pass
  const pool = shuffle([...allWords()]);
  const byCat = [], seen = new Set();
  for (const w of pool) if (!seen.has(w.cat)) { byCat.push(w); seen.add(w.cat); }
  quiz = [...byCat, ...pool.filter((w) => !byCat.includes(w))].slice(0, COUNT);
  idx = 0; known = 0;
  $("pt-result").classList.add("hidden");
  $("pt-quiz").classList.remove("hidden");
  showQuestion();
}

function showQuestion() {
  const w = quiz[idx];
  $("pt-progress").textContent = `${idx + 1} / ${COUNT}`;
  $("pt-word").textContent = w.es;
  speak(w.es);
  const wrong = shuffle(allWords().filter(
    (x) => x.es !== w.es && norm(x.en[0]) !== norm(w.en[0])
  )).slice(0, 3);
  const box = $("pt-options");
  box.innerHTML = "";
  for (const opt of shuffle([w, ...wrong])) {
    const b = document.createElement("button");
    b.className = "nv-option";
    b.textContent = opt.en[0];
    b.addEventListener("click", () => answer(opt === w, b, w));
    box.appendChild(b);
  }
  const idk = document.createElement("button");
  idk.className = "nv-option nv-any";
  idk.textContent = "no la conozco 🤷";
  idk.addEventListener("click", () => answer(false, null, w));
  box.appendChild(idk);
}

function answer(correct, btn, w) {
  if (correct) { known++; active().brain.seedKnown(w.es); if (btn) btn.classList.add("nv-right"); }
  else if (btn) btn.classList.add("nv-wrong");
  for (const b of document.querySelectorAll("#pt-options .nv-option")) b.disabled = true;
  setTimeout(() => {
    idx++;
    if (idx < quiz.length) showQuestion();
    else finish();
  }, correct ? 400 : 700);
}

function finish() {
  // extrapolate: fraction known × total words, seeded ones are exact
  addXP(known * 3);
  $("pt-quiz").classList.add("hidden");
  $("pt-result").classList.remove("hidden");
  $("pt-result-stats").textContent =
    `Reconociste ${known} de ${COUNT}. Empiezas con ${active().brain.stats().known} palabras marcadas como conocidas — los juegos se ajustan solos.`;
  deps.onSessionEnd();
}
