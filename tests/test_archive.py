"""The archive is the one published by `verify`; set SNAKY_FULL=1 to run the full check (~12 min)."""
import hashlib
import os
import subprocess
import sys
import tarfile

import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)


def _verify_module():
    import importlib.machinery
    import importlib.util
    loader = importlib.machinery.SourceFileLoader("verify", os.path.join(REPO, "verify"))
    spec = importlib.util.spec_from_loader("verify", loader)
    m = importlib.util.module_from_spec(spec)
    loader.exec_module(m)
    return m


def test_archive_hash_and_contents():
    v = _verify_module()
    assert v.sha256(v.ARCHIVE) == v.ARCHIVE_SHA256
    with tarfile.open(v.ARCHIVE) as tf:
        names = tf.getnames()
        assert len(names) == 1750
        root = tf.extractfile(v.ROOT).read()
    assert hashlib.sha256(root).hexdigest() == v.ROOT_SHA256


@pytest.mark.skipif(os.environ.get("SNAKY_FULL") != "1", reason="full check takes ~12 minutes")
def test_full_check():
    p = subprocess.run([os.path.join(REPO, "verify")], capture_output=True, text=True)
    assert p.returncode == 0 and "VALID black wins 15x15" in p.stdout, p.stdout + p.stderr
