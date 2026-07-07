// Palabra Blaster — game #1. Words come from the shared brain;
// every hit/miss reports back as typed-recall evidence (weight 1).

import { BOSS_VERBS, BOSS_PERSONS, BOSS_TENSES } from "../data/words.js";
import { norm, answerSetFor, inputMatches } from "../brain.js";
import { active, addXP, saveNow } from "../profile.js";
import { getSettings } from "../settings.js";
import { allWords } from "../customwords.js";

const W = 900, H = 640;
let canvas, ctx, deps, bound = false;

// ── Sprites (sliced from the art-direction sheet) ────────────────
const art = {};                 // name -> HTMLImageEl once loaded
const SHIP_KEY = "ship-blue";
const ENEMY_ART = {
  normal:   ["enemy-green", "enemy-lime"],
  learning: ["enemy-orange", "enemy-pink"],
  reverse:  ["enemy-cyan", "enemy-blue"],
  armored:  ["enemy-redoct", "enemy-red"],
  bonus:    ["enemy-purple"],
};
const KIND_COLOR = {
  normal: "#6abe30", learning: "#e8722a", reverse: "#4fa4e8",
  armored: "#e04f4f", bonus: "#f7b32b",
  shield: "#4fa4e8", slow: "#c98a3a", double: "#6abe30",
};
const KIND_GLOW = {
  normal: "rgba(106,190,48,0.45)", learning: "rgba(232,114,42,0.5)",
  reverse: "rgba(79,164,232,0.45)", armored: "rgba(224,79,79,0.5)",
  bonus: "rgba(247,179,43,0.65)",
};
const PU_ICON = { shield: "pu-shield", slow: "pu-clock", double: "pu-double" };
const BOSS_ART = ["boss-fortress", "boss-octopus", "boss-skull"];
function loadArt() {
  if (loadArt.done) return;
  loadArt.done = true;
  const names = ["ship-blue", "ship-red", "ship-orange", "ship-green",
    "enemy-green", "enemy-lime", "enemy-cyan", "enemy-blue", "enemy-redoct", "enemy-red",
    "enemy-orange", "enemy-pink", "enemy-purple",
    "pu-shield", "pu-clock", "pu-double", ...BOSS_ART];
  for (const n of names) {
    const img = new Image();
    img.onload = () => { art[n] = img; };
    img.src = `assets/blaster/${n}.png`;
  }
}
loadArt();   // begin loading at import time so first game has art ready
// draw a loaded sprite centered on (x,y) at a target height; false if not ready
function drawArt(name, x, y, targetH) {
  const img = art[name];
  if (!img || !img.naturalWidth) return false;
  const s = targetH / img.naturalHeight;
  const w = img.naturalWidth * s;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - w / 2, y - targetH / 2, w, targetH);
  return true;
}
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

const $ = (id) => document.getElementById(id);
let ui = null;

// ── Audio ────────────────────────────────────────────────────────
let actx = null;
function tone(freq, dur, type = "square", vol = 0.08, delay = 0) {
  if (active().data.muted) return;
  vol *= getSettings().sfxVol;
  if (vol <= 0) return;
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur);
}
const sfx = {
  shoot() { tone(880, 0.08, "square", 0.05); tone(1320, 0.1, "square", 0.04, 0.03); },
  kill() { tone(523, 0.07, "triangle", 0.09); tone(784, 0.09, "triangle", 0.08, 0.05); tone(1047, 0.12, "triangle", 0.07, 0.1); },
  wrong() { tone(160, 0.18, "sawtooth", 0.07); },
  hurt() { tone(120, 0.3, "sawtooth", 0.12); tone(90, 0.35, "sawtooth", 0.1, 0.1); },
  wave() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "triangle", 0.08, i * 0.09)); },
  combo(c) { tone(440 + Math.min(c, 30) * 28, 0.07, "square", 0.045); },
  life() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, "triangle", 0.09, i * 0.07)); },
  bossHit() { tone(220, 0.1, "square", 0.1); tone(440, 0.12, "square", 0.08, 0.05); },
  bossDie() { [784, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, "triangle", 0.09, i * 0.1)); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "triangle", 0.09, i * 0.22)); },
};

// ── State ────────────────────────────────────────────────────────
const BANNERS = ["¡Órale!", "¡Ándale!", "¡Qué padre!", "¡Aguas!", "¡Éso!", "¡No manches!", "¡Vámonos!", "¡Chido!"];
const game = {
  running: false,
  state: "idle", pausedFrom: "playing",
  wave: 0, score: 0, lives: 3, combo: 0, bestCombo: 0,
  endless: false,
  enemies: [], queue: [], spawnTimer: 0, spawnInterval: 2.5,
  bannerTimer: 0, boss: null,
  session: { correct: 0, wrong: 0, landed: 0, missed: new Map() },
  shake: 0,
  sessionWrong: new Set(),
  sessionHits: {}, time: 0, clearDelay: null, waveWrong: 0, waveLanded: 0,
  fx: { shieldCharges: 0, doubleUntil: 0, slowUntil: 0 },
};

