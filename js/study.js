// Estudio — the learning pillar.
// Palabras nuevas: interactive intro — meet the word, then type it yourself,
// then a mini-quiz seeds all five into the brain.
// Repaso: SRS flashcard review of what's due.

import { allWords } from "./customwords.js";
import { CATEGORIES } from "./data/words.js";
import { active, addXP, saveNow } from "./profile.js";
import { shuffle, norm, answerSetFor, inputMatches } from "./brain.js";
import { speak } from "./audio.js";
import { accentBar } from "./ui.js";
import { t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
let deps, bound = false;

export function initStudy(dependencies) {
  deps = dependencies;
  if (bound) return;
  bound = true;

  // Palabras nuevas
  $("nv-quit").addEventListener("click", quitNuevas);
  $("nv-next").addEventListener("click", () => startTypeStep());
  $("nv-speak").addEventListener("click", () => nv.word && speak(nv.word.es));
  $("nv-type-speak").addEventListener("click", () => nv.word && speak(nv.word.es));
  $("nv-type-input").addEventListener("keydown", (e) => { if (e.key === "Enter") checkTyped(); });
  $("nv-type-check").addEventListener("click", checkTyped);
  $("nv-type-continue").addEventListener("click", nextIntro);
  $("nv-again").addEventListener("click", () => { $("nv-over").classList.add("hidden"); showCatPicker(); });
  $("nv-back").addEventListener("click", () => { $("nv-over").classList.add("hidden"); deps.onExit(); });
  $("nv-type-zone").appendChild(accentBar($("nv-type-input")));

  // Repaso
  $("rp-quit").addEventListener("click", quitRepaso);
  $("rp-speak").addEventListener("click", () => rp.card && speak(rp.card.es));
  $("rp-input").addEventListener("keydown", (e) => { if (e.key === "Enter") submitRepaso(); });
  $("rp-nose").addEventListener("click", () => resolveRepaso(false));
  $("rp-continue").addEventListener("click", nextRepaso);
  $("rp-again").addEventListener("click", () => { $("rp-over").classList.add("hidden"); enterRepaso(); });
  $("rp-back").addEventListener("click", quitRepaso);
  $("rp-answer-zone").appendChild(accentBar($("rp-input")));
}

// ═══ Palabras nuevas ═════════════════════════════════════════════
const INTRO_COUNT = 5;
const SEED_WEIGHT = 0.3;
let nv = { phase: "pick", words: [], idx: 0, word: null, quiz: [], quizIdx: 0, quizOk: 0, typedOk: 0 };

export function enterNuevas() { showCatPicker(); }

// Salir inside a session returns to the category picker, not the hub
function quitNuevas() {
  if (nv.phase !== "pick") { showCatPicker(); return; }
  deps.onExit();
}

function hideAll() {
  for (const id of ["nv-picker", "nv-card", "nv-type", "nv-quiz", "nv-over"]) $(id).classList.add("hidden");
}

function showCatPicker() {
  nv = { phase: "pick", words: [], idx: 0, word: null, quiz: [], quizIdx: 0, quizOk: 0, typedOk: 0 };
  hideAll();
  $("nv-picker").classList.remove("hidden");
  $("nv-progress").textContent = "";
  const brain = active().brain;
  const picker = $("nv-picker");
  picker.innerHTML = "";
  const cats = Object.entries(CATEGORIES).filter(([key]) =>
    allWords().some((w) => w.cat === key && !brain.info(w.es)));
  if (!cats.length) {
    picker.innerHTML = `<p class="muted">¡Ya conoces todas las palabras! Agrega más en el Taller.</p>`;
    return;
  }
  for (const [key, label] of cats) {
    const fresh = allWords().filter((w) => w.cat === key && !brain.info(w.es)).length;
    const b = document.createElement("button");
    b.className = "nv-cat";
    b.innerHTML = `<span></span><small></small>`;
    b.querySelector("span").textContent = label;
    b.querySelector("small").textContent = `${fresh} nuevas`;
    b.addEventListener("click", () => startIntro(key));
    picker.appendChild(b);
  }
  const any = document.createElement("button");
  any.className = "nv-cat nv-any";
  any.innerHTML = `<span>Sorpréndeme</span><small>mezcla de todo</small>`;
  any.addEventListener("click", () => startIntro(null));
  picker.appendChild(any);
}

function startIntro(cat) {
  const brain = active().brain;
  const pool = allWords().filter((w) => !brain.info(w.es) && (!cat || w.cat === cat));
  nv.words = shuffle([...pool]).slice(0, INTRO_COUNT);
  if (!nv.words.length) { showCatPicker(); return; }
  nv.idx = 0;
  nv.phase = "intro";
  showIntro();
}

function showIntro() {
  hideAll();
  $("nv-card").classList.remove("hidden");
  const w = nv.words[nv.idx];
  nv.word = w;
  $("nv-progress").textContent = `${nv.idx + 1} / ${nv.words.length}`;
  $("nv-es").textContent = w.es;
  $("nv-en").textContent = w.en.join(", ");
  $("nv-ej-es").textContent = w.ej ? w.ej[0] : "";
  $("nv-ej-en").textContent = w.ej ? w.ej[1] : "";
  speak(w.es);
}

// step 2: produce it — type the word you just met
function startTypeStep() {
  hideAll();
  $("nv-type").classList.remove("hidden");
  const w = nv.word;
  $("nv-type-prompt").textContent = `${t("typeWord")} "${w.en[0]}"?`;
  $("nv-type-ej").textContent = w.ej ? w.ej[0].replace(new RegExp(escapeReg(w.es), "i"), "_____") : "";
  $("nv-type-input").value = "";
  $("nv-type-feedback").textContent = "";
  $("nv-type-feedback").className = "nv-type-feedback";
  $("nv-type-input").disabled = false;
  $("nv-type-check").classList.remove("hidden");
  $("nv-type-continue").classList.add("hidden");
  $("nv-type-input").focus();
  speak(w.es);
}

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function checkTyped() {
  const typed = $("nv-type-input").value;
  if (!typed.trim()) return;
  const ok = norm(typed) === norm(nv.word.es);
  if (ok) nv.typedOk++;
  const fb = $("nv-type-feedback");
  fb.textContent = ok ? `✓ ${t("typed")}` : `✗ ${t("typedWrong")} ${nv.word.es}`;
  fb.className = "nv-type-feedback " + (ok ? "nv-fb-good" : "nv-fb-bad");
  $("nv-type-input").disabled = true;
  $("nv-type-check").classList.add("hidden");
  $("nv-type-continue").classList.remove("hidden");
  $("nv-type-continue").focus();
  if (!ok) speak(nv.word.es);
}

function nextIntro() {
  nv.idx++;
  if (nv.idx < nv.words.length) { showIntro(); return; }
  startQuiz();
}

function startQuiz() {
  nv.phase = "quiz";
  nv.quiz = shuffle([...nv.words]);
  nv.quizIdx = 0;
  nv.quizOk = 0;
  hideAll();
  $("nv-quiz").classList.remove("hidden");
  showQuiz();
}

function showQuiz() {
  const w = nv.quiz[nv.quizIdx];
  nv.word = w;
  $("nv-quiz-progress").textContent = `${nv.quizIdx + 1} / ${nv.quiz.length}`;
  $("nv-quiz-word").textContent = w.es;
  speak(w.es);
  // exclude words whose display translation collides (saber/conocer both "to know")
  const wrongOpts = shuffle(allWords().filter(
    (x) => x.es !== w.es && norm(x.en[0]) !== norm(w.en[0])
  )).slice(0, 3);
  const options = shuffle([w, ...wrongOpts]);
  const box = $("nv-options");
  box.innerHTML = "";
  for (const opt of options) {
    const b = document.createElement("button");
    b.className = "nv-option";
    b.textContent = opt.en[0];
    b.addEventListener("click", () => answerQuiz(opt === w, b));
    box.appendChild(b);
  }
}

function answerQuiz(correct, btn) {
  const brain = active().brain;
  brain.report(nv.word.es, { correct, weight: SEED_WEIGHT });
  saveNow();
  if (correct) {
    nv.quizOk++;
    btn.classList.add("nv-right");
  } else {
    btn.classList.add("nv-wrong");
    for (const b of document.querySelectorAll(".nv-option")) {
      if (b.textContent === nv.word.en[0]) b.classList.add("nv-right");
    }
  }
  for (const b of document.querySelectorAll(".nv-option")) b.disabled = true;
  setTimeout(() => {
    nv.quizIdx++;
    if (nv.quizIdx < nv.quiz.length) showQuiz();
    else finishNuevas();
  }, correct ? 600 : 1400);
}

function finishNuevas() {
  const xp = 30 + nv.quizOk * 4 + nv.typedOk * 3;
  const { leveledUp } = addXP(xp);
  hideAll();
  nv.phase = "pick";
  $("nv-over-stats").textContent =
    `${nv.words.length} palabras nuevas · escritas ${nv.typedOk}/${nv.words.length} · quiz ${nv.quizOk}/${nv.quiz.length} · +${xp} XP${leveledUp ? " · ¡LEVEL UP!" : ""}`;
  $("nv-over").classList.remove("hidden");
  deps.onSessionEnd();
}

// ═══ Repaso ══════════════════════════════════════════════════════
const DECK_SIZE = 10;
const REVIEW_WEIGHT = 0.8;
let rp = { deck: [], card: null, retried: new Set(), firstTryOk: 0, total: 0 };

export function enterRepaso() {
  const brain = active().brain;
  const seen = allWords().filter((w) => brain.info(w.es));
  if (!seen.length) {
    $("rp-empty").classList.remove("hidden");
    $("rp-play").classList.add("hidden");
    $("rp-over").classList.add("hidden");
    return;
  }
  $("rp-empty").classList.add("hidden");
  $("rp-play").classList.remove("hidden");
  $("rp-over").classList.add("hidden");

  const fading = seen.filter((w) => brain.statusOf(w.es) === "fading");
  const rest = seen.filter((w) => brain.statusOf(w.es) !== "fading")
    .sort((a, b) => brain.strengthOf(a.es) - brain.strengthOf(b.es));
  rp.deck = [...shuffle(fading), ...rest].slice(0, DECK_SIZE);
  rp.retried = new Set();
  rp.firstTryOk = 0;
  rp.total = rp.deck.length;
  nextRepaso();
}

function quitRepaso() {
  $("rp-over").classList.add("hidden");
  deps.onExit();
}

function nextRepaso() {
  $("rp-reveal").classList.add("hidden");
  $("rp-answer-zone").classList.remove("hidden");
  const w = rp.deck.shift();
  if (!w) { finishRepaso(); return; }
  rp.card = w;
  $("rp-progress").textContent = `quedan ${rp.deck.length + 1}`;
  $("rp-es").textContent = w.es;
  $("rp-input").value = "";
  $("rp-input").focus();
  speak(w.es);
}

function submitRepaso() {
  const text = $("rp-input").value;
  if (!text.trim()) return;
  resolveRepaso(inputMatches(text, answerSetFor(rp.card, false)));
}

function resolveRepaso(correct) {
  const brain = active().brain;
  const w = rp.card;
  brain.report(w.es, { correct, weight: REVIEW_WEIGHT });
  saveNow();
  if (correct && !rp.retried.has(w.es)) rp.firstTryOk++;
  $("rp-answer-zone").classList.add("hidden");
  $("rp-reveal").classList.remove("hidden");
  $("rp-reveal").className = "rp-reveal " + (correct ? "rp-good" : "rp-bad");
  $("rp-result").textContent = correct ? "✓ ¡Bien!" : "✗ La respuesta:";
  $("rp-en").textContent = w.en.join(", ");
  $("rp-ej").textContent = w.ej ? `${w.ej[0]} — ${w.ej[1]}` : "";
  if (!correct && !rp.retried.has(w.es)) {
    rp.retried.add(w.es);
    rp.deck.push(w); // it comes back at the end of the deck
  }
}

function finishRepaso() {
  const xp = rp.firstTryOk * 5;
  const { leveledUp } = addXP(xp); // always: streak counts even on a rough day
  $("rp-play").classList.add("hidden");
  $("rp-over-stats").textContent =
    `${rp.firstTryOk} / ${rp.total} a la primera · +${xp} XP${leveledUp ? " · ¡LEVEL UP!" : ""}`;
  $("rp-over").classList.remove("hidden");
  deps.onSessionEnd();
}
