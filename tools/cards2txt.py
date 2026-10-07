#!/usr/bin/env -S uv run --quiet python3
"""Convert a card set (JSON, format snaky-cards-v1) to the integer text format the Lean checker
reads (`lean/Snaky/Cards.lean`, `parseCards`).  The text is untrusted data: the Lean soundness
theorem holds for whatever the parser returns, so this script needs no review.

Format (whitespace-separated integers; one card per line for readability):

    snaky-cards-txt-v1 ROWS COLS ROOT K DX DY      root card index and its placement on the board
    H PX PY  NA [X Y]*NA  NS [X Y]*NS  PASS  NR [WX WY J K DX DY]*NR

PASS is `J K DX DY` (card J under orientation K, then the translation) or `-1`.  K indexes the 8
matrices (a, b, c, d), (x, y) -> (a x + b y, c x + d y), in the order of `ORIENT` below (the same
order as `Snaky.orients` in Lean).

usage: cards2txt.py CARDS.json OUT.txt
"""
import json
import sys

ORIENT = [(1, 0, 0, 1), (-1, 0, 0, 1), (0, -1, 1, 0), (0, 1, 1, 0),
          (-1, 0, 0, -1), (1, 0, 0, -1), (0, 1, -1, 0), (0, -1, -1, 0)]


def move(m, dx, dy, pts):
    a, b, c, d = m
    return [(a * x + b * y + dx, c * x + d * y + dy) for (x, y) in pts]


def root_hint(doc):
    """First card with A = {} that fits on the board under some orientation and translation."""
    rows, cols = doc["rows"], doc["cols"]
    if doc.get("root") is not None:
        order = [doc["root"]] + list(range(len(doc["cards"])))
    else:
        order = range(len(doc["cards"]))
    for j in order:
        c = doc["cards"][j]
        if c["A"]:
            continue
        for k, m in enumerate(ORIENT):
            img = move(m, 0, 0, c["S"])
            mx, my = min(x for x, _ in img), min(y for _, y in img)
            for dx in range(-mx, cols - mx):
                for dy in range(-my, rows - my):
                    if all(0 <= x < cols and 0 <= y < rows for x, y in move(m, dx, dy, c["S"])):
                        return j, k, dx, dy
    return -1, 0, 0, 0


def hint(h):
    j, m, dx, dy = h
    return [j, ORIENT.index(tuple(m)), dx, dy]


def convert(doc):
    out = ["snaky-cards-txt-v1 %d %d %d %d %d %d" % (doc["rows"], doc["cols"], *root_hint(doc))]
    for c in doc["cards"]:
        t = [c["height"], *c["move"], len(c["A"])]
        for p in c["A"]:
            t += p
        t.append(len(c["S"]))
        for p in c["S"]:
            t += p
        t += hint(c["pass"]) if c.get("pass") is not None else [-1]
        reps = c.get("replies", [])
        t.append(len(reps))
        for r in reps:
            t += [*r[0], *hint(r[1:])]
        out.append(" ".join(map(str, t)))
    return "\n".join(out) + "\n"


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    doc = json.load(open(sys.argv[1]))
    open(sys.argv[2], "w").write(convert(doc))


if __name__ == "__main__":
    main()