window.__blaster = game; // debug/test handle

const ship = { x: W / 2, y: H - 46 };
const lasers = [], particles = [], popups = [], rings = [];
const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * W, y: Math.random() * H,
  r: Math.random() * 1.4 + 0.3, v: Math.random() * 12 + 4,
}));

function multiplier() { return 1 + Math.min(4, Math.floor(game.combo / 5)) * 0.5; }

// ── Brain integration ────────────────────────────────────────────
// A word's difficulty TIER this run: 2 = tough (armored), 1 = learning,
// 0 = easy. It starts from how weak the word is, then DROPS by how many
// times you've already blasted it this session — so words visibly
// downgrade as you master them, worth less each time.
function baseDifficulty(es) {
  const brain = active().brain;
  if (game.sessionWrong.has(es)) return 2;
  const rec = brain.info(es);
  const status = brain.statusOf(es);
  if (status === "fading" || (rec && rec.bad > rec.ok)) return 2;
  if (status === "new" || status === "learning" || (rec && rec.ok < 3)) return 1;
  return 0;
}
function wordTier(es) {
  const t = baseDifficulty(es) - (game.sessionHits[es] || 0);
  return Math.max(0, Math.min(2, t));
}
function recordHit(es) {
  game.sessionHits[es] = (game.sessionHits[es] || 0) + 1;
  active().brain.report(es, { correct: true, weight: 1 });
  saveNow();
}
function recordMiss(es) {
  active().brain.report(es, { correct: false, weight: 1 });
  game.sessionWrong.add(es);
  saveNow();
}

// pick the next word for a (multi-hit) enemy. Heart enemies demand words
// you haven't met yet; everything else pulls from the brain's weak set.
function nextWordFor(special) {
  const brain = active().brain;
  if (special === "heart") {
    const fresh = allWords().filter((w) => brain.statusOf(w.es) === "new");
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
  }
  const pool = brain.requestWords(8, { newCount: special ? 2 : 1 });
  return pool[Math.floor(Math.random() * pool.length)];
}
// (re)assign the word an enemy currently shows
function setEnemyWord(e, word, reverse) {
  e.word = word;
  e.reverse = reverse;
  e.display = reverse ? word.en[0] : word.es;
  e.hint = !active().brain.info(word.es) ? (reverse ? word.es : word.en[0]) : null;
  ctx.font = "700 17px 'Segoe UI', sans-serif";
  e.w = Math.max(74, ctx.measureText(e.display).width + 40);
  e.answerSet = answerSetFor(word, reverse);
}
function enemyColor(e) {
  if (e.special && KIND_COLOR[e.special]) return KIND_COLOR[e.special];
  return KIND_COLOR[e.kind] || "#6abe30";
}

// ── Waves ────────────────────────────────────────────────────────
function pickWaveWords(count) {
  const words = active().brain.requestWords(count, { newCount: Math.ceil(count * 0.15) });
  return words.map((w) => ({ word: w }));
}

function startWave(n) {
  game.wave = n;
  game.enemies = [];
  lasers.length = 0;
  game.clearDelay = null;
  game.waveWrong = 0;
  game.waveLanded = 0;
  ui.wave.textContent = `Wave ${n}`;
  if (n % 5 === 0) { startBoss(n); return; }
  game.state = "playing";
  const count = 6 + n * 2;
  const reverseChance = n >= 3 ? 0.25 : 0;
  game.queue = pickWaveWords(count).map((p) => ({
    ...p, reverse: Math.random() < reverseChance,
  }));
  // special enemies (word-less: they source their own words):
  //   heart — only when you've lost a life, grants one back
  //   power-up — rare, 3 words to crack, grants a timed boost
  const specials = [];
  if (game.lives < 5 && Math.random() < 0.4) specials.push("heart");
  if (n >= 2 && Math.random() < 0.3) specials.push(pick(["shield", "slow", "double"]));
  for (const sp of specials) {
    const at = Math.min(game.queue.length, 2 + Math.floor(Math.random() * Math.max(1, game.queue.length - 2)));
    game.queue.splice(at, 0, { special: sp });
  }
  game.spawnInterval = Math.max(0.9, 3.1 - n * 0.2);
  game.spawnTimer = 1.2;
  showBanner(`WAVE ${n} — ${BANNERS[(n - 1) % BANNERS.length]}`);
  sfx.wave();
}

function showBanner(text) {
  ui.bannerText.textContent = text;
  ui.banner.classList.remove("hidden");
  game.bannerTimer = 2.0;
}

