// UI language layer — flips app chrome between Spanish and English.
// Learning content (words, sentences, game vocabulary) always stays Spanish.
// STATIC: selector → [es, en] applied to the DOM. DYN: keys for JS strings.

import { getSettings } from "./settings.js";

const STATIC = {
  ".hub-tagline": ["Un cerebro, muchos juegos. Todo lo que aprendas te sigue.",
    "One brain, many games. Everything you learn follows you."],
  "#card-nuevas .game-name": ["Palabras nuevas", "New words"],
  "#card-nuevas .game-desc": ["Conoce 5 palabras nuevas con ejemplos y un mini-quiz.",
    "Meet 5 new words with examples and a mini-quiz."],
  "#card-repaso .game-name": ["Repaso", "Review"],
  "#card-repaso .game-desc": ["Tarjetas de lo que se te está olvidando. Cinco minutos.",
    "Flashcards of what you're forgetting. Five minutes."],
  "#card-blaster .game-desc": ["Dispara traduciendo bajo presión. Jefes de conjugación.",
    "Shoot by translating under pressure. Conjugation bosses."],
  "#card-match .game-name": ["Memoria", "Memory match"],
  "#card-match .game-desc": ["Empareja español con inglés. Tranquilo pero traicionero.",
    "Pair Spanish with English. Chill but treacherous."],
  "#card-loteria .game-desc": ["Escucha la palabra, encuentra la imagen. Como con la abuela.",
    "Hear the word, find the picture. Just like at grandma's."],
  "#card-palabrle .game-desc": ["Adivina la palabra del día en 6 intentos. Con pista en inglés.",
    "Guess the daily word in 6 tries. English clue included."],
  "#card-clasificador .game-name": ["Clasificador", "Sorter"],
  "#card-clasificador .game-desc": ["Palabras que caen — mándalas al bote correcto (teclas 1-2-3).",
    "Falling words — send them to the right bin (keys 1-2-3)."],
  "#card-ahorcado .game-name": ["Ahorcado", "Hangman"],
  "#card-ahorcado .game-desc": ["El clásico. Adivina las letras antes de que sea tarde.",
    "The classic. Guess the letters before it's too late."],
  "#card-codex .game-name": ["Códice", "Codex"],
  "#card-codex .game-desc": ["Tu colección de palabras — cada una con su fuerza actual.",
    "Your word collection — each with its current strength."],
  "#card-codex .game-meta": ["colecciónalas todas", "collect them all"],
  "#card-taller .game-name": ["Taller de palabras", "Word workshop"],
  "#card-taller .game-desc": ["Agrega tus propias palabras — o las que te enseñe tu esposa.",
    "Add your own words — or the ones your wife teaches you."],
  "#screen-codex h2": ["Códice de palabras", "Word codex"],
  "#screen-perfil h2": ["Perfil", "Profile"],
  "#screen-taller h2": ["Taller de palabras", "Word workshop"],
  "#screen-nuevas h2": ["Palabras nuevas", "New words"],
  "#screen-repaso h2": ["Repaso", "Review"],
  "#screen-ajustes h2": ["Ajustes", "Settings"],
  "#cx-back": ["← Volver", "← Back"],
  "#pf-back": ["← Volver", "← Back"],
  "#tw-back": ["← Volver", "← Back"],
  "#aj-back": ["← Volver", "← Back"],
  "#lt-quit": ["← Salir", "← Quit"],
  "#pl-quit": ["← Salir", "← Quit"],
  "#cl-quit": ["← Salir", "← Quit"],
  "#ah-quit": ["← Salir", "← Quit"],
  "#nv-quit": ["← Salir", "← Quit"],
  "#rp-quit": ["← Salir", "← Quit"],
  "#bl-quit": ["← Salir", "← Quit"],
  "#pf-rename": ["✏️ Renombrar", "✏️ Rename"],
  "#pf-export": ["💾 Exportar", "💾 Export"],
  "#pf-delete": ["🗑 Eliminar", "🗑 Delete"],
  "#tw-export": ["💾 Exportar paquete", "💾 Export pack"],
  "#tw-import": ["📂 Importar paquete", "📂 Import pack"],
  "#rp-nose": ["no sé 🤷", "no idea 🤷"],
  "#lbl-sfx": ["Volumen de efectos", "Sound effects volume"],
  "#lbl-ttsvol": ["Volumen de la voz", "Voice volume"],
  "#lbl-ttsrate": ["Velocidad de la voz", "Voice speed"],
  "#lbl-voice": ["Voz en español", "Spanish voice"],
  "#lbl-lang": ["Idioma de la interfaz", "Interface language"],
  "#lbl-reminder": ["Recordatorio diario", "Daily reminder"],
  "#aj-voice-test": ["🔊 Probar", "🔊 Test"],
  "#aj-reminder-note": [
    "El recordatorio solo funciona con la app abierta. Notificaciones reales llegarán con la versión instalable.",
    "The reminder only works while the app is open. Real push notifications come with the installable version."],
  "#aj-voice-note": [
    "¿La voz suena robótica? En Microsoft Edge hay voces 'Natural' de es-MX mucho mejores. Elige la tuya aquí.",
    "Voice sounds robotic? Microsoft Edge ships much better es-MX 'Natural' voices. Pick yours here."],
};

