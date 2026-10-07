"""Teeth for the Lean card checker (`lean/Snaky/Cards.lean`, run as `lean/.lake/build/bin/cardcheck`),
the same `cardOK` / `rootOK` that `Snaky.snaky_wins_15x15` evaluates.  Unlike the Python card
checker it never searches: every request must carry a hint that checks.

Hand-worked fixture (cells (x, y); Snaky = (0,0) (1,0) (2,0) (3,0) (3,1) (4,1), no symmetry):

    P1 = Snaky                     = (0,0) (1,0) (2,0) (3,0) (3,1) (4,1)
    P2 = P1 shifted by (+1, 0)     = (1,0) (2,0) (3,0) (4,0) (4,1) (5,1)

  L0 (height 1): A = P1 - (0,0), S = P1, move (0,0): A + move = P1, won.
  L5 (height 1): A = P1 - (4,1), S = P1, move (4,1): won.
  X  (height 2): A = (1,0) (2,0) (3,0) (3,1) (4,1), S = P1 | P2, move (4,0); then P1 lacks only
      (0,0) and P2 only (5,1).  Free cells of S: (0,0), (5,1).
        White (0,0): L5 shifted by (+1,0) sits on P2; its A = P2 - (5,1) is Black, its S = P2
                     avoids (0,0).                                                        ok
        White (5,1): L0 unshifted on P1; S = P1 avoids (5,1).                             ok
        pass:        L0 unshifted.                                                        ok

Build first: `cd lean && lake build cardcheck`.
"""
import copy
import json
import os
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXE = os.path.join(ROOT, "lean", ".lake", "build", "bin", "cardcheck")
CONVERT = os.path.join(ROOT, "tools", "cards2txt.py")
REAL = os.path.join(ROOT, "cert", "snaky-15x15-cards.txt")

SHAPE = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1]]
P1 = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1]]
L0 = {"A": [[1, 0], [2, 0], [3, 0], [3, 1], [4, 1]], "S": P1, "move": [0, 0], "height": 1}
L5 = {"A": [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]], "S": P1, "move": [4, 1], "height": 1}
X = {"A": [[1, 0], [2, 0], [3, 0], [3, 1], [4, 1]],
     "S": [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [3, 1], [4, 1], [5, 1]],
     "move": [4, 0], "height": 2}
ID = [1, 0, 0, 1]

pytestmark = pytest.mark.skipif(not os.path.exists(EXE), reason="cd lean && lake build cardcheck")


def hinted():
    x = copy.deepcopy(X)
    x["replies"] = [[[0, 0], 1, ID, 1, 0],      # L5 shifted onto P2
                    [[5, 1], 0, ID, 0, 0]]      # L0 on P1
    x["pass"] = [0, ID, 0, 0]
    return {"format": "snaky-cards-v1", "rows": 15, "cols": 15, "shape": SHAPE, "root": None,
            "cards": [copy.deepcopy(L0), copy.deepcopy(L5), x]}


def run(tmp_path, doc, *flags):
    js, txt = tmp_path / "cards.json", tmp_path / "cards.txt"
    js.write_text(json.dumps(doc))
    subprocess.run([sys.executable, CONVERT, str(js), str(txt)], check=True)
    return cardcheck(txt, *flags)


def cardcheck(path, *flags):
    r = subprocess.run([EXE, str(path), *flags], capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout.strip()


def test_hinted_set_valid(tmp_path):
    assert run(tmp_path, hinted(), "--no-root") == (0, "VALID cards=3 root=skipped")


def test_no_root_card(tmp_path):
    # No card has A = {}; cards2txt writes root -1, which names no card with A empty.
    rc, out = run(tmp_path, hinted())
    assert rc == 1 and out.startswith("INVALID: root card"), out


def test_wrong_hint_rejected(tmp_path):
    # White (0,0) answered by L0 unshifted: L0's S = P1 contains the White stone (0,0).  The
    # Python checker falls back to search here; the Lean checker has no search and rejects.
    d = hinted()
    d["cards"][2]["replies"][0] = [[0, 0], 0, ID, 0, 0]
    assert run(tmp_path, d, "--no-root") == (1, "INVALID: card 2 not justified (1 cards fail)")


def test_missing_reply_hint(tmp_path):
    d = hinted()
    del d["cards"][2]["replies"][1]
    assert run(tmp_path, d, "--no-root") == (1, "INVALID: card 2 not justified (1 cards fail)")


def test_missing_pass_hint(tmp_path):
    d = hinted()
    d["cards"][2]["pass"] = None
    assert run(tmp_path, d, "--no-root") == (1, "INVALID: card 2 not justified (1 cards fail)")


def test_height_must_drop(tmp_path):
    d = hinted()
    d["cards"][2]["height"] = 1      # hints need height < 1: none
    assert run(tmp_path, d, "--no-root") == (1, "INVALID: card 2 not justified (1 cards fail)")


def test_enlarged_required_set(tmp_path):
    # L0 now requires Black on (2,1) too: still won, but under the identity its A is no longer
    # inside X's Black stones, so X's (5,1) and pass hints fail.
    d = hinted()
    d["cards"][0]["A"].append([2, 1])
    d["cards"][0]["S"] = d["cards"][0]["S"] + [[2, 1]]
    assert run(tmp_path, d, "--no-root") == (1, "INVALID: card 2 not justified (1 cards fail)")


def test_unwon_height1_card(tmp_path):
    # L0 with move (4,0) instead of (0,0): (4,0) is not in its region.
    d = hinted()
    d["cards"][0]["move"] = [4, 0]
    rc, out = run(tmp_path, d, "--no-root")
    assert rc == 1 and out.startswith("INVALID: card 0 not justified"), out


@pytest.mark.skipif(not os.path.exists(REAL), reason="card set missing")
def test_real_set():
    assert cardcheck(REAL) == (0, "VALID cards=8671 root=0 board=15x15")


@pytest.mark.skipif(not os.path.exists(REAL), reason="card set missing")
def test_real_set_root_height_budget(tmp_path):
    # Root card 0 has height 25; at 113, 2 h = 226 > 225 cells, so the free-cell budget fails.
    lines = open(REAL).read().split("\n")
    head = lines[1].split(" ")
    assert head[0] == "25"
    head[0] = "113"
    lines[1] = " ".join(head)
    p = tmp_path / "mut.txt"
    p.write_text("\n".join(lines))
    assert cardcheck(p) == (1, "INVALID: root card 0 does not cover the empty 15x15 board")


@pytest.mark.skipif(not os.path.exists(REAL), reason="card set missing")
def test_real_set_corrupt_card(tmp_path):
    # Raise the most-used finishing card's height from 1 to 30: it stays won (a won card needs
    # no hints), but every card that cites it now cites a card that is not lower.
    lines = open(REAL).read().split("\n")
    row = lines[1 + 8665].split(" ")
    assert row[0] == "1"
    row[0] = "30"
    lines[1 + 8665] = " ".join(row)
    p = tmp_path / "mut.txt"
    p.write_text("\n".join(lines))
    rc, out = cardcheck(p)
    assert rc == 1 and out.startswith("INVALID: card "), out
