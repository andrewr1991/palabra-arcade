// The Brain — shared word-knowledge engine (SRS).
// Every game asks it for words and reports evidence back.
// Knowledge record per word: { st: stability in days, last: ms timestamp,
//   seen, ok, bad } — retention decays as exp(-elapsedDays / st).

import { allWords } from "./customwords.js";

const DAY = 86400000;

export class Brain {
  constructor(state) {
    this.state = state && state.words ? state : { words: {} };
  }

  info(es) { return this.state.words[es] || null; }

  retention(rec, now = Date.now()) {
    const days = Math.max(0, (now - rec.last) / DAY);
    return Math.exp(-days / rec.st);
  }

  // 0–100 effective strength right now (decays over time)
  strengthOf(es) {
    const r = this.info(es);
    return r ? Math.round(this.retention(r) * 100) : 0;
  }

  statusOf(es) {
    const r = this.info(es);
    if (!r || !r.seen) return "new";
    if (this.retention(r) < 0.55) return "fading";
    if (r.st >= 21) return "mastered";
    if (r.st >= 4) return "strong";
    return "learning";
  }

  // weight = evidence strength of the game mode:
  //   1.0 typed recall under time pressure, ~0.4 recognition/matching
  report(es, { correct, weight = 1 }) {
    let r = this.state.words[es];
    if (!r) r = this.state.words[es] = { st: 0.6, last: Date.now(), seen: 0, ok: 0, bad: 0 };
    if (correct) {
      r.st = Math.min(180, r.st * (1 + 1.5 * weight) + 0.1);
      r.ok++;
    } else {
      r.st = Math.max(0.3, r.st * (1 - 0.6 * weight));
      r.bad++;
    }
    r.seen++;
    r.last = Date.now();
  }

  // A game session asks: "give me n words". Serves weakest known words
  // first (that's the review) plus a drip of brand-new ones.
  requestWords(n, { newCount = Math.ceil(n * 0.2), pool = allWords() } = {}) {
    const known = [], fresh = [];
    for (const w of pool) (this.info(w.es) ? known : fresh).push(w);
    known.sort((a, b) => this.strengthOf(a.es) - this.strengthOf(b.es));
    shuffle(fresh);

    const nNew = Math.min(newCount, fresh.length);
    const nKnown = Math.min(n - nNew, known.length);
    // sample from a 2× window of the weakest so waves aren't identical
    const windowSize = Math.min(known.length, Math.max(nKnown * 2, nKnown));
    const windowPick = shuffle(known.slice(0, windowSize)).slice(0, nKnown);
    const picked = [...windowPick, ...fresh.slice(0, nNew)];
    // top up if one side ran dry
    let i = nNew;
    while (picked.length < n && i < fresh.length) picked.push(fresh[i++]);
    let j = windowSize;
    while (picked.length < n && j < known.length) picked.push(known[j++]);
    return shuffle(picked);
  }

  stats() {
    const words = allWords();
    const s = { total: words.length, new: 0, learning: 0, strong: 0, mastered: 0, fading: 0 };
    for (const w of words) s[this.statusOf(w.es)]++;
    s.known = s.total - s.new;
    return s;
  }

  fadingWords() {
    return allWords().filter((w) => this.statusOf(w.es) === "fading");
  }

  // weakest-first sample from an arbitrary pool (e.g. one category, emoji words)
  pickWeak(pool, n) {
    const seen = pool.filter((w) => this.info(w.es));
    const fresh = shuffle(pool.filter((w) => !this.info(w.es)));
    seen.sort((a, b) => this.strengthOf(a.es) - this.strengthOf(b.es));
    const windowed = shuffle(seen.slice(0, n * 2)).slice(0, n);
    const out = [...windowed];
    let i = 0;
    while (out.length < n && i < fresh.length) out.push(fresh[i++]);
    let j = n * 2;
    while (out.length < n && j < seen.length) out.push(seen[j++]);
    return shuffle(out.slice(0, n));
  }
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Shared answer matching — accent- and article-insensitive
export function norm(s) {
  return s.toLowerCase().trim().replace(/\s+/g, " ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}
export function stripLead(s) {
  return s.replace(/^(to|the|a|an|el|la|los|las|un|una) /, "");
}
export function answerSetFor(word, reverse) {
  const raw = reverse ? [word.es] : word.en;
  const out = new Set();
  for (const a of raw) { const n = norm(a); out.add(n); out.add(stripLead(n)); }
  return out;
}
export function inputMatches(input, answerSet) {
  const n = norm(input);
  return answerSet.has(n) || answerSet.has(stripLead(n));
}
