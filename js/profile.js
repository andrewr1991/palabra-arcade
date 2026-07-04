// Profiles, XP, streaks, and save files. One brain per profile.

import { Brain } from "./brain.js";

const INDEX_KEY = "pa_profiles";
const SAVE_PREFIX = "pa_save_";

let index = null;   // { list: [{id, name}], active: id }
let current = null; // { id, data, brain }

function freshSave(name) {
  return {
    name, version: 1,
    xp: 0, streak: 0, lastPlayed: null,
    muted: false, blasterHigh: 0, matchBest: null,
    brain: { words: {} },
    created: new Date().toISOString(),
  };
}

export function initProfiles() {
  index = JSON.parse(localStorage.getItem(INDEX_KEY) || "null");
  if (!index || !index.list.length) {
    index = { list: [], active: null };
    createProfile("Jugador 1");
  } else {
    loadProfile(index.active || index.list[0].id);
  }
  return current;
}

function saveIndex() { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); }

export function listProfiles() { return index.list; }
export function active() { return current; }

export function createProfile(name) {
  const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  index.list.push({ id, name });
  index.active = id;
  saveIndex();
  const data = freshSave(name);
  localStorage.setItem(SAVE_PREFIX + id, JSON.stringify(data));
  current = { id, data, brain: new Brain(data.brain) };
  return current;
}

export function loadProfile(id) {
  const meta = index.list.find((p) => p.id === id);
  if (!meta) return createProfile("Jugador 1");
  index.active = id;
  saveIndex();
  const data = JSON.parse(localStorage.getItem(SAVE_PREFIX + id) || "null") || freshSave(meta.name);
  current = { id, data, brain: new Brain(data.brain) };
  return current;
}

export function saveNow() {
  if (!current) return;
  current.data.brain = current.brain.state;
  localStorage.setItem(SAVE_PREFIX + current.id, JSON.stringify(current.data));
}

// ── XP & levels ──────────────────────────────────────────────────
// Level n → n+1 costs 100 + 50·(n−1) XP
export function levelInfo(xp = current.data.xp) {
  let level = 1, rem = xp;
  for (;;) {
    const need = 100 + (level - 1) * 50;
    if (rem < need) return { level, into: rem, need };
    rem -= need;
    level++;
  }
}

export function addXP(n) {
  const before = levelInfo().level;
  current.data.xp += Math.max(0, Math.round(n));
  touchStreak();
  saveNow();
  return { gained: n, leveledUp: levelInfo().level > before };
}

export function touchStreak() {
  const today = new Date().toDateString();
  const last = current.data.lastPlayed;
  if (last === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  current.data.streak = last === yesterday ? current.data.streak + 1 : 1;
  current.data.lastPlayed = today;
  if (current.data.streak > (current.data.bestStreak || 0)) {
    current.data.bestStreak = current.data.streak;
  }
}

export function renameProfile(name) {
  current.data.name = name;
  const meta = index.list.find((p) => p.id === current.id);
  if (meta) meta.name = name;
  saveIndex();
  saveNow();
}

export function deleteProfile(id) {
  if (index.list.length <= 1) return false;
  index.list = index.list.filter((p) => p.id !== id);
  localStorage.removeItem(SAVE_PREFIX + id);
  saveIndex();
  if (current.id === id) loadProfile(index.list[0].id);
  return true;
}

// ── Save file export / import ────────────────────────────────────
export function exportSave() {
  saveNow();
  const blob = new Blob([JSON.stringify(current.data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `palabra-arcade-${current.data.name.replace(/\W+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importSave(json) {
  const data = JSON.parse(json);
  if (!data || typeof data.xp !== "number" || !data.brain) {
    throw new Error("Not a Palabra Arcade save file");
  }
  const prof = createProfile(data.name || "Importado");
  prof.data = data;
  prof.brain = new Brain(data.brain);
  current = prof;
  saveNow();
  return prof;
}
