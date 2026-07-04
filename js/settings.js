// Global app settings — device-level, shared by all profiles.

const KEY = "pa_settings";

const DEFAULTS = {
  sfxVol: 1,        // 0..1 game sound effects
  ttsVol: 1,        // 0..1 voice volume
  ttsRate: 0.95,    // 0.5..1.2 voice speed
  voiceURI: "",     // preferred speechSynthesis voice ("" = auto best)
  lang: "es",       // UI language: es | en
  reminderOn: false,
  reminderTime: "19:00",
};

let settings = { ...DEFAULTS, ...load() };

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function getSettings() { return settings; }

export function setSetting(k, v) {
  settings[k] = v;
  localStorage.setItem(KEY, JSON.stringify(settings));
}

// ── Daily reminder (only fires while the app is open — real push
// notifications need the PWA setup, which is on the backlog) ──────
let lastNotified = localStorage.getItem("pa_last_reminder") || "";

export function requestNotifyPermission() {
  if (!("Notification" in window)) return Promise.resolve("unsupported");
  return Notification.requestPermission();
}

setInterval(() => {
  if (!settings.reminderOn) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (hhmm === settings.reminderTime && lastNotified !== today) {
    lastNotified = today;
    localStorage.setItem("pa_last_reminder", today);
    new Notification("Palabra Arcade", {
      body: settings.lang === "es"
        ? "¡Tus palabras te extrañan! Cinco minutos de repaso, ¿sale?"
        : "Your words miss you! Five minutes of review, deal?",
    });
  }
}, 30000);