const DYN = {
  playFirst: ["juega tu primera partida", "play your first game"],
  runFirst: ["¡corre la primera!", "run your first!"],
  dailyReady: ["palabra del día lista", "daily word is ready"],
  keys123: ["teclas 1, 2, 3", "keys 1, 2, 3"],
  niModo: ["6 errores y ni modo", "6 mistakes and it's over"],
  toDiscover: ["por descubrir", "to discover"],
  allDiscovered: ["¡todas descubiertas!", "all discovered!"],
  cardsReady: ["tarjetas listas", "cards ready"],
  learnFirst: ["aprende algo primero", "learn something first"],
  addYours: ["agrega las tuyas", "add your own"],
  level: ["Nivel", "Level"],
  memberSince: ["miembro desde", "member since"],
  wordsKnown: ["palabras conocidas", "words known"],
  mastered: ["dominadas", "mastered"],
  strong: ["fuertes", "strong"],
  fadingLbl: ["olvidándose", "fading"],
  accuracy: ["precisión global", "overall accuracy"],
  totalAnswers: ["respuestas totales", "total answers"],
  streakNow: ["racha actual", "current streak"],
  bestStreak: ["mejor racha", "best streak"],
  blasterHigh: ["high score — blaster", "high score — blaster"],
  matchBest: ["mejor memoria", "best memory match"],
  days: ["días", "days"],
  day: ["día", "day"],
  learning: ["aprendiendo", "learning"],
  wordsLbl: ["palabras", "words"],
  fadingAlert: ["se te están olvidando", "are slipping away"],
  anyGame: ["cualquier juego las incluirá.", "any game will include them."],
  typeWord: ["escríbela tú — ¿cómo se dice…", "your turn to type it — how do you say…"],
  typed: ["¡Así se escribe!", "That's how it's spelled!"],
  typedWrong: ["Se escribe así:", "It's spelled like this:"],
  newProfileName: ["Nombre del nuevo perfil:", "New profile name:"],
  renameProfile: ["Nuevo nombre del perfil:", "New profile name:"],
  cantDeleteOnly: ["No puedes eliminar el único perfil.", "You can't delete the only profile."],
  deleteConfirm: ["¿Eliminar el perfil", "Delete profile"],
  noUndo: ["Esta acción no se puede deshacer.", "This cannot be undone."],
};

export function lang() { return getSettings().lang === "en" ? 1 : 0; }

export function t(key) {
  const e = DYN[key];
  return e ? e[lang()] : key;
}

export function applyStatic() {
  const i = lang();
  for (const [sel, texts] of Object.entries(STATIC)) {
    const el = document.querySelector(sel);
    if (el) el.textContent = texts[i];
  }
}
