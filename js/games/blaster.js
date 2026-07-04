// Palabra Blaster — game #1. Words come from the shared brain;
// every hit/miss reports back as typed-recall evidence (weight 1).

import { BOSS_VERBS, BOSS_PERSONS } from "../data/words.js";
import { norm, answerSetFor, inputMatches } from "../brain.js";
import { active, addXP, saveNow } from "../profile.js";

const W = 900, H = 640;
let canvas, ctx, deps, bound = false;

const $ = (id) => document.getElementById(id);
let ui = null;

// ── Audio ────────────────────────────────────────────────────────
let actx = null;
function tone(freq, dur, type = "square", vol = 0.08, delay = 0) {
  if (active().data.muted) return;
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
};

window.__blaster = game; // debug/test handle

const ship = { x: W / 2, y: H - 46 };
const lasers = [], particles = [], popups = [];
const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * W, y: Math.random() * H,
  r: Math.random() * 1.4 + 0.3, v: Math.random() * 12 + 4,
}));

function multiplier() { return 1 + Math.min(4, Math.floor(game.combo / 5)) * 0.5; }

// ── Brain integration ────────────────────────────────────────────
function isWeak(es) {
  const brain = active().brain;
  if (game.sessionWrong.has(es)) return true;
  const rec = brain.info(es);
  return brain.statusOf(es) === "fading" || (rec && rec.bad > rec.ok);
}
function recordHit(es) { active().brain.report(es, { correct: true, weight: 1 }); saveNow(); }
function recordMiss(es) {
  active().brain.report(es, { correct: false, weight: 1 });
  game.sessionWrong.add(es);
  saveNow();
}

// ── Waves ────────────────────────────────────────────────────────
function pickWaveWords(count) {
  const words = active().brain.requestWords(count, { newCount: Math.ceil(count * 0.15) });
  return words.map((w) => ({ word: w, armored: isWeak(w.es) }));
}

