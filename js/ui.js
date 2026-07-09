// Small shared UI helpers.

// Accent buttons that insert characters at the cursor of a text input.
export function accentBar(input) {
  const bar = document.createElement("div");
  bar.className = "accent-bar";
  for (const ch of ["á", "é", "í", "ó", "ú", "ñ", "ü"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "accent-key";
    b.textContent = ch;
    b.addEventListener("mousedown", (e) => {
      e.preventDefault(); // keep focus on the input
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + ch + input.value.slice(end);
      input.setSelectionRange(start + 1, start + 1);
      input.focus();
    });
    bar.appendChild(b);
  }
  return bar;
}

// full-screen FX pop (confetti, star burst, level-up glow)
export function fxPop(name) {
  const img = document.createElement("img");
  img.className = "fx-pop";
  img.src = `assets/ui/${name}.png`;
  img.alt = "";
  document.body.appendChild(img);
  setTimeout(() => img.remove(), 1300);
}

// short arcade "boop" — reusable chip-tone (hovers, picks, dings)
let bctx = null;
export function boop(vol = 0.05, freq = 620, dur = 0.09, type = "square") {
  try {
    if (!bctx) bctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = bctx.currentTime;
    const o = bctx.createOscillator(), g = bctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bctx.destination);
    o.start(t); o.stop(t + dur);
  } catch {}
}

export function toast(msg, icon = "🏆") {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="toast-icon"></span><span class="toast-msg"></span>`;
  el.querySelector(".toast-icon").textContent = icon;
  el.querySelector(".toast-msg").textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 30);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 500); }, 3800);
}
