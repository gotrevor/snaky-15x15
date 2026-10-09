"""Teeth for the kernel-checked data path (`tools/cards2lean.py`, `CTree`, `decide +kernel`): the
hand-worked card set of tests/test_lean_cards.py, emitted as Lean by the generator's own `card`
function, is accepted by the kernel, and a set with a height that does not drop is rejected.  Plus:
the committed `lean/Snaky/Gen/` and `lean/Snaky/Gen17/` are exactly what the generator writes from the
committed card text, and the kernel rejects a 20-move bound lowered to 19.

Needs `cd lean && lake build Snaky.CardsSound` (seconds).
"""
import filecmp
import importlib.machinery
import importlib.util
import os
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEAN = os.path.join(ROOT, "lean")
GEN = os.path.join(ROOT, "tools", "cards2lean.py")
CARDS = os.path.join(ROOT, "cert", "snaky-15x15-cards.txt")
SIEBEN = os.path.join(ROOT, "third_party", "sieben", "cards-17x17.txt")


def load_gen():
    loader = importlib.machinery.SourceFileLoader("cards2lean", GEN)
    spec = importlib.util.spec_from_loader("cards2lean", loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


P1 = [(0, 0), (1, 0), (2, 0), (3, 0), (3, 1), (4, 1)]
ID = 0  # orientation index of the identity


def fixture(x_height=2):
    """L0, L5, X of tests/test_lean_cards.py, in the generator's card format."""
    L0 = {"A": P1[1:], "S": P1, "p": (0, 0), "h": 1, "pass": None, "replies": []}
    L5 = {"A": P1[:4] + [(3, 1)], "S": P1, "p": (4, 1), "h": 1, "pass": None, "replies": []}
    X = {"A": [(1, 0), (2, 0), (3, 0), (3, 1), (4, 1)],
         "S": [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (3, 1), (4, 1), (5, 1)],
         "p": (4, 0), "h": x_height, "pass": (0, ID, 0, 0),
         "replies": [((0, 0), (1, ID, 1, 0)), ((5, 1), (0, ID, 0, 0))]}
    return [L0, L5, X]


def lean_file(tmp_path, src):
    f = tmp_path / "T.lean"
    f.write_text(src)
    r = subprocess.run(["lake", "env", "lean", str(f)], cwd=LEAN, capture_output=True, text=True,
                       timeout=600)
    return r.returncode, r.stdout + r.stderr


def kernel_check(tmp_path, cards):
    gen = load_gen()
    defs = "\n".join(f"def c{k} : Card := {gen.card(c)}" for k, c in enumerate(cards))
    src = f"""import Snaky.CardsSound
namespace Snaky.T
{defs}
def tree : CTree := .node 1 (.leaf 0 c0) (.node 2 (.leaf 1 c1) (.leaf 2 c2))
theorem ok : tree.all (cardOK tree.get) = true := by decide +kernel
end Snaky.T
"""
    return lean_file(tmp_path, src)


def test_kernel_accepts_hand_worked_set(tmp_path):
    rc, out = kernel_check(tmp_path, fixture())
    assert rc == 0, out


def test_kernel_rejects_height_that_does_not_drop(tmp_path):
    rc, out = kernel_check(tmp_path, fixture(x_height=1))
    assert rc != 0 and "proved that the proposition" in out and "is false" in out, out


@pytest.mark.parametrize("cards,name", [(CARDS, "Gen"), (SIEBEN, "Gen17")])
def test_generated_lean_is_current(tmp_path, cards, name):
    out = tmp_path / "lean"
    subprocess.run([sys.executable, GEN, cards, str(out), f"--name={name}"], check=True,
                   capture_output=True)
    a, b = os.path.join(LEAN, "Snaky", name), str(out / "Snaky" / name)
    cmp = filecmp.dircmp(a, b)
    assert not (cmp.left_only or cmp.right_only or cmp.diff_files), (
        cmp.left_only, cmp.right_only, cmp.diff_files)
    for name in cmp.common_files:
        assert filecmp.cmp(os.path.join(a, name), os.path.join(b, name), shallow=False), name


def test_no_native_decide():
    hits = []
    for d, _, fs in os.walk(os.path.join(LEAN, "Snaky")):
        for f in fs:
            text = open(os.path.join(d, f)).read() if f.endswith(".lean") else ""
            if "by native_decide" in text or "decide +native" in text:
                hits.append(f)
    assert hits == []


TREE17_OLEAN = os.path.join(LEAN, ".lake", "build", "lib", "lean", "Snaky", "Gen17", "Tree.olean")


@pytest.mark.skipif(not os.path.exists(TREE17_OLEAN), reason="lake build Snaky.Gen17.Tree first")
def test_kernel_rejects_17x17_bound_19(tmp_path):
    # The root card's height is 20, so the bound `CTree.sound_in` needs fails at 19.
    rc, out = lean_file(tmp_path, """import Snaky.Gen17.Tree
example : (Snaky.Gen17.getK 1737).all (fun c => decide (c.h ≤ 19)) = true := by decide +kernel
""")
    assert rc != 0 and "proved that the proposition" in out and "is false" in out, out


RESULT_OLEAN = os.path.join(LEAN, ".lake", "build", "lib", "lean", "Snaky", "Result.olean")
RESULT17_OLEAN = os.path.join(LEAN, ".lake", "build", "lib", "lean", "Snaky", "Result17.olean")
STANDARD = "[propext, Classical.choice, Quot.sound]"


@pytest.mark.skipif(not os.path.exists(RESULT_OLEAN), reason="tools/build-kernel first (~9 min)")
def test_headline_axioms(tmp_path):
    f = tmp_path / "Ax.lean"
    f.write_text("import Snaky\n#print axioms Snaky.snaky_wins_15x15\n")
    r = subprocess.run(["lake", "env", "lean", str(f)], cwd=LEAN, capture_output=True, text=True,
                       timeout=600)
    assert r.stdout.strip() == ("'Snaky.snaky_wins_15x15' depends on axioms: "
                                "[propext, Classical.choice, Quot.sound]"), r.stdout + r.stderr


@pytest.mark.skipif(not os.path.exists(RESULT17_OLEAN), reason="tools/build-kernel first")
def test_headline_axioms_17x17(tmp_path):
    names = ["snaky_wins_17x17_in_20", "snaky_wins_17x17"]
    rc, out = lean_file(tmp_path, "import Snaky\n" + "".join(
        f"#print axioms Snaky.{n}\n" for n in names))
    assert rc == 0 and out.strip().splitlines() == [
        f"'Snaky.{n}' depends on axioms: {STANDARD}" for n in names], out
