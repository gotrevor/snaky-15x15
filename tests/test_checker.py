"""The checker accepts the small fixture certificates and rejects each one after a mutation
that the rules forbid by construction (a check that cannot fail is not a check)."""
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CHECK = os.path.join(os.path.dirname(HERE), "checker", "check.py")
FIX = os.path.join(HERE, "fixtures")


def check(path):
    p = subprocess.run([sys.executable, CHECK, str(path)], capture_output=True, text=True)
    return p.returncode, p.stdout


def load(name):
    return json.load(open(os.path.join(FIX, name)))


def mutated(tmp_path, cert):
    p = tmp_path / "mut.json"
    p.write_text(json.dumps(cert))
    return check(p)


def test_fixtures_valid():
    assert check(os.path.join(FIX, "white-7x7.json"))[1].startswith("VALID white wins 7x7")
    assert check(os.path.join(FIX, "black-4x4-L4.json"))[1].startswith("VALID black wins 4x4")
    rc, out = check(os.path.join(FIX, "split", "top.json"))
    assert rc == 0 and out.startswith("VALID black wins 15x15") and "cited files" in out, out


def test_drop_pair(tmp_path):
    c = load("white-7x7.json")
    for n in c["nodes"]:
        if "pave" in n and n["pave"]:
            n["pave"].pop()
    rc, out = mutated(tmp_path, c)
    assert rc == 1 and "contains no pair" in out, out


def test_overlapping_pairs(tmp_path):
    c = load("white-7x7.json")
    leaf = next(n for n in c["nodes"] if "pave" in n and len(n["pave"]) >= 2)
    leaf["pave"][1][0] = leaf["pave"][0][0]
    assert mutated(tmp_path, c)[0] == 1


def test_missing_black_move(tmp_path):
    c = load("white-7x7.json")
    c["nodes"][c["root"]]["moves"].pop(0)
    rc, out = mutated(tmp_path, c)
    assert rc == 1 and "no answer to Black move" in out, out


def test_reply_on_occupied_cell(tmp_path):
    c = load("white-7x7.json")
    root = c["nodes"][c["root"]]
    b, w, child = root["moves"][0]
    root["moves"][0] = [b, b, child]
    rc, out = mutated(tmp_path, c)
    assert rc == 1 and "not free" in out, out


def test_black_won_not_placement(tmp_path):
    c = load("black-4x4-L4.json")
    for n in c["nodes"]:
        if "won" in n:
            n["won"] = n["won"][:-1]
    rc, out = mutated(tmp_path, c)
    assert rc == 1 and "not a placement" in out, out


def test_zone_too_small(tmp_path):
    c = load("black-4x4-L4.json")
    for n in c["nodes"]:
        if "zone" in n and n["pass"] is not None and n["zone"]:
            n["zone"], n["replies"] = [], []
    rc, out = mutated(tmp_path, c)
    assert rc == 1 and "zone misses" in out, out


def test_no_pass_needs_full_zone(tmp_path):
    c = load("black-4x4-L4.json")
    for n in c["nodes"]:
        if "zone" in n:
            n["pass"] = None
    rc, out = mutated(tmp_path, c)
    assert rc == 1 and "no pass child" in out, out


def test_wrong_shape(tmp_path):
    c = load("black-4x4-L4.json")
    c["shape"] = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1]]   # Snaky, not L4
    assert mutated(tmp_path, c)[0] == 1


def test_cite_teeth(tmp_path):
    d = tmp_path / "split"
    shutil.copytree(os.path.join(FIX, "split"), d)
    top = json.load(open(d / "top.json"))
    # 1. the same proof claimed from a different start position
    bad = dict(top, black=top["black"][:1])
    (d / "bad.json").write_text(json.dumps(bad))
    rc, out = check(d / "bad.json")
    assert rc != 0 and out.startswith("INVALID"), out
    # 2. a cited file tampered with: its hash no longer matches
    inner = json.load(open(d / top["nodes"][0]["cite"]))
    victim = d / [n for n in inner["nodes"] if "cite" in n][-1]["cite"]
    data = json.load(open(victim))
    data["nodes"].append({"won": []})
    victim.write_text(json.dumps(data))
    rc, out = check(d / "top.json")
    assert rc != 0 and "sha256 mismatch" in out, out


def test_pass_zone_covers_mirrored_support(tmp_path):
    # Node 3 covers White's right-hand replies by the mirror i -> 18-i, so Black answers them
    # with the mirror image of node 4's strategy, which answers on cell 7 (the image of 11).
    # Node 1's pass leads to node 3, so node 1's zone must contain 7; the listed children never
    # mention it.
    rc, out = check(os.path.join(FIX, "black-1x19-mirror.json"))
    assert rc == 1 and "node 1: zone misses [7]" in out, out
    c = load("black-1x19-mirror.json")
    c["nodes"][1]["zone"].append(7)
    c["nodes"][1]["replies"].append([7, 10])
    rc, out = mutated(tmp_path, c)
    assert rc == 0 and out.startswith("VALID black wins 1x19"), out


def _subtree(c, ch, black, white):
    """The white-claim subtree under node ch, renumbered, rooted at (black, white)."""
    order, out, stack = {}, [], [(ch, False)]
    while stack:
        i, done = stack.pop()
        if i in order:
            continue
        nd = c["nodes"][i]
        if done or "moves" not in nd:
            if "moves" in nd:
                nd = {"moves": [[b, w, order[x]] for b, w, x in nd["moves"]]}
            order[i] = len(out)
            out.append(nd)
            continue
        stack.append((i, True))
        stack.extend((x, False) for _, _, x in nd["moves"] if x not in order)
    return {**{k: c[k] for k in ("format", "claim", "rows", "cols", "shape")},
            "black": black, "white": white, "root": order[ch], "nodes": out}


def test_white_cite_teeth(tmp_path):
    """White citations (the 9 x 9 layout): the 7 x 7 proof split into one cited file per Black
    first move checks VALID; swapped citations, a dropped first move and a tampered part fail."""
    import hashlib
    c = load("white-7x7.json")
    moves, nodes = [], []
    for b, w, ch in c["nodes"][c["root"]]["moves"]:
        part = tmp_path / f"first-{b}.json"
        part.write_text(json.dumps(_subtree(c, ch, [b], [w])))
        moves.append([b, w, len(nodes)])
        nodes.append({"cite": part.name, "sha256": hashlib.sha256(part.read_bytes()).hexdigest()})
    assert len(moves) > 1
    top = {**{k: c[k] for k in ("format", "claim", "rows", "cols", "shape")},
           "black": [], "white": [], "root": len(nodes), "nodes": nodes + [{"moves": moves}]}
    p = tmp_path / "top.json"
    p.write_text(json.dumps(top))
    rc, out = check(p)
    assert rc == 0 and out.startswith("VALID white wins 7x7") and "cited files" in out, out
    swapped = [[moves[0][0], moves[0][1], moves[1][2]], [moves[1][0], moves[1][1], moves[0][2]]]
    for bad_moves in (swapped + moves[2:], moves[1:]):
        bad = dict(top, nodes=nodes + [{"moves": bad_moves}], root=len(nodes))
        q = tmp_path / "bad.json"
        q.write_text(json.dumps(bad))
        assert check(q)[0] != 0
    victim = tmp_path / "first-{}.json".format(moves[0][0])
    data = json.loads(victim.read_text())
    data["nodes"].append({"pave": []})
    victim.write_text(json.dumps(data))
    rc, out = check(p)
    assert rc != 0 and "sha256 mismatch" in out, out
