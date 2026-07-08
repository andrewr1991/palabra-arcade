// Palabra Arcade — hub, codex, taller, routing, profile UI.

import { CATEGORIES } from "./data/words.js";
import * as profile from "./profile.js";
import * as custom from "./customwords.js";
import { allWords } from "./customwords.js";
import { speak, speakButton, listSpanishVoices, currentVoice } from "./audio.js";
import { accentBar } from "./ui.js";
import { getSettings, setSetting, requestNotifyPermission } from "./settings.js";
import { t, applyStatic } from "./i18n.js";
import { ACHIEVEMENTS, checkAchievements } from "./achievements.js";
import { initBlaster, enterBlaster } from "./games/blaster.js";
import { initMatch, enterMatch } from "./games/match.js";
import { initLoteria, enterLoteria } from "./games/loteria.js";
import { initPalabrle, enterPalabrle } from "./games/palabrle.js";
import { initClasificador, enterClasificador } from "./games/clasificador.js";
import { initAhorcado, enterAhorcado } from "./games/ahorcado.js";
import { initStudy, enterNuevas, enterRepaso } from "./study.js";
import { initPlacement, enterPlacement } from "./placement.js";
import * as rec from "./recorder.js";
import { toast, fxPop, boop } from "./ui.js";
import { initPepe, hubTip } from "./pepe.js";
import { initSprites } from "./sprites.js";

const $ = (id) => document.getElementById(id);
const SCREENS = ["hub", "codex", "blaster", "match", "perfil",
  "loteria", "palabrle", "clasificador", "ahorcado", "nuevas", "repaso", "taller", "ajustes", "placement"];

function showScreen(name) {
  for (const s of SCREENS) $("screen-" + s).classList.toggle("hidden", s !== name);
  if (name === "hub") renderHub();
  if (name === "codex") renderCodex();
  if (name === "perfil") renderPerfil();
  if (name === "taller") renderTaller();
}

function onSessionEnd() {
  checkAchievements(profile.levelInfo);
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
  $("hub-streak").textContent =
    `🔥 ${p.data.streak || 0}` + ((p.data.freezes || 0) > 0 ? ` · 🧊 ${p.data.freezes}` : "");
  $("hub-placement").classList.toggle("hidden", p.brain.stats().known > 0);

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

  $("hub-blaster-high").textContent = p.data.blasterHigh ? `high score: ${p.data.blasterHigh}` : t("playFirst");
  $("hub-match-best").textContent = p.data.matchBest ? `mejor: ${p.data.matchBest.moves} mov.` : t("playFirst");
  $("hub-loteria-meta").textContent = p.data.loteriaWins ? `${p.data.loteriaWins} 🫘` : t("runFirst");
  $("hub-palabrle-meta").textContent = "reto diario · pronto";   // Próximamente (v1.1)
  $("hub-clasificador-meta").textContent = p.data.clasificadorBest ? `mejor: ${p.data.clasificadorBest} pts` : t("keys123");
  $("hub-ahorcado-meta").textContent = p.data.ahorcadoWins ? `${p.data.ahorcadoWins} 💀` : t("niModo");

  $("hub-repaso-meta").textContent = s.known ? `${Math.min(10, fading.length + s.learning)} ${t("cardsReady")}` : t("learnFirst");
  $("hub-nuevas-meta").textContent = s.new ? `${s.new} ${t("toDiscover")}` : t("allDiscovered");
  $("hub-taller-meta").textContent = custom.customWords().length
    ? `${custom.customWords().length} 🛠️`
    : t("addYours");

  renderProfileSelect();
  checkAchievements(profile.levelInfo);
  hubTip(s, fading.length, p.data.streak || 0);
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
    [t("wordsKnown"), `${s.known} / ${s.total}`],
    [t("mastered"), s.mastered, "gold"],
    [t("strong"), s.strong, "green"],
    [t("fadingLbl"), s.fading, s.fading ? "red" : ""],
    [t("accuracy"), acc],
    [t("totalAnswers"), ok + bad],
    [t("streakNow"), `🔥 ${d.streak || 0} ${d.streak === 1 ? t("day") : t("days")}`],
    [t("bestStreak"), `🔥 ${d.bestStreak || d.streak || 0}`],
    [t("blasterHigh"), d.blasterHigh || "—"],
    [t("matchBest"), d.matchBest ? `${d.matchBest.moves} mov.` : "—"],
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
    const words = allWords().filter((w) => w.cat === key);
    if (!words.length) continue;
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
  const seen = allWords().filter((w) => p.brain.info(w.es));
  const byStrength = [...seen].sort((a, b) => p.brain.strengthOf(a.es) - p.brain.strengthOf(b.es));
  fillWordList($("pf-weak"), byStrength.slice(0, 5), p, "weak");
  fillWordList($("pf-strong"), byStrength.slice(-5).reverse(), p, "strong");

  renderChart($("pf-chart-xp"), (day) => (d.history || {})[day] || 0, "");
  $("pf-chart-known").classList.add("pf-chart-known");
  renderChart($("pf-chart-known"), (day) => (d.knownLog || {})[day] ?? null, "carry");
  renderAchievements(d);
}

