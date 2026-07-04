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