// mechanical toughness (armor / multi-hit) is gated by wave so early
// levels stay gentle for everyone regardless of vocabulary
const ARMOR_FROM_WAVE = 4;

function spawnEnemy(entry) {
  const special = entry.special || null;
  let reverse = !!entry.reverse;
  let word = entry.word || nextWordFor(special);
  if (!entry.word) reverse = false;            // sourced words shown ES→EN

  // reward tier (familiarity) drives colour + points; it only becomes an
  // armored, multi-hit *threat* once the player has a few waves of footing
  const tier = special ? 0 : wordTier(word.es);
  const armored = !special && tier === 2 && game.wave >= ARMOR_FROM_WAVE;
  const hp = special === "heart" ? 2
    : special ? 3
    : armored ? (game.wave >= 8 ? 3 : 2) : 1;
  const kind = special === "heart" ? "bonus"
    : special ? special
    : reverse ? "reverse"
    : tier === 2 ? "armored"
    : tier === 1 ? "learning" : "normal";
  const perHit = special === "heart" ? 12 : special ? 14
    : ([10, 18, 30][tier] + (reverse ? 6 : 0));
  // speed comes mostly from the wave; only genuine armored foes get a bump
  const tierSpeed = special === "heart" ? 1.6 : special ? 1.25 : armored ? 1.2 : 1;
  const speed = (16 + game.wave * 3.5) * (0.85 + Math.random() * 0.3) * tierSpeed;

  ctx.font = "700 17px 'Segoe UI', sans-serif";
  const display = reverse ? word.en[0] : word.es;
  const w = Math.max(74, ctx.measureText(display).width + 40);

  const enemy = {
    word, reverse, display, w, kind, tier, armored, special,
    hp, hpMax: hp, points: perHit, flash: 0,
    // brand-new words show a first-exposure hint so beginners learn by doing
    hint: !active().brain.info(word.es) ? (reverse ? word.es : word.en[0]) : null,
    icon: PU_ICON[special] || null,
    art: special && special !== "heart" ? null : pick(ENEMY_ART[kind]),
    x: 40 + w / 2 + Math.random() * (W - 80 - w),
    y: -20, speed,
    wobble: Math.random() * Math.PI * 2,
  };
  enemy.answerSet = answerSetFor(word, reverse);
  game.enemies.push(enemy);
}

// ── Boss ─────────────────────────────────────────────────────────
function startBoss(n) {
  game.state = "boss";
  game.boss = {
    hp: 6 + (n / 5) * 2, maxHp: 6 + (n / 5) * 2,
    x: W / 2, y: 120, t: 0,
    art: BOSS_ART[(Math.floor(n / 5) - 1) % BOSS_ART.length],
    promptTime: Math.max(6, 13 - n * 0.3),
    verb: null, tense: null, personIdx: 0, timeLeft: 0,
  };
  nextBossPrompt();
  showBanner("JEFE — BOSS FIGHT");
  ui.wave.textContent = `Wave ${n} — BOSS`;
  sfx.wave();
}
function nextBossPrompt() {
  const b = game.boss;
  b.verb = BOSS_VERBS[Math.floor(Math.random() * BOSS_VERBS.length)];
  b.tense = BOSS_TENSES[Math.floor(Math.random() * BOSS_TENSES.length)];
  b.personIdx = Math.floor(Math.random() * BOSS_PERSONS.length);
  b.timeLeft = b.promptTime;
}
function bossAnswer() {
  const b = game.boss;
  return b.verb[b.tense][b.personIdx];
}

// ── Scoring / lives ──────────────────────────────────────────────
// score per kill = base × tier-multiplier + a flat combo bonus that
// grows with your streak (every chained kill is worth +1 more, capped).
function addScore(base, x, y, color) {
  const bonus = Math.min(game.combo, 25);
  const dbl = game.fx.doubleUntil > game.time ? 2 : 1;
  const pts = Math.round(base * multiplier() * dbl) + bonus;
  game.score += pts;
  ui.score.textContent = game.score;
  const txt = bonus > 0 ? `+${pts} (+${bonus})` : `+${pts}`;
  popups.push({ x, y, text: txt, t: 1, color });
  game.combo++;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  if (game.combo >= 3) sfx.combo(game.combo);
  // milestone flourish at every 5th kill of a streak
  if (game.combo % 5 === 0) {
    const cheer = game.combo >= 20 ? "¡IMPARABLE!" : game.combo >= 15 ? "¡EN LLAMAS! 🔥"
      : game.combo >= 10 ? "¡QUÉ RACHA!" : "¡COMBO ×5!";
    popups.push({ x: W / 2, y: 180, text: `${cheer}  (${game.combo})`, t: 1.3, color: "#f7b32b" });
  }
  updateCombo();
}
function updateCombo() {
  if (game.combo >= 3) {
    ui.combo.textContent = `COMBO ×${multiplier()}  +${Math.min(game.combo, 25)}`;
    ui.combo.classList.remove("hidden");
  } else ui.combo.classList.add("hidden");
}
function breakCombo() { game.combo = 0; updateCombo(); }

