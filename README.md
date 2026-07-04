# Palabra Arcade 🕹️

A vocabulary arcade for learning Mexican Spanish. One brain, many games — whatever
you play, the app tracks your word knowledge, and every game serves you the words
you need most.

## Run it

Serve the folder (ES modules need a server, any will do):

```
python -m http.server 8735
```

then open http://localhost:8735.

## Architecture

```
js/brain.js        The Brain — shared SRS word-knowledge engine
js/profile.js      Profiles, XP, levels, streaks, save export/import
js/main.js         Hub, word codex, routing
js/games/          One module per game — each speaks the same tiny interface
js/data/words.js   ~240-word Mexican Spanish pack + boss conjugations
```

**The game interface** is two calls:

- `brain.requestWords(n)` — start a session; the brain serves your weakest words
  plus a drip of new ones
- `brain.report(es, { correct, weight })` — report evidence; `weight` reflects how
  strong the evidence is (1.0 = typed recall under time pressure, 0.4 = recognition)

Each word's knowledge is a stability value (days) that grows with correct answers and
shrinks with wrong ones; effective strength decays as `exp(-elapsed/stability)`.
Statuses: new → learning → strong → mastered, with **fading** when retention drops —
fading words are flagged on the hub and prioritized in every game.

## Games

- **Palabra Blaster** — typing shooter. Spanish→English (and reverse from wave 3),
  words you've missed attack as armored enemies, conjugation boss fights every
  5 waves. Full-strength evidence (1.0).
- **Memoria** — match Spanish/English pairs. Recognition evidence (0.4).
- **Lotería** — Mexican bingo. The caller speaks a word (es-MX voice); find its
  picture. Word→image, no English involved (0.5).
- **Palabrle** — Wordle with an English clue. Daily word + free play with your
  weak words. ñ is its own letter, accents optional (0.6).
- **Clasificador** — falling words, sort them into category bins with keys 1-2-3 (0.3).
- **Ahorcado** — hangman with the brain picking what you need to practice (0.6).

## Estudio

- **Palabras nuevas** — guided intro: 5 new words with example sentences and
  audio, then a mini-quiz that seeds them into the brain.
- **Repaso** — SRS flashcards of exactly what's due: fading and weak words,
  typed answers, missed cards return at the end of the deck.

## Extras

- Audio everywhere via the browser's Mexican Spanish voice (es-MX).
- Example sentences for all 242 built-in words.
- Accent buttons (á é í ó ú ñ ü) under typing inputs.
- **Taller de palabras** — add your own words (with sentence, emoji, category);
  export/import packs as JSON to share.
- Profile page: XP charts (14 days), words-known history, 15 achievements,
  per-category progress, weakest/strongest words, rename/export/delete.

## Adding a game

Create `js/games/yourgame.js`, request words from the brain, report results,
add a card to the hub in `index.html`/`main.js`. That's the whole contract.

## Profiles & saves

Multiple local profiles (header dropdown), stored in localStorage. 💾 exports the
active profile as a JSON save file; 📂 imports one. XP levels, daily streaks, and
per-game bests are all per-profile.
