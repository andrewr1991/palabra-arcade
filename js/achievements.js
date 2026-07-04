// Achievements — checked after sessions and on hub render.
// check(data, brain, stats) → true when earned.

import { allWords } from "./customwords.js";
import { active, saveNow } from "./profile.js";
import { toast } from "./ui.js";

export const ACHIEVEMENTS = [
  { id: "primera", icon: "🌵", name: "Primeros pasos",
    desc: "Responde tu primera palabra",
    check: (d, b, s) => s.known >= 1 },
  { id: "calentando", icon: "🔥", name: "Calentando motores",
    desc: "Racha de 3 días",
    check: (d) => (d.bestStreak || 0) >= 3 },
  { id: "ahorita", icon: "⏰", name: "Ahorita significa nunca",
    desc: "Racha de 7 días",
    check: (d) => (d.bestStreak || 0) >= 7 },
  { id: "coleccionista", icon: "📦", name: "Coleccionista",
    desc: "Conoce 100 palabras",
    check: (d, b, s) => s.known >= 100 },
  { id: "enciclopedia", icon: "🧠", name: "Enciclopedia andante",
    desc: "Conoce todas las palabras",
    check: (d, b, s) => s.known >= s.total && s.total > 0 },
  { id: "dominador", icon: "👑", name: "El dominador",
    desc: "Domina 50 palabras",
    check: (d, b, s) => s.mastered >= 50 },
  { id: "yerno", icon: "💍", name: "Yerno del año",
    desc: "Conoce toda la categoría Familia",
    check: (d, b) => allWords().filter((w) => w.cat === "family")
      .every((w) => b.statusOf(w.es) !== "new") },
  { id: "comelon", icon: "🌮", name: "El comelón",
    desc: "Conoce toda la categoría Comida",
    check: (d, b) => allWords().filter((w) => w.cat === "food")
      .every((w) => b.statusOf(w.es) !== "new") },
  { id: "jefe", icon: "🛸", name: "Cazajefes",
    desc: "Sobrevive las 10 oleadas del Blaster",
    check: (d) => !!d.blasterVictory },
  { id: "memorioso", icon: "🎴", name: "Memoria de elefante",
    desc: "Memoria perfecta: 10 pares en 10 movimientos",
    check: (d) => !!d.matchPerfect },
  { id: "loteria", icon: "🫘", name: "¡Lotería!",
    desc: "Gana tu primera lotería",
    check: (d) => (d.loteriaWins || 0) >= 1 },
  { id: "palabrle", icon: "🟩", name: "Adivino",
    desc: "Gana un Palabrle",
    check: (d) => (d.palabrleWins || 0) >= 1 },
  { id: "verdugo", icon: "💀", name: "Sálvame güey",
    desc: "Gana 5 ahorcados",
    check: (d) => (d.ahorcadoWins || 0) >= 5 },
  { id: "nivel5", icon: "🚀", name: "Despegue",
    desc: "Alcanza el nivel 5",
    check: (d, b, s, level) => level >= 5 },
  { id: "nivel10", icon: "🌟", name: "Estrella del arcade",
    desc: "Alcanza el nivel 10",
    check: (d, b, s, level) => level >= 10 },
];

export function checkAchievements(levelInfoFn) {
  const p = active();
  if (!p.data.achieved) p.data.achieved = {};
  const stats = p.brain.stats();
  const level = levelInfoFn().level;
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (p.data.achieved[a.id]) continue;
    let earned = false;
    try { earned = a.check(p.data, p.brain, stats, level); } catch { earned = false; }
    if (earned) {
      p.data.achieved[a.id] = new Date().toISOString();
      fresh.push(a);
    }
  }
  if (fresh.length) {
    saveNow();
    for (const a of fresh) toast(`Logro: ${a.name}`, a.icon);
  }
  return fresh;
}