function loseLife() {
  game.lives--;
  game.shake = 0.4;
  ui.lives.textContent = "❤️".repeat(Math.max(0, game.lives));
  sfx.hurt();
  breakCombo();
  explode(ship.x, ship.y - 10, "#ff5d5d", 26);
  if (game.lives <= 0) endGame(false);
}
function gainLife() {
  if (game.lives >= 5) return false;
  game.lives++;
  ui.lives.textContent = "❤️".repeat(game.lives);
  popups.push({ x: ship.x, y: ship.y - 40, text: "+1 ❤️", t: 1.2, color: "#ff8fa3" });
  return true;
}

// ── Effects ──────────────────────────────────────────────────────
// styles: 0 burst · 1 ring+spray · 2 starburst spokes · 3 confetti pop · 4 implode
function explode(x, y, color, n = 16, style = Math.floor(Math.random() * 4)) {
  const CONFETTI = ["#6abe30", "#4fa4e8", "#f7b32b", "#e04f4f", "#9b6de0", "#e8722a"];
  if (style === 1 || style === 2) rings.push({ x, y, r: 4, max: 46, life: 0.45, color });
  for (let i = 0; i < n; i++) {
    let a, sp, life, size, c = color, vx, vy;
    if (style === 2) {                       // starburst: 8 sharp spokes
      a = (Math.PI * 2 * (i % 8)) / 8 + (Math.random() - 0.5) * 0.15;
      sp = 150 + Math.random() * 90; life = 0.4 + Math.random() * 0.25; size = 2 + Math.random() * 2;
    } else if (style === 3) {                 // confetti pop: colorful, floaty
      a = Math.random() * Math.PI * 2; sp = 60 + Math.random() * 130;
      life = 0.7 + Math.random() * 0.5; size = 2 + Math.random() * 3; c = CONFETTI[i % CONFETTI.length];
    } else if (style === 4) {                 // implode: particles rush inward then out
      a = Math.random() * Math.PI * 2; const r = 34 + Math.random() * 16;
      particles.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        vx: -Math.cos(a) * 150, vy: -Math.sin(a) * 150,
        life: 0.4 + Math.random() * 0.3, color: c, size: 1.5 + Math.random() * 2, grav: 0 });
      continue;
    } else {                                  // burst (default)
      a = Math.random() * Math.PI * 2; sp = 40 + Math.random() * 160;
      life = 0.5 + Math.random() * 0.4; size = 1.5 + Math.random() * 2.5;
    }
    vx = Math.cos(a) * sp; vy = Math.sin(a) * sp;
    particles.push({ x, y, vx, vy, life, color: c, size, grav: style === 3 ? 1 : 1 });
  }
}
function fireLaser(tx, ty) {
  lasers.push({ x1: ship.x, y1: ship.y - 18, x2: tx, y2: ty, t: 0.15 });
}

// ── Input ────────────────────────────────────────────────────────
function submitAnswer() {
  const text = ui.input.value;
  if (!text.trim()) return;
  ui.input.value = "";
  if (game.state === "boss") { submitBossAnswer(text); return; }
  if (game.state !== "playing") return;
  // ignore input during the brief wave-clear delay (no enemies to hit)
  if (game.clearDelay != null && !game.enemies.length) return;

  let target = null;
  for (const e of game.enemies) {
    if (inputMatches(text, e.answerSet) && (!target || e.y > target.y)) target = e;
  }
  if (target) hitEnemy(target);
  else wrongAnswer();
}

// one correct answer against an enemy: score it, then either load the
// next word (multi-hit) or destroy the enemy and fire its payload.
function hitEnemy(e) {
  const col = enemyColor(e);
  fireLaser(e.x, e.y);
  sfx.shoot();
  addScore(e.points, e.x, e.y - 4, "#ffd166");
  recordHit(e.word.es);
  game.session.correct++;
  const tierBefore = e.tier;
  e.hp--;

  if (e.hp > 0) {                              // crack a layer, next word
    explode(e.x, e.y - 18, col, 9, 2);
    sfx.bossHit();
    e.flash = 0.3;
    const next = nextWordFor(e.special);
    setEnemyWord(e, next, false);
    popups.push({ x: e.x, y: e.y - 34, text: "¡otra!", t: 0.8, color: col });
    return;
  }

  // destroyed
  game.enemies.splice(game.enemies.indexOf(e), 1);
  explode(e.x, e.y, col);
  sfx.kill();
  if (e.special === "heart") {
    if (gainLife()) { explode(e.x, e.y, "#f7b32b", 30, 3); sfx.life(); }
  } else if (e.special) {
    applyPowerUp(e.special, e.x, e.y);
  } else if (tierBefore >= 1 && wordTier(e.word.es) < tierBefore) {
    popups.push({ x: e.x, y: e.y - 18, text: "¡la dominas! ↓", t: 1.6, color: "#6abe30" });
  }
  maybeEndWave();
}

