// Text-to-speech — Mexican Spanish voice via the browser's built-in synth.

let voice = null;

function pickVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  voice =
    vs.find((v) => v.lang === "es-MX") ||
    vs.find((v) => v.lang.replace("_", "-").startsWith("es-MX")) ||
    vs.find((v) => v.lang.startsWith("es")) ||
    null;
}
if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text, rate = 0.95) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice ? voice.lang : "es-MX";
  u.rate = rate;
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
