// Palabra Arcade — hub, codex, routing, profile UI.

import { WORDS, CATEGORIES } from "./data/words.js";
import * as profile from "./profile.js";
import { initBlaster, enterBlaster } from "./games/blaster.js";
import { initMatch, enterMatch } from "./games/match.js";

const $ = (id) => document.getElementById(id);
const SCREENS = ["hub", "codex", "blaster", "match"];

function showScreen(name) {
  for (const s of SCREENS) $("screen-" + s).classList.toggle("hidden", s !== name);
  if (name === "hub") renderHub();
  if (name === "codex") renderCodex();
}

// ── Hub ──────────────────────────────────────────────────────────
function renderHub() {
  const p = profile.active();
  const { level, into, need } = profile.levelInfo();

  $("hub-avatar").textContent = p.data.name.slice(0, 2).toUpperCase();
  $("hub-name").textContent = p.data.name;
  $("hub-level").textContent = `Nivel ${level}`;
  $("hub-xpbar").style.width = Math.round((into / need) * 100) + "%";
  $("hub-xptext").textContent = `${into} / ${need} XP`;
  $("hub-streak").textContent = p.data.streak > 0 ? `🔥 ${p.data.streak}` : "🔥 0";

  const s = p.brain.stats();
  $("hub-stats").innerHTML = "";
  const chips = [
    ["known", `${s.known} / ${s.total} palabras`, ""],
    ["mastered", `${s.mastered} dominadas`, "chip-gold"],
    ["strong", `${s.strong} fuertes`, "chip-green"],
    ["learning", `${s.learning} aprendiendo`, "chip-cyan"],
  ];
  for (const [, label, cls] of chips) {
    const el = document.createElement("span");
    el.className = "chip " + cls;
    el.textContent = label;
    $("hub-stats").appendChild(el);
  }

  const fading = p.brain.fadingWords();
  const alert = $("hub-fading");
  if (fading.length) {
    alert.classList.remove("hidden");
    const sample = fading.slice(0, 3).map((w) => w.es).join(", ");
    $("hub-fading-text").textContent =
      `${fading.length} palabra${fading.length > 1 ? "s" : ""} se te est${fading.length > 1 ? "án" : "á"} olvidando: ` +
      `${sample}${fading.length > 3 ? "…" : ""} — cualquier juego las incluirá.`;
  } else {
    alert.classList.add("hidden");
  }

  $("hub-blaster-high").textContent = p.data.blasterHigh ? `high score: ${p.data.blasterHigh}` : "juega tu primera partida";
  $("hub-match-best").textContent = p.data.matchBest ? `mejor: ${p.data.matchBest.moves} movimientos` : "juega tu primera partida";

  renderProfileSelect();
}

function renderProfileSelect() {
  const sel = $("profile-select");
  sel.innerHTML = "";
  for (const prof of profile.listProfiles()) {
    const opt = document.createElement("option");
    opt.value = prof.id;
    opt.textContent = prof.name;
    if (prof.id === profile.active().id) opt.selected = true;
    sel.appendChild(opt);
  }
  const newOpt = document.createElement("option");
  newOpt.value = "__new__";
  newOpt.textContent = "+ nuevo perfil";
  sel.appendChild(newOpt);
}

// ── Codex ────────────────────────────────────────────────────────
const STATUS_LABEL = {
  new: "nueva", learning: "aprendiendo", strong: "fuerte",
  mastered: "dominada", fading: "olvidándose",
};

function renderCodex() {
  const p = profile.active();
  const s = p.brain.stats();
  $("cx-summary").textContent =
    `${s.known} de ${s.total} palabras conocidas · ${s.mastered} dominadas · ` +
    `${s.strong} fuertes · ${s.learning} aprendiendo · ${s.fading} olvidándose`;

  const catSel = $("cx-cat");
  if (!catSel.options.length) {
    catSel.appendChild(new Option("todas las categorías", ""));
    for (const [key, label] of Object.entries(CATEGORIES)) catSel.appendChild(new Option(label, key));
  }
  renderCodexGrid();
}

function renderCodexGrid() {
  const p = profile.active();
  const cat = $("cx-cat").value;
  const status = $("cx-status").value;
  const grid = $("cx-grid");
  grid.innerHTML = "";
  let shown = 0;
  for (const w of WORDS) {
    if (cat && w.cat !== cat) continue;
    const st = p.brain.statusOf(w.es);
    if (status && st !== status) continue;
    shown++;
    const strength = p.brain.strengthOf(w.es);
    const card = document.createElement("div");
    card.className = `cx-card cx-${st}`;
    card.innerHTML = `
      <div class="cx-es"></div>
      <div class="cx-en"></div>
      <div class="cx-meter"><div class="cx-fill"></div></div>
      <div class="cx-status"></div>`;
    card.querySelector(".cx-es").textContent = w.es;
    card.querySelector(".cx-en").textContent = w.en[0];
    card.querySelector(".cx-fill").style.width = strength + "%";
    card.querySelector(".cx-status").textContent = st === "new" ? "?" : `${STATUS_LABEL[st]} · ${strength}%`;
    grid.appendChild(card);
  }
  $("cx-count").textContent = `${shown} palabras`;
}

// ── Wire up ──────────────────────────────────────────────────────
profile.initProfiles();
initBlaster({ onExit: () => showScreen("hub") });
initMatch({ onExit: () => showScreen("hub") });

$("card-blaster").addEventListener("click", () => { showScreen("blaster"); enterBlaster(); });
$("card-match").addEventListener("click", () => { showScreen("match"); enterMatch(); });
$("card-codex").addEventListener("click", () => showScreen("codex"));
$("cx-back").addEventListener("click", () => showScreen("hub"));
$("cx-cat").addEventListener("change", renderCodexGrid);
$("cx-status").addEventListener("change", renderCodexGrid);

// In-page dialog — native prompt()/alert() hang embedded previews
function askDialog(msg, { input = false } = {}) {
  return new Promise((resolve) => {
    const dlg = $("app-dialog");
    $("dialog-msg").textContent = msg;
    const inp = $("dialog-input");
    inp.classList.toggle("hidden", !input);
    inp.value = "";
    dlg.returnValue = "cancel";
    dlg.onclose = () => resolve(dlg.returnValue === "ok" ? (input ? inp.value.trim() : true) : null);
    dlg.showModal();
    if (input) inp.focus();
  });
}

$("profile-select").addEventListener("change", async (e) => {
  if (e.target.value === "__new__") {
    const name = await askDialog("Nombre del nuevo perfil:", { input: true });
    if (name) profile.createProfile(name);
  } else {
    profile.loadProfile(e.target.value);
  }
  renderHub();
});

$("btn-export").addEventListener("click", profile.exportSave);
$("btn-import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    profile.importSave(await file.text());
    renderHub();
  } catch (err) {
    askDialog("No se pudo importar: " + err.message);
  }
  e.target.value = "";
});

showScreen("hub");

// debug handle for testing
window.PA = { profile, brain: () => profile.active().brain, showScreen };
