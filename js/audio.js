// Text-to-speech with quality-ranked voice selection.
// Local Windows SAPI voices (Sabina/Raul) sound robotic; Edge ships neural
// "Natural" voices and Chrome ships Google remote voices that sound far
// better. We rank what's available and let Settings override the pick.

import { getSettings } from "./settings.js";
import { getClip } from "./recorder.js";

let ranked = [];

function scoreVoice(v) {
  const lang = (v.lang || "").replace("_", "-").toLowerCase();
  if (!lang.startsWith("es")) return -1;
  const name = (v.name || "").toLowerCase();
  let s = 1;
  if (lang === "es-mx") s += 6;
  else if (lang === "es-us") s += 5;
  else if (lang === "es-419") s += 4;
  else if (lang === "es-es") s += 2;
  if (name.includes("natural") || name.includes("neural") || name.includes("online")) s += 20;
  if (name.includes("google")) s += 12;
  if (name.includes("premium") || name.includes("enhanced")) s += 8;
  return s;
}

function refresh() {
  if (!window.speechSynthesis) return;
  ranked = speechSynthesis.getVoices()
    .map((v) => ({ v, s: scoreVoice(v) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v);
}
if (window.speechSynthesis) {
  refresh();
  speechSynthesis.onvoiceschanged = refresh;
}

export function listSpanishVoices() {
  refresh();
  return ranked;
}

export function currentVoice() {
  const pref = getSettings().voiceURI;
  if (pref) {
    const match = ranked.find((v) => v.voiceURI === pref);
    if (match) return match;
  }
  return ranked[0] || null;
}

export async function speak(text, rateOverride) {
  const cfg = getSettings();
  if (cfg.ttsVol <= 0) return;
  // a family recording beats any robot
  const clip = await getClip(text);
  if (clip) {
    const a = new Audio(URL.createObjectURL(clip));
    a.volume = cfg.ttsVol;
    a.onended = () => URL.revokeObjectURL(a.src);
    a.play().catch(() => {});
    return;
  }
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = currentVoice();
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  else u.lang = "es-MX";
  u.rate = rateOverride ?? cfg.ttsRate;
  u.volume = cfg.ttsVol;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

export function speakButton(text) {
  const btn = document.createElement("button");
  btn.className = "speak-btn";
  btn.type = "button";
  btn.title = "Escuchar";
  btn.textContent = "🔊";
  btn.addEventListener("click", (e) => { e.stopPropagation(); speak(text); });
  return btn;
}
