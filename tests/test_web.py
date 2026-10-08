"""Delegates to the Node suite for the play-White page's engine (web/engine.js on the real card set)."""
import glob
import os
import shutil
import subprocess

import pytest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_web_engine():
    # Files, not the directory: older Node (the CI runner's) reads a directory argument as a file.
    files = sorted(glob.glob(os.path.join(HERE, "web", "test", "*.test.mjs")))
    assert files
    r = subprocess.run(["node", "--test", *files],
                       capture_output=True, text=True, cwd=HERE)
    assert r.returncode == 0, r.stdout + r.stderr
