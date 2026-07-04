// Palabra Arcade — hub, codex, routing, profile UI.

import { WORDS, CATEGORIES } from "./data/words.js";
import * as profile from "./profile.js";
import { initBlaster, enterBlaster } from "./games/blaster.js";
import { initMatch, enterMatch } from "./games/match.js";

const $ = (id) => document.getElementById(id);
const SCREENS = ["hub", "codex", "blaster", "match", "perfil"];

function showScreen(name) {
  for (const s of SCREENS) $("screen-" + s).classList.toggle("hidden", s !== name);
  if (name === "hub") renderHub();
  if (name === "codex") renderCodex();
  if (name === "perfil") renderPerfil();
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

// ── Perfil ───────────────────────────────────────────────────────
function renderPerfil() {
  const p = profile.active();
  const d = p.data;
  const { level, into, need } = profile.levelInfo();

  $("pf-avatar").textContent = d.name.slice(0, 2).toUpperCase();
  $("pf-name").textContent = d.name;
  $("pf-level").textContent = `Nivel ${level}`;
  $("pf-xpbar").style.width = Math.round((into / need) * 100) + "%";
  $("pf-xptext").textContent = `${into} / ${need} XP para el nivel ${level + 1} · ${d.xp} XP en total`;
  $("pf-created").textContent = d.created
    ? "miembro desde " + new Date(d.created).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  // global answer stats derived from the brain — no separate bookkeeping
  let ok = 0, bad = 0;
  for (const rec of Object.values(p.brain.state.words)) { ok += rec.ok; bad += rec.bad; }
  const s = p.brain.stats();
  const acc = ok + bad ? Math.round((ok / (ok + bad)) * 100) + "%" : "—";

  const metrics = [
    ["palabras conocidas", `${s.known} / ${s.total}`],
    ["dominadas", s.mastered, "gold"],
    ["fuertes", s.strong, "green"],
    ["olvidándose", s.fading, s.fading ? "red" : ""],
    ["precisión global", acc],
    ["respuestas totales", ok + bad],
    ["racha actual", `🔥 ${d.streak || 0} día${d.streak === 1 ? "" : "s"}`],
    ["mejor racha", `🔥 ${d.bestStreak || d.streak || 0}`],
    ["high score — blaster", d.blasterHigh || "—"],
    ["mejor memoria", d.matchBest ? `${d.matchBest.moves} mov.` : "—"],
  ];
  $("pf-metrics").innerHTML = "";
  for (const [label, value, tone] of metrics) {
    const card = document.createElement("div");
    card.className = "pf-card" + (tone ? " pf-" + tone : "");
    card.innerHTML = `<span class="pf-label"></span><span class="pf-value"></span>`;
    card.querySelector(".pf-label").textContent = label;
    card.querySelector(".pf-value").textContent = value;
    $("pf-metrics").appendChild(card);
  }

  // per-category progress
  const cats = $("pf-cats");
  cats.innerHTML = "";
  for (const [key, label] of Object.entries(CATEGORIES)) {
    const words = WORDS.filter((w) => w.cat === key);
    const known = words.filter((w) => p.brain.statusOf(w.es) !== "new").length;
    const mastered = words.filter((w) => p.brain.statusOf(w.es) === "mastered").length;
    const pct = Math.round((known / words.length) * 100);
    const row = document.createElement("div");
    row.className = "pf-cat-row";
    row.innerHTML = `
      <span class="pf-cat-name"></span>
      <div class="pf-cat-track"><div class="pf-cat-fill"></div></div>
      <span class="pf-cat-count"></span>`;
    row.querySelector(".pf-cat-name").textContent = label;
    row.querySelector(".pf-cat-fill").style.width = pct + "%";
    row.querySelector(".pf-cat-fill").classList.toggle("full-gold", mastered === words.length && words.length > 0);
    row.querySelector(".pf-cat-count").textContent = `${known}/${words.length}`;
    cats.appendChild(row);
  }

  // weakest / strongest seen words
  const seen = WORDS.filter((w) => p.brain.info(w.es));
  const byStrength = [...seen].sort((a, b) => p.brain.strengthOf(a.es) - p.brain.strengthOf(b.es));
  fillWordList($("pf-weak"), byStrength.slice(0, 5), p, "weak");
  fillWordList($("pf-strong"), byStrength.slice(-5).reverse(), p, "strong");
}

function fillWordList(el, words, p, tone) {
  el.innerHTML = "";
  if (!words.length) {
    el.innerHTML = `<span class="muted">juega algo primero</span>`;
    return;
  }
  for (const w of words) {
    const row = document.createElement("div");
    row.className = "pf-word " + tone;
    row.innerHTML = `<b></b><span></span><em></em>`;
    row.querySelector("b").textContent = w.es;
    row.querySelector("span").textContent = w.en[0];
    row.querySelector("em").textContent = p.brain.strengthOf(w.es) + "%";
    el.appendChild(row);
  }
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

$("hub-profile-link").addEventListener("click", () => showScreen("perfil"));
$("pf-back").addEventListener("click", () => showScreen("hub"));
$("pf-export").addEventListener("click", profile.exportSave);
$("pf-rename").addEventListener("click", async () => {
  const name = await askDialog("Nuevo nombre del perfil:", { input: true });
  if (name) { profile.renameProfile(name); renderPerfil(); }
});
$("pf-delete").addEventListener("click", async () => {
  if (profile.listProfiles().length <= 1) {
    askDialog("No puedes eliminar el único perfil.");
    return;
  }
  const sure = await askDialog(`¿Eliminar el perfil "${profile.active().data.name}"? Esta acción no se puede deshacer.`);
  if (sure) {
    profile.deleteProfile(profile.active().id);
    showScreen("hub");
  }
});

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
