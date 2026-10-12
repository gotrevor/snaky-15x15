# Snaky: results

[ Written by Claude (Anthropic) at Trevor Morris's direction; the search, the certificate and this note are machine-produced, and the certificate is the evidence. ]

**▶ Play it: [snaky.gotrevor.org](https://snaky.gotrevor.org)** - you take White against the strategy the Lean proof checks.  Optional hints score every White move, and "Show the proof's view" shades the region the current card covers.

Snaky is the hexomino {(0,0),(1,0),(2,0),(3,0),(3,1),(4,1)}.  In its weak (maker-breaker) achievement game, Black (Maker) and White (Breaker) alternately claim cells of a board, Black first; Black wins on owning all six cells of some copy of Snaky (any rotation or reflection, inside the board), and White wins by preventing that.  A Maker win on a board carries to every larger board and to the plane; a Breaker win carries to every smaller board.

## Results

| Board | Result | Evidence | Details |
|---|---|---|---|
| 9 × 9 | **Breaker wins** (2026-10-12) | certificate, 3.65 M nodes, independent checker | [snaky-9x9.md](snaky-9x9.md) |
| 15 × 15 | **Maker wins** (2026-10-07) | Lean, kernel-checked (`snaky_wins_15x15`); certificate, 1,750 files | [snaky-15x15.md](snaky-15x15.md) |
| 17 × 17 | **Maker wins within 20 moves** (Sieben's sequence, from OpenAI's strategy) | Lean, kernel-checked (`snaky_wins_17x17_in_20`) | [snaky-17x17.md](snaky-17x17.md) |

So Snaky's **board number**, the smallest n with a first-player win on n × n, is **between 10 and 15**.  How the certificates are checked: [snaky-checker.md](snaky-checker.md).

## Context


- Harary asked which polyominoes are "winners" in this game; Snaky is the one hexomino whose status stayed open.  Harary conjectured that Snaky is a winner, "and furthermore that this should be the case for boards of size 15 × 15 and more, at least" (S. Boucher and R. Villemaire, *Quantified Boolean Solving for Achievement Games*, KI 2021, LNAI 12873, pp. 30-43, citing M. Gardner, Mathematical Games, *Scientific American* 240(4), April 1979).  Beck, *Combinatorial Games: Tic-Tac-Toe Theory* (2008), traces the conjecture to a colleague of Harary who won every game on that board as first player (as cited in S. Boucher, PhD thesis, UQAM, January 2026, §7, which still lists Snaky's status as open).
- Halupczok and Schlage-Puchta, *Achieving Snaky* (Integers 7, 2007), proved that Snaky loses on 8 × 8, wins in three dimensions, and wins on the plane with one extra Black stone (handicap 1).
- OpenAI, *Snaky in 21 Maker moves* (2026): Maker wins on the plane within 21 moves, and on 17 × 17 (paper corollary; checked here in Lean via Sieben's 20-move sequence, [snaky-17x17.md](snaky-17x17.md)).
- V. Mayer-Eichberger and A. Saffidine, *Positional Games and QBF: The Corrective Encoding* (SAT 2020; arXiv 2005.05098), posed 9 × 9 as a challenge for solvers; settled in [snaky-9x9.md](snaky-9x9.md).

## Open

- **The board number: 10 to 15.**  The next boards are 10 × 10 (does Breaker still win?) and 14 × 14 (does Maker already win?).
- **9 × 9 in Lean**, which needs a Breaker (paving-tree) checker beside the card checker.
- **Fewest moves** on 15 × 15 and 17 × 17: neither strategy's bound is a proved minimum.

## Reproduce

```sh
./verify                                            # about 18 minutes
uv run --with pytest pytest -q tests                # checker teeth tests; SNAKY_FULL=1 adds the full check
tools/build-kernel                                  # the Lean proof (about 9 minutes, kernel-checked)
tar -xf snaky-9x9-certs.tar && python3 checker/check.py release-9x9/snaky-9x9.json   # 9 x 9, about 25 minutes
```
