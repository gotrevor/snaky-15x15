# AGENTS.md

- **Changes reach `main` through a PR, squash-merged.**  Work on a branch; never push or fast-forward `main` directly.  This is not a trunk repo, so `hooks.allowDirectMain` stays unset.
- `./verify` checks the certificate (about 12 min, Python stdlib only); `cd lean && lake build` checks the Lean theorem.
