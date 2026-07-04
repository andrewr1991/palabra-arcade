// Custom word packs — user-added words, merged with the built-in pack.
// Stored once per browser (shared by all profiles).

import { WORDS } from "./data/words.js";

const KEY = "pa_custom_words";
let custom = load();

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter(valid) : [];
  } catch { return []; }
}
function persist() { localStorage.setItem(KEY, JSON.stringify(custom)); }

function valid(w) {
  return w && typeof w.es === "string" && w.es.trim() && Array.isArray(w.en) && w.en.length;
}

export function customWords() { return custom; }

export function allWords() { return custom.length ? [...WORDS, ...custom] : WORDS; }

export function findWord(es) { return allWords().find((w) => w.es === es) || null; }

export function addCustom(w) {
  if (!valid(w)) throw new Error("Palabra inválida");
  if (allWords().some((x) => x.es === w.es)) throw new Error(`"${w.es}" ya existe`);
  custom.push(w);
  persist();
}

export function removeCustom(es) {
  custom = custom.filter((w) => w.es !== es);
  persist();
}

export function exportPack() {
  const blob = new Blob([JSON.stringify(custom, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "palabra-arcade-pack.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importPack(json) {
  const list = JSON.parse(json);
  if (!Array.isArray(list)) throw new Error("No es un paquete de palabras");
  let added = 0;
  for (const w of list) {
    if (valid(w) && !allWords().some((x) => x.es === w.es)) { custom.push(w); added++; }
  }
  persist();
  return added;
}