const PU_LABEL = { shield: "¡ESCUDO! 🛡", slow: "¡LENTO! ⏱", double: "¡DOBLE! ×2" };
function applyPowerUp(type, x, y) {
  if (type === "shield") game.fx.shieldCharges += 1;
  else if (type === "double") game.fx.doubleUntil = game.time + 12;
  else if (type === "slow") game.fx.slowUntil = game.time + 8;
  explode(x, y, KIND_COLOR[type], 34, 3);
  sfx.life();
  popups.push({ x: W / 2, y: 120, text: PU_LABEL[type], t: 2, color: KIND_COLOR[type] });
}

// start the short delay before advancing, so the final kill animates
function maybeEndWave() {
  if (game.state === "playing" && !game.queue.length &&
      !game.enemies.length && game.clearDelay == null) {
    game.clearDelay = 0.7;
  }
}

function submitBossAnswer(text) {
  const b = game.boss;
  if (norm(text) === norm(bossAnswer())) {
    b.hp--;
    fireLaser(b.x, b.y + 30);
    explode(b.x + (Math.random() * 120 - 60), b.y + 20, "#ffd166", 14);
    addScore(40, b.x, b.y + 60, "#ffd166");
    game.session.correct++;
    sfx.bossHit();
    if (b.hp <= 0) {
      explode(b.x, b.y, "#ffd166", 60);
      explode(b.x, b.y, "#ff5d5d", 40);
      sfx.bossDie();
      game.boss = null;
      gainLife();
      waveCleared();
    } else nextBossPrompt();
  } else {
    wrongAnswer();
  }
}

function wrongAnswer() {
  game.session.wrong++;
  game.waveWrong++;
  breakCombo();
  sfx.wrong();
  ui.inputBar.classList.remove("wrong");
  void ui.inputBar.offsetWidth;
  ui.inputBar.classList.add("wrong");
}

// ── Flow ─────────────────────────────────────────────────────────
function waveCleared() {
  // perfect wave: no wrong answers and nothing reached the bottom → +1 life
  if (game.waveWrong === 0 && game.waveLanded === 0) {
    if (gainLife()) {
      showBanner("¡OLEADA PERFECTA! +❤️");
      explode(ship.x, ship.y - 30, "#f7b32b", 40, 3);
      sfx.life();
    }
  }
  if (game.wave === 10 && !game.endless) {
    active().data.blasterVictory = true;
    saveNow();
    game.state = "victory";
    ui.victoryStats.textContent = `Score ${game.score} · Best combo ${game.bestCombo} · ${game.session.correct} words blasted`;
    ui.victory.classList.remove("hidden");
    return;
  }
  startWave(game.wave + 1);
}

function endGame(won) {
  game.state = "over";
  sfx.gameOver();
  const data = active().data;
  if (game.score > data.blasterHigh) data.blasterHigh = game.score;
  const xp = Math.round(game.score / 10);
  game.xpAwarded = true;
  const { leveledUp } = addXP(xp);
  const s = game.session;
  const answered = s.correct + s.wrong + s.landed;
  const acc = answered ? Math.round((s.correct / answered) * 100) : 0;
  ui.overTitle.textContent = won ? "¡QUÉ PADRE!" : "GAME OVER";
  ui.overStats.textContent =
    `Score ${game.score} (best ${data.blasterHigh}) · Wave ${game.wave} · ` +
    `Accuracy ${acc}% · +${xp} XP${leveledUp ? " · ¡LEVEL UP!" : ""}`;
  if (s.missed.size) {
    ui.overReview.classList.remove("hidden");
    ui.overMissed.innerHTML = "";
    for (const [es, w] of s.missed) {
      const div = document.createElement("div");
      div.className = "missed-word";
      div.innerHTML = `<b></b> <span></span>`;
      div.querySelector("b").textContent = es;
      div.querySelector("span").textContent = "— " + w.en[0];
      ui.overMissed.appendChild(div);
    }
  } else {
    ui.overReview.classList.add("hidden");
  }
  ui.over.classList.remove("hidden");
}

