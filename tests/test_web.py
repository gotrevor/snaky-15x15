"""Delegates to the Node suite for the play-White page's engine (web/engine.js on the real card set)."""
import os
import shutil
import subprocess

import pytest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_web_engine():
    r = subprocess.run(["node", "--test", os.path.join(HERE, "web", "test")],
                       capture_output=True, text=True, cwd=HERE)
    assert r.returncode == 0, r.stdout + r.stderr