function renderChart(el, valueFor, mode) {
  el.innerHTML = "";
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 86400000);
    days.push({ key: dt.toISOString().slice(0, 10), label: dt.getDate() });
  }
  let carry = 0;
  const values = days.map((d) => {
    let v = valueFor(d.key);
    if (mode === "carry") {
      if (v === null) v = carry; else carry = v;
    }
    return v || 0;
  });
  const max = Math.max(1, ...values);
  days.forEach((d, i) => {
    const bar = document.createElement("div");
    bar.className = "pf-bar" + (i === days.length - 1 ? " today" : "");
    bar.title = `${d.key}: ${values[i]}`;
    bar.innerHTML = `<div class="pf-bar-fill"></div><span class="pf-bar-label"></span>`;
    bar.querySelector(".pf-bar-fill").style.height = Math.round((values[i] / max) * 100) + "%";
    bar.querySelector(".pf-bar-label").textContent = d.label;
    el.appendChild(bar);
  });
}

function renderAchievements(d) {
  const box = $("pf-achievements");
  box.innerHTML = "";
  const earned = d.achieved || {};
  const sorted = [...ACHIEVEMENTS].sort((a, b) => (earned[b.id] ? 1 : 0) - (earned[a.id] ? 1 : 0));
  for (const a of sorted) {
    const el = document.createElement("div");
    el.className = "ach" + (earned[a.id] ? "" : " locked");
    el.innerHTML = `<span class="ach-icon"></span><div><div class="ach-name"></div><div class="ach-desc"></div></div>`;
    el.querySelector(".ach-icon").textContent = a.icon;
    el.querySelector(".ach-name").textContent = a.name;
    el.querySelector(".ach-desc").textContent = a.desc;
    box.appendChild(el);
  }
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
  for (const w of allWords()) {
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
    const esEl = card.querySelector(".cx-es");
    esEl.textContent = w.es;
    esEl.appendChild(speakButton(w.es));
    card.querySelector(".cx-en").textContent = w.en[0];
    card.querySelector(".cx-fill").style.width = strength + "%";
    card.querySelector(".cx-status").textContent = st === "new" ? "?" : `${STATUS_LABEL[st]} · ${strength}%`;
    grid.appendChild(card);
  }
  $("cx-count").textContent = `${shown} palabras`;
}

// ── Taller (word pack editor) ────────────────────────────────────
function renderTaller() {
  const catSel = $("tw-cat");
  if (!catSel.options.length) {
    for (const [key, label] of Object.entries(CATEGORIES)) catSel.appendChild(new Option(label, key));
    catSel.value = "custom";
  }
  const dl = $("rc-words");
  if (!dl.children.length) for (const w of allWords()) dl.appendChild(new Option(w.es));
  refreshRecCount();
  const list = $("tw-list");
  list.innerHTML = "";
  const words = custom.customWords();
  $("tw-count").textContent = `${words.length} palabra${words.length === 1 ? "" : "s"} personalizada${words.length === 1 ? "" : "s"}`;
  for (const w of words) {
    const el = document.createElement("div");
    el.className = "tw-word";
    el.innerHTML = `<b></b><span></span><button class="tw-del" title="Eliminar">🗑</button>`;
    el.querySelector("b").textContent = (w.emo ? w.emo + " " : "") + w.es;
    el.querySelector("span").textContent = w.en.join(", ");
    el.querySelector(".tw-del").addEventListener("click", async () => {
      const sure = await askDialog(`¿Eliminar "${w.es}" de tu paquete?`);
      if (sure) { custom.removeCustom(w.es); renderTaller(); }
    });
    list.appendChild(el);
  }
}

