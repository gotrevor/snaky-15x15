"""tools/deploy-web refuses to deploy anything but a clean checkout of origin/main (a Pages deploy
replaces the whole site, so a stale branch silently removes newer pages).  No network: a local
bare repo plays origin, and the refusals happen before any build or deploy."""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sh(cwd, *args):
    subprocess.run(args, cwd=cwd, check=True, capture_output=True)


def clone_with_origin(tmp_path):
    origin, work = tmp_path / "origin.git", tmp_path / "work"
    sh(tmp_path, "git", "init", "-q", "--bare", "-b", "main", str(origin))
    sh(tmp_path, "git", "clone", "-q", str(origin), str(work))
    os.makedirs(work / "tools")
    shutil.copy(os.path.join(ROOT, "tools", "deploy-web"), work / "tools" / "deploy-web")
    for args in (["add", "."], ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.hooksPath=/dev/null", "commit", "-qm", "a"],
                 ["push", "-q", "origin", "main"]):
        sh(work, "git", *args)
    return work


def deploy(work):
    return subprocess.run([sys.executable, str(work / "tools" / "deploy-web"), "--nine", "x"],
                          capture_output=True, text=True)


def test_refuses_a_commit_that_is_not_origin_main(tmp_path):
    work = clone_with_origin(tmp_path)
    sh(work, "git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.hooksPath=/dev/null", "commit", "-q", "--allow-empty", "-m", "b")
    r = deploy(work)
    assert r.returncode != 0 and "is not origin/main" in r.stderr


def test_refuses_uncommitted_changes(tmp_path):
    work = clone_with_origin(tmp_path)
    (work / "stray.txt").write_text("x")
    r = deploy(work)
    assert r.returncode != 0 and "uncommitted changes" in r.stderr and "stray.txt" in r.stderr