function startWave(n) {
  game.wave = n;
  game.enemies = [];
  lasers.length = 0;
  ui.wave.textContent = `Wave ${n}`;
  if (n % 5 === 0) { startBoss(n); return; }
  game.state = "playing";
  const count = 6 + n * 2;
  const reverseChance = n >= 3 ? 0.25 : 0;
  game.queue = pickWaveWords(count).map((p) => ({
    ...p, reverse: Math.random() < reverseChance,
  }));
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

function spawnEnemy(entry) {
  const display = entry.reverse ? entry.word.en[0] : entry.word.es;
  ctx.font = "700 17px 'Segoe UI', sans-serif";
  const w = Math.max(74, ctx.measureText(display).width + 40);
  const speed = (16 + game.wave * 3.5) * (0.85 + Math.random() * 0.3) * (entry.armored ? 1.3 : 1);
  const enemy = {
    ...entry, display, w,
    x: 40 + w / 2 + Math.random() * (W - 80 - w),
    y: -20, speed,
    wobble: Math.random() * Math.PI * 2,
  };
  enemy.answerSet = answerSetFor(enemy.word, enemy.reverse);
  game.enemies.push(enemy);
}

// ── Boss ─────────────────────────────────────────────────────────
function startBoss(n) {
  game.state = "boss";
  game.boss = {
    hp: 6 + (n / 5) * 2, maxHp: 6 + (n / 5) * 2,
    x: W / 2, y: 120, t: 0,
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
  b.tense = Math.random() < 0.5 ? "presente" : "pretérito";
  b.personIdx = Math.floor(Math.random() * BOSS_PERSONS.length);
  b.timeLeft = b.promptTime;
}
function bossAnswer() {
  const b = game.boss;
  return b.verb[b.tense][b.personIdx];
}

// ── Scoring / lives ──────────────────────────────────────────────
function addScore(base, x, y, color) {
  const pts = Math.round(base * multiplier());
  game.score += pts;
  ui.score.textContent = game.score;
  popups.push({ x, y, text: `+${pts}`, t: 1, color });
  game.combo++;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  updateCombo();
}
function updateCombo() {
  if (game.combo >= 5) {
    ui.combo.textContent = `COMBO x${multiplier()}`;
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
  if (game.lives < 5) {
    game.lives++;
    ui.lives.textContent = "❤️".repeat(game.lives);
    popups.push({ x: ship.x, y: ship.y - 40, text: "+1 ❤️", t: 1.2, color: "#ff8fa3" });
  }
}

// ── Effects ──────────────────────────────────────────────────────
function explode(x, y, color, n = 16) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.4, color, size: 1.5 + Math.random() * 2.5,
    });
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

  let target = null;
  for (const e of game.enemies) {
    if (inputMatches(text, e.answerSet) && (!target || e.y > target.y)) target = e;
  }
  if (target) {
    game.enemies.splice(game.enemies.indexOf(target), 1);
    fireLaser(target.x, target.y);
    explode(target.x, target.y, target.armored ? "#ff5d5d" : target.reverse ? "#4fd6ff" : "#35e08f");
    const base = target.armored ? 30 : target.reverse ? 20 : 10;
    addScore(base, target.x, target.y, "#ffd166");
    recordHit(target.word.es);
    game.session.correct++;
    sfx.shoot(); sfx.kill();
  } else {
    wrongAnswer();
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
  breakCombo();
  sfx.wrong();
  ui.inputBar.classList.remove("wrong");
  void ui.inputBar.offsetWidth;
  ui.inputBar.classList.add("wrong");
}

// ── Flow ─────────────────────────────────────────────────────────
function waveCleared() {
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
  game.session = { correct: 0, wrong: 0, landed: 0, missed: new Map() };
  game.sessionWrong = new Set();
  particles.length = 0; popups.length = 0; lasers.length = 0;
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
  for (const s of stars) { s.y += s.v * dt; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (const l of lasers) l.t -= dt;
  for (let i = lasers.length - 1; i >= 0; i--) if (lasers[i].t <= 0) lasers.splice(i, 1);
  for (const p of popups) { p.y -= 30 * dt; p.t -= dt; }
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
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      e.y += e.speed * dt;
      e.wobble += dt * 2;
      e.x += Math.sin(e.wobble) * 12 * dt;
      if (e.y > ship.y - 34) {
        game.enemies.splice(i, 1);
        recordMiss(e.word.es);
        game.session.landed++;
        game.session.missed.set(e.word.es, e.word);
        loseLife();
        if (game.state !== "playing") return;
      }
    }
    if (!game.queue.length && !game.enemies.length && game.bannerTimer <= 0) waveCleared();
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

  ctx.font = "700 17px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const e of game.enemies) {
    const x = e.x - e.w / 2, y = e.y - 15;
    let fill, glow;
    if (e.armored) { fill = "#c93a3a"; glow = "rgba(255,93,93,0.5)"; }
    else if (e.reverse) { fill = "#1d7fa8"; glow = "rgba(79,214,255,0.45)"; }
    else { fill = "#1d8f5c"; glow = "rgba(53,224,143,0.4)"; }
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = fill;
    roundRect(x, y, e.w, 30, 15);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(e.x - 6, e.y + 15);
    ctx.lineTo(e.x + 6, e.y + 15);
    ctx.lineTo(e.x, e.y + 23);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText((e.armored ? "🛡 " : "") + e.display, e.x, e.y + 1);
  }

  if (game.state === "boss" && game.boss) drawBoss();

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.font = "800 18px 'Segoe UI', sans-serif";
  for (const p of popups) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.t));
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  drawShip();
  ctx.restore();
}

function drawShip() {
  const { x, y } = ship;
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
  ctx.fillStyle = "#8659c9";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, 90, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b18cff";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y - 18, 42, 26, 0, Math.PI, 0);
  ctx.fill();
  ctx.shadowBlur = 0;

  const bw = 200;
  ctx.fillStyle = "#1e2a45";
  roundRect(b.x - bw / 2, b.y - 64, bw, 12, 6); ctx.fill();
  ctx.fillStyle = "#ff5d5d";
  const frac = Math.max(0, b.hp / b.maxHp);
  if (frac > 0) { roundRect(b.x - bw / 2, b.y - 64, bw * frac, 12, 6); ctx.fill(); }

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
  game.running = false;
  game.state = "idle";
  ui.over.classList.add("hidden");
  ui.victory.classList.add("hidden");
  deps.onExit();
}