function addTallerWord() {
  const es = $("tw-es").value.trim();
  const en = $("tw-en").value.split(",").map((s) => s.trim()).filter(Boolean);
  if (!es || !en.length) { askDialog("Se necesita la palabra y al menos un significado."); return; }
  const w = { es, en, cat: $("tw-cat").value || "custom" };
  const ejEs = $("tw-ej-es").value.trim(), ejEn = $("tw-ej-en").value.trim();
  if (ejEs) w.ej = [ejEs, ejEn || ""];
  const emo = $("tw-emo").value.trim();
  if (emo) w.emo = emo;
  try {
    custom.addCustom(w);
    for (const id of ["tw-es", "tw-en", "tw-ej-es", "tw-ej-en", "tw-emo"]) $(id).value = "";
    renderTaller();
  } catch (err) {
    askDialog(err.message);
  }
}

// ── Wire up ──────────────────────────────────────────────────────
profile.initProfiles();
const deps = { onExit: () => showScreen("hub"), onSessionEnd };
initBlaster(deps);
initMatch(deps);
initLoteria(deps);
initPalabrle(deps);
initClasificador(deps);
initAhorcado(deps);
initStudy(deps);
initPlacement(deps);
$("hub-placement").addEventListener("click", () => { showScreen("placement"); enterPlacement(); });

window.addEventListener("pa-levelup", (e) => {
  toast(`¡Subiste al nivel ${e.detail.level}! +1 🧊`, "🚀");
  fxPop("fx-levelup");
  setTimeout(() => fxPop("fx-confetti"), 250);
});
window.addEventListener("pa-freeze-used", () => toast("Un hielo salvó tu racha", "🧊"));

// arcade boop on cabinet hover (respects sfx volume)
for (const cab of document.querySelectorAll(".game-card.cab")) {
  cab.addEventListener("mouseenter", () => {
    const v = getSettings().sfxVol;
    if (v > 0) boop(0.05 * v);
  });
}

// ── Voz de la familia (recorder) ─────────────────────────────────
async function refreshRecCount() {
  const keys = await rec.listClips();
  $("rc-count").textContent = keys.length
    ? `${keys.length} grabación${keys.length === 1 ? "" : "es"}: ${keys.slice(0, 12).join(", ")}${keys.length > 12 ? "…" : ""}`
    : "aún no hay grabaciones";
}
$("rc-record").addEventListener("click", async () => {
  const word = $("rc-word").value.trim();
  if (!word) { askDialog("Escribe la palabra que vas a grabar."); return; }
  if (rec.isRecording()) {
    const blob = await rec.stopRecording();
    await rec.saveClip(word, blob);
    $("rc-record").textContent = "🎙 Grabar";
    $("rc-status").textContent = `"${word}" guardada ✓`;
    refreshRecCount();
  } else {
    try {
      await rec.startRecording();
      $("rc-record").textContent = "⏹ Detener";
      $("rc-status").textContent = "grabando…";
    } catch {
      askDialog("No se pudo acceder al micrófono.");
    }
  }
});
$("rc-play").addEventListener("click", () => {
  const word = $("rc-word").value.trim();
  if (word) speak(word);
});
$("rc-delete").addEventListener("click", async () => {
  const word = $("rc-word").value.trim();
  if (!word) return;
  await rec.deleteClip(word);
  $("rc-status").textContent = `"${word}" eliminada`;
  refreshRecCount();
});

$("aj-crt").addEventListener("change", (e) => {
  setSetting("crt", e.target.checked);
  document.body.classList.toggle("crt", e.target.checked);
});
document.body.classList.toggle("crt", getSettings().crt);

initPepe($("pepe-home"));
initSprites();

$("nav-logros").addEventListener("click", () => showScreen("perfil"));
$("nav-ajustes").addEventListener("click", () => { showScreen("ajustes"); renderAjustes(); });
$("nav-misiones").addEventListener("click", () =>
  askDialog("Misiones diarias — ¡próximamente! Está en la lista de pendientes."));
$("nav-tienda").addEventListener("click", () =>
  askDialog("La tienda abrirá cuando haya monedas que gastar. ¡Próximamente!"));

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

$("card-loteria").addEventListener("click", () => { showScreen("loteria"); enterLoteria(); });
// Palabrle is held for v1.1 — its cabinet shows "Próximamente" and is not playable yet
$("card-palabrle").addEventListener("click", () =>
  askDialog("Palabrle — ¡Próximamente! El reto diario de la palabra llega en una próxima actualización."));
