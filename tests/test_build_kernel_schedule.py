"""tools/build-kernel scheduling, driven through the real CLI with a recording-only `lake`.

No Lean process is launched.  A batch must not request a proof module whose proof-module imports
are still unbuilt: Lake would build them inside that batch, outside the memory budget (the glue
module of a split card imports all its pieces).  Regression check from the 2026-10-07 review.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_schedule(tmp_path, *args):
    record = tmp_path / "calls.jsonl"
    fake = tmp_path / "lake"
    fake.write_text("#!/usr/bin/env python3\nimport json, os, sys\n"
                    "with open(os.environ['SNAKY_LAKE_RECORD'], 'a') as f:\n"
                    "    f.write(json.dumps(sys.argv[1:]) + '\\n')\n")
    fake.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ["PATH"],
               SNAKY_LAKE_RECORD=str(record))
    p = subprocess.run([sys.executable, str(ROOT / "tools/build-kernel"), *args],
                       env=env, capture_output=True, text=True, timeout=60)
    assert p.returncode == 0, p.stdout + p.stderr
    return p.stdout, [json.loads(line) for line in record.read_text().splitlines()]


def proof_modules():
    return {m["module"] for g in ("Gen", "Gen17")
            for m in json.loads((ROOT / f"lean/Snaky/{g}/modules.json").read_text())}


def proof_imports(module, mods):
    source = ROOT / "lean" / Path(*module.split(".")).with_suffix(".lean")
    return {line.split()[1] for line in source.read_text().splitlines()
            if line.startswith("import ")} & mods


def test_batches_build_dependencies_first(tmp_path):
    mods = proof_modules()
    _, calls = run_schedule(tmp_path, "--budget", "5.5", "--jobs", "2")
    assert calls[0] == ["build", "Snaky.Gen.Tree", "Snaky.Gen17.Tree"]
    assert calls[-1] == ["build"]
    built, missing = set(), {}
    for call in calls[1:-1]:
        requested = set(call[1:])
        assert requested <= mods and len(requested) <= 2
        for module in requested:
            unbuilt = proof_imports(module, mods) - built
            if unbuilt:
                missing[module] = sorted(unbuilt)
        built |= requested
    assert not missing, f"Unbudgeted proof dependencies pulled in by Lake: {missing}"
    assert built == mods


def test_batches_respect_budget(tmp_path):
    out, _ = run_schedule(tmp_path, "--budget", "5.5", "--jobs", "4")
    for n, gb in re.findall(r"batch \d+/\d+: (\d+) modules, est ([\d.]+) GB", out):
        assert int(n) == 1 or float(gb) <= 5.5
