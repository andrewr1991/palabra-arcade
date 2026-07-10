"""Download the Twemoji SVGs used by Lotería tiles into assets/emoji/,
so tile art is identical on every device (no platform emoji fonts).

Twemoji is CC-BY 4.0 (github.com/jdecked/twemoji). We fetch only the
handful of emoji actually referenced by the word packs.
"""
import os, re, urllib.request, ssl

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "js", "data")
OUT = os.path.join(HERE, "emoji")
os.makedirs(OUT, exist_ok=True)
BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/"
ctx = ssl.create_default_context()

# collect unique emoji from the word packs
emojis = set()
for fn in ("words.js", "words2.js"):
    with open(os.path.join(DATA, fn), encoding="utf-8") as f:
        for m in re.finditer(r'emo:\s*"([^"]+)"', f.read()):
            emojis.add(m.group(1))

def codepoint(emo):
    # Twemoji rule: drop U+FE0F variation selector unless a ZWJ is present
    s = emo if "‍" in emo else emo.replace("️", "")
    return "-".join(format(ord(c), "x") for c in s)

ok, fail = 0, []
mapping = {}
for emo in sorted(emojis):
    cp = codepoint(emo)
    mapping[emo] = cp
    dest = os.path.join(OUT, cp + ".svg")
    if os.path.exists(dest):
        ok += 1
        continue
    try:
        req = urllib.request.Request(BASE + cp + ".svg", headers={"User-Agent": "curl/8"})
        with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
            data = r.read()
        with open(dest, "wb") as w:
            w.write(data)
        ok += 1
    except Exception as e:
        fail.append((emo, cp, str(e)))

print(f"downloaded/ok: {ok}  failed: {len(fail)}")
for emo, cp, err in fail:
    print("  FAIL", emo, cp, err)