// Clasificador is hidden from the launch flow (card has .launch-hidden); handler kept for easy re-enable
$("card-clasificador").addEventListener("click", () => { showScreen("clasificador"); enterClasificador(); });
$("card-ahorcado").addEventListener("click", () => { showScreen("ahorcado"); enterAhorcado(); });
$("card-nuevas").addEventListener("click", () => { showScreen("nuevas"); enterNuevas(); });
$("card-repaso").addEventListener("click", () => { showScreen("repaso"); enterRepaso(); });
$("card-taller").addEventListener("click", () => showScreen("taller"));
$("tw-back").addEventListener("click", () => showScreen("hub"));
$("tw-add").addEventListener("click", addTallerWord);
$("tw-export").addEventListener("click", custom.exportPack);
$("tw-import").addEventListener("click", () => $("tw-import-file").click());
$("tw-import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const added = custom.importPack(await file.text());
    askDialog(`Se agregaron ${added} palabra${added === 1 ? "" : "s"}.`);
    renderTaller();
  } catch (err) {
    askDialog("No se pudo importar: " + err.message);
  }
  e.target.value = "";
});

// accent helper under the blaster input (study screens add their own)
$("bl-input-bar").insertAdjacentElement("afterend", accentBar($("bl-answer")));

// ── Ajustes (settings) ───────────────────────────────────────────
function renderAjustes() {
  const cfg = getSettings();
  $("aj-crt").checked = !!cfg.crt;
  $("aj-sfx").value = Math.round(cfg.sfxVol * 100);
  $("aj-ttsvol").value = Math.round(cfg.ttsVol * 100);
  $("aj-ttsrate").value = Math.round(cfg.ttsRate * 100);
  $("aj-sfx-val").textContent = $("aj-sfx").value + "%";
  $("aj-ttsvol-val").textContent = $("aj-ttsvol").value + "%";
  $("aj-ttsrate-val").textContent = (cfg.ttsRate).toFixed(2) + "×";
  $("aj-lang").value = cfg.lang;
  $("aj-reminder").checked = cfg.reminderOn;
  $("aj-reminder-time").value = cfg.reminderTime;

  const sel = $("aj-voice");
  sel.innerHTML = "";
  const voices = listSpanishVoices();
  if (!voices.length) {
    sel.appendChild(new Option("(no hay voces en español)", ""));
  } else {
    const cur = currentVoice();
    for (const v of voices) {
      const opt = new Option(`${v.name} (${v.lang})`, v.voiceURI);
      if (cur && v.voiceURI === cur.voiceURI) opt.selected = true;
      sel.appendChild(opt);
    }
  }
}

$("btn-ajustes").addEventListener("click", () => { showScreen("ajustes"); renderAjustes(); });
$("aj-back").addEventListener("click", () => showScreen("hub"));
$("aj-sfx").addEventListener("input", (e) => {
  setSetting("sfxVol", e.target.value / 100);
  $("aj-sfx-val").textContent = e.target.value + "%";
});
$("aj-ttsvol").addEventListener("input", (e) => {
  setSetting("ttsVol", e.target.value / 100);
  $("aj-ttsvol-val").textContent = e.target.value + "%";
});
$("aj-ttsrate").addEventListener("input", (e) => {
  setSetting("ttsRate", e.target.value / 100);
  $("aj-ttsrate-val").textContent = (e.target.value / 100).toFixed(2) + "×";
});
$("aj-voice").addEventListener("change", (e) => { setSetting("voiceURI", e.target.value); speak("¡Órale! Así sueno yo."); });
$("aj-voice-test").addEventListener("click", () => speak("Mi esposa cocina mejor que yo. ¡Órale!"));
$("aj-lang").addEventListener("change", (e) => {
  setSetting("lang", e.target.value);
  applyStatic();
  renderHub();
});
$("aj-reminder").addEventListener("change", async (e) => {
  if (e.target.checked) {
    const perm = await requestNotifyPermission();
    if (perm !== "granted") { e.target.checked = false; return; }
  }
  setSetting("reminderOn", e.target.checked);
});
$("aj-reminder-time").addEventListener("change", (e) => setSetting("reminderTime", e.target.value));

applyStatic();

$("hub-profile-link").addEventListener("click", () => showScreen("perfil"));
$("pf-back").addEventListener("click", () => showScreen("hub"));
$("pf-export").addEventListener("click", profile.exportSave);
$("pf-rename").addEventListener("click", async () => {
  const name = await askDialog(t("renameProfile"), { input: true });
  if (name) { profile.renameProfile(name); renderPerfil(); }
});
$("pf-delete").addEventListener("click", async () => {
  if (profile.listProfiles().length <= 1) {
    askDialog(t("cantDeleteOnly"));
    return;
  }
  const sure = await askDialog(`${t("deleteConfirm")} "${profile.active().data.name}"? ${t("noUndo")}`);
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
