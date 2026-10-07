# Snaky is a first-player win on 15 × 15

In Harary's achievement game for the Snaky hexomino (weak / maker-breaker version), the first
player wins on the empty 15 × 15 board, and hence on the plane.  The evidence is an explicit
strategy-tree certificate checked by an independent checker:

```sh
./verify        # ~12 min, Python stdlib only
# VALID black wins 15x15 (25 node-positions checked, 25 nodes, plus 1749 cited files / 145906126 node-positions)
```

- `cert/snaky-15x15.tar.gz`: the certificate (1,750 JSON files, sha256 in `verify`)
- `checker/check.py`: the checker; `tests/`: its tests, including rejection of corrupted certificates
- `lean/`: the game and the statement `Snaky.snaky_wins_15x15` (proof pending: `sorry`)
- `docs/notes/snaky.md`: context, method, and what remains open

Apache-2.0.