function newGame() {
  game.score = 0; game.lives = 3; game.combo = 0; game.bestCombo = 0;
  game.endless = false;
  game.xpAwarded = false;
  game.session = { correct: 0, wrong: 0, landed: 0, missed: new Map() };
  game.sessionWrong = new Set();
  game.sessionHits = {};
  game.time = 0;
  game.fx = { shieldCharges: 0, doubleUntil: 0, slowUntil: 0 };
  particles.length = 0; popups.length = 0; lasers.length = 0; rings.length = 0;
  ui.score.textContent = "0";
  ui.lives.textContent = "❤️❤️❤️";
  updateCombo();
  ui.over.classList.add("hidden");
  ui.victory.classList.add("hidden");
  ui.input.value = "";
  ui.input.focus();
  startWave(1);
}

function togglePause() {
  if (game.state === "playing" || game.state === "boss") {
    game.pausedFrom = game.state;
    game.state = "paused";
    ui.pause.classList.remove("hidden");
  } else if (game.state === "paused") {
    game.state = game.pausedFrom;
    ui.pause.classList.add("hidden");
    ui.input.focus();
  }
}

// ── Loop ─────────────────────────────────────────────────────────
let lastT = 0;
function frame(now) {
  if (!game.running) return;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function update(dt) {
  game.time += dt;
  for (const s of stars) { s.y += s.v * dt; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * (p.grav ?? 1) * dt; p.life -= dt; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (const r of rings) { r.r += (r.max - r.r) * Math.min(1, dt * 9); r.life -= dt; }
  for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1);
  for (const l of lasers) l.t -= dt;
  for (let i = lasers.length - 1; i >= 0; i--) if (lasers[i].t <= 0) lasers.splice(i, 1);
  for (const p of popups) { p.y -= (p.learn ? 12 : 30) * dt; p.t -= dt; }
  for (let i = popups.length - 1; i >= 0; i--) if (popups[i].t <= 0) popups.splice(i, 1);
  if (game.shake > 0) game.shake -= dt;

  if (game.bannerTimer > 0) {
    game.bannerTimer -= dt;
    if (game.bannerTimer <= 0) ui.banner.classList.add("hidden");
  }

  if (game.state === "playing") {
    if (game.bannerTimer <= 0 && game.queue.length) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnEnemy(game.queue.shift());
        game.spawnTimer = game.spawnInterval;
      }
    }
    const slowK = game.fx.slowUntil > game.time ? 0.5 : 1;
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      if (e.flash > 0) e.flash -= dt;
      e.y += e.speed * slowK * dt;
      e.wobble += dt * 2;
      e.x += Math.sin(e.wobble) * 12 * dt;
      if (e.y > ship.y - 34) {
        game.enemies.splice(i, 1);
        if (e.special) {
          // heart / power-up that got away: a missed chance, no penalty
        } else if (game.fx.shieldCharges > 0) {
          game.fx.shieldCharges--;
          explode(e.x, e.y, "#4fa4e8", 20, 1);
          popups.push({ x: e.x, y: ship.y - 60, text: "¡escudo! 🛡", t: 1.2, color: "#4fa4e8" });
          sfx.bossHit();
        } else {
          recordMiss(e.word.es);
          game.session.landed++;
          game.waveLanded++;
          game.session.missed.set(e.word.es, e.word);
          // teach the missed word right now: float it up for a few seconds
          popups.push({
            x: Math.max(120, Math.min(W - 120, e.x)), y: e.y - 20,
            text: `${e.word.es} = ${e.word.en[0]}`,
            t: 3.6, color: "#f7b32b", learn: true,
          });
          loseLife();
          if (game.state !== "playing") return;
        }
        maybeEndWave();
      }
    }
    if (game.clearDelay != null) {
      game.clearDelay -= dt;
      if (game.clearDelay <= 0) { game.clearDelay = null; waveCleared(); }
    } else if (!game.queue.length && !game.enemies.length && game.bannerTimer <= 0) {
      maybeEndWave();
    }
  }

  if (game.state === "boss" && game.boss && game.bannerTimer <= 0) {
    const b = game.boss;
    b.t += dt;
    b.x = W / 2 + Math.sin(b.t * 0.7) * 140;
    b.timeLeft -= dt;
    if (b.timeLeft <= 0) {
      const ans = bossAnswer();
      popups.push({ x: b.x, y: b.y + 70, text: `era: ${ans}`, t: 2, color: "#ff5d5d" });
      const vb = b.verb, ti = b.tense;
      game.session.missed.set(`${vb.inf} (${ti})`, { es: `${vb.inf} (${ti})`, en: [vb.en] });
      loseLife();
      if (game.state === "boss") nextBossPrompt();
    }
  }
}

