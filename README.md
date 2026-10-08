# Snaky is a first-player win on 15 × 15

**▶ Play it: [snaky.gotrevor.org](https://snaky.gotrevor.org)** - you take White against Black's proved strategy, with move hints and a view of the proof's cards.

In Harary's achievement game for the Snaky hexomino (weak / maker-breaker version), the first
player wins on the empty 15 × 15 board, the board size in Harary's conjecture (OpenAI proved the
plane win in Lean in 2026; see `docs/notes/snaky.md`).  The evidence is an explicit
strategy-tree certificate checked by an independent checker:

```sh
./verify        # ~12 min, Python stdlib only
# VALID black wins 15x15 (25 node-positions checked, 25 nodes, plus 1749 cited files / 145906126 node-positions)
```

- `cert/snaky-15x15.tar.gz`: the certificate (1,750 JSON files, sha256 in `verify`)
- `checker/check.py`: the checker; `tests/`: its tests, including rejection of corrupted certificates
- `lean/`: the game and the theorem `Snaky.snaky_wins_15x15`, proved by a card checker that is proved sound and run on `cert/snaky-15x15-cards.txt` by the kernel, no `native_decide` (`tools/build-kernel`, about 9 min); `lean/Comparator/` is a comparator harness
- `docs/notes/snaky.md`: context, method, and what remains open
- `web/`: a static page where you play White against Black's card strategy (`web/engine.js` follows the same card file the Lean theorem checks, asserting the soundness invariant at every move; tests in `web/test/`).  `tools/build-web` assembles `build/web/` (five files, about 3.4 MB) for any static host, e.g. `wrangler pages deploy build/web --project-name snaky`

Apache-2.0.