// ── Render ───────────────────────────────────────────────────────
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake * 24, (Math.random() - 0.5) * game.shake * 24);
  }
  ctx.fillStyle = "#9fb4dd";
  for (const s of stars) {
    ctx.globalAlpha = 0.3 + s.r * 0.4;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(255,93,93,0.25)";
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(0, ship.y - 34);
  ctx.lineTo(W, ship.y - 34);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const l of lasers) {
    ctx.strokeStyle = `rgba(53,224,143,${l.t / 0.15})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  ctx.lineWidth = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const e of game.enemies) {
    let edge = enemyColor(e);
    const glow = KIND_GLOW[e.special === "heart" ? "bonus" : e.kind] || "rgba(106,190,48,0.45)";
    const heart = e.special === "heart";
    // danger telegraph: enemies close to the line pulse red so you know
    // what to prioritize
    const danger = e.y > ship.y - 120;
    let border = 2;
    if (danger) { edge = Math.sin(game.time * 12) > 0 ? "#ff4040" : edge; border = 3; }
    if (e.flash > 0) ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(e.flash * 40));
    // top graphic: power-up icon, or creature (hearts pulse)
    const pulse = heart ? 44 + Math.sin(e.wobble * 3) * 5 : 44;
    ctx.shadowColor = danger ? "rgba(255,64,64,0.6)" : glow;
    ctx.shadowBlur = danger ? 18 : e.special ? 20 : 12;
    const drew = e.icon ? drawArt(e.icon, e.x, e.y - 26, 40) : drawArt(e.art, e.x, e.y - 26, pulse);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    // multi-hit pips above the graphic
    if (e.hpMax > 1) {
      for (let k = 0; k < e.hpMax; k++) {
        ctx.fillStyle = k < e.hp ? edge : "rgba(255,255,255,0.22)";
        ctx.beginPath();
        ctx.arc(e.x - (e.hpMax - 1) * 6 + k * 12, e.y - 50, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // word tag (cream, category-colored border) — legibility first
    ctx.font = "700 17px 'Segoe UI', sans-serif";
    const tag = e.armored ? "🛡 " : heart ? "❤️ " : "";
    const label = tag + e.display;
    const pw = Math.max(58, ctx.measureText(label).width + 24);
    if (!drew) {                         // fallback while art loads
      ctx.fillStyle = edge; ctx.shadowColor = glow; ctx.shadowBlur = 14;
      roundRect(e.x - pw / 2, e.y - 15, pw, 30, 15); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff"; ctx.fillText(label, e.x, e.y + 1);
    } else {
      ctx.fillStyle = "#f5eeda";
      ctx.strokeStyle = edge; ctx.lineWidth = border;
      roundRect(e.x - pw / 2, e.y - 2, pw, 26, 8); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "#2a1c10";
      ctx.fillText(label, e.x, e.y + 11);
    }
    // first-exposure hint for brand-new words
    if (e.hint) {
      ctx.font = "600 12px 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(245,238,218,0.62)";
      ctx.fillText("→ " + e.hint, e.x, e.y + (drew ? 30 : 26));
    }
  }

  if (game.state === "boss" && game.boss) drawBoss();

  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / 0.45) * 0.7;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const p of popups) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.t));
    if (p.learn) {                            // missed-word teaching card
      ctx.font = "700 18px 'Segoe UI', sans-serif";
      const pw = ctx.measureText(p.text).width + 26;
      ctx.fillStyle = "rgba(20,16,10,0.85)";
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      roundRect(p.x - pw / 2, p.y - 16, pw, 30, 8); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "#f5eeda";
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.font = "800 18px 'Segoe UI', sans-serif";
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
  }
  ctx.globalAlpha = 1;

  drawActiveFX();
  drawShip();
  ctx.restore();
}

// small badges for active power-ups, bottom-left
function drawActiveFX() {
  const badges = [];
  if (game.fx.shieldCharges > 0) badges.push(["pu-shield", `×${game.fx.shieldCharges}`, "#4fa4e8"]);
  if (game.fx.doubleUntil > game.time) badges.push(["pu-double", `${Math.ceil(game.fx.doubleUntil - game.time)}s`, "#6abe30"]);
  if (game.fx.slowUntil > game.time) badges.push(["pu-clock", `${Math.ceil(game.fx.slowUntil - game.time)}s`, "#c98a3a"]);
  let bx = 14;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const [icon, label, col] of badges) {
    if (!drawArt(icon, bx + 12, H - 20, 22)) { ctx.fillStyle = col; ctx.fillRect(bx, H - 30, 20, 20); }
    ctx.font = "700 13px 'Segoe UI', sans-serif";
    ctx.fillStyle = col;
    ctx.fillText(label, bx + 26, H - 19);
    bx += 26 + ctx.measureText(label).width + 14;
  }
  ctx.textAlign = "center";
}

function drawShip() {
  const { x, y } = ship;
  ctx.shadowColor = "rgba(79,164,232,0.6)";
  ctx.shadowBlur = 16;
  const drew = drawArt(SHIP_KEY, x, y - 4, 50);
  ctx.shadowBlur = 0;
  if (drew) return;
  ctx.shadowColor = "rgba(53,224,143,0.7)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#35e08f";
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x - 20, y + 10);
  ctx.lineTo(x - 8, y + 4);
  ctx.lineTo(x, y + 10);
  ctx.lineTo(x + 8, y + 4);
  ctx.lineTo(x + 20, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0a0e1a";
  ctx.beginPath();
  ctx.arc(x, y - 8, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoss() {
  const b = game.boss;
  ctx.shadowColor = "rgba(255,209,102,0.6)";
  ctx.shadowBlur = 24;
  const drew = drawArt(b.art, b.x, b.y, 132);
  ctx.shadowBlur = 0;
  if (!drew) {
    ctx.shadowColor = "rgba(255,209,102,0.6)"; ctx.shadowBlur = 24;
    ctx.fillStyle = "#8659c9";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 90, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b18cff";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 18, 42, 26, 0, Math.PI, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const bw = 200, hbY = b.y - 86;
  ctx.fillStyle = "#1e2a45";
  roundRect(b.x - bw / 2, hbY, bw, 12, 6); ctx.fill();
  ctx.fillStyle = "#ff5d5d";
  const frac = Math.max(0, b.hp / b.maxHp);
  if (frac > 0) { roundRect(b.x - bw / 2, hbY, bw * frac, 12, 6); ctx.fill(); }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd166";
  ctx.font = "800 30px 'Segoe UI', sans-serif";
  ctx.fillText(`${BOSS_PERSONS[b.personIdx]} + ${b.verb.inf}`, W / 2, 240);
  ctx.fillStyle = "#9fb4dd";
  ctx.font = "600 20px 'Segoe UI', sans-serif";
  ctx.fillText(`${b.tense} · (${b.verb.en})`, W / 2, 272);

  const tw = 320, tf = Math.max(0, b.timeLeft / b.promptTime);
  ctx.fillStyle = "#1e2a45";
  roundRect(W / 2 - tw / 2, 296, tw, 10, 5); ctx.fill();
  ctx.fillStyle = tf > 0.35 ? "#35e08f" : "#ff5d5d";
  if (tf > 0) { roundRect(W / 2 - tw / 2, 296, tw * tf, 10, 5); ctx.fill(); }
}

// ── Public API ───────────────────────────────────────────────────
export function initBlaster(dependencies) {
  deps = dependencies;
  loadArt();
  canvas = $("bl-canvas");
  ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  ui = {
    score: $("bl-score"), combo: $("bl-combo"), wave: $("bl-wave"),
    lives: $("bl-lives"), mute: $("bl-mute"),
    input: $("bl-answer"), inputBar: $("bl-input-bar"),
    banner: $("bl-banner"), bannerText: $("bl-banner-text"),
    pause: $("bl-pause"), victory: $("bl-victory"), over: $("bl-over"),
    overTitle: $("bl-over-title"), overStats: $("bl-over-stats"),
    overReview: $("bl-over-review"), overMissed: $("bl-over-missed"),
    victoryStats: $("bl-victory-stats"),
  };
  if (bound) return;
  bound = true;

  ui.input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitAnswer(); });
  ui.inputBar.addEventListener("animationend", () => ui.inputBar.classList.remove("wrong"));
  window.addEventListener("keydown", (e) => {
    if (!game.running) return;
    if (e.key === "Escape") togglePause();
    else if (document.activeElement !== ui.input && !e.ctrlKey && !e.altKey && !e.metaKey) {
      ui.input.focus();
    }
  });
  $("bl-restart").addEventListener("click", newGame);
  $("bl-quit").addEventListener("click", quit);
  $("bl-quit-over").addEventListener("click", quit);
  $("bl-endless").addEventListener("click", () => {
    game.endless = true;
    ui.victory.classList.add("hidden");
    ui.input.focus();
    startWave(game.wave + 1);
  });
  $("bl-finish").addEventListener("click", () => {
    ui.victory.classList.add("hidden");
    endGame(true);
  });
  ui.mute.addEventListener("click", () => {
    const data = active().data;
    data.muted = !data.muted;
    saveNow();
    ui.mute.textContent = data.muted ? "🔇" : "🔊";
  });
}

export function enterBlaster() {
  ui.mute.textContent = active().data.muted ? "🔇" : "🔊";
  ui.pause.classList.add("hidden");
  game.running = true;
  lastT = performance.now();
  requestAnimationFrame(frame);
  newGame();
}

function quit() {
  // quitting mid-run still banks the XP you earned
  if (!game.xpAwarded && game.score > 0) {
    game.xpAwarded = true;
    addXP(Math.round(game.score / 10));
  }
  game.running = false;
  game.state = "idle";
  ui.over.classList.add("hidden");
  ui.victory.classList.add("hidden");
  deps.onExit();
}
