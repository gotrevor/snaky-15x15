# Snaky is a first-player win on 15 × 15

[ Written by Claude (Anthropic) at Trevor Morris's direction; the search, the certificate and this note are machine-produced, and the certificate is the evidence. ]

## The result

In the weak (maker-breaker) achievement game for Snaky, the hexomino {(0,0),(1,0),(2,0),(3,0),(3,1),(4,1)}, the first player (Maker, "Black") wins on the empty 15 × 15 board.  Black claims cells, White claims cells to block, and Black wins on owning all six cells of some copy of Snaky (any rotation or reflection, inside the board).

A win on 15 × 15 is a win on every larger board and on the infinite plane: Black plays the same strategy inside the window and answers any White move outside it with an arbitrary move.

The evidence is a certificate: a Black strategy tree, 1,750 JSON files (93 MB, 12 MB compressed) in `cert/snaky-15x15.tar.gz`, accepted by the stand-alone checker in `checker/check.py`.  `./verify` checks the archive hash, unpacks it, and runs the checker (Python standard library only, about 12 minutes on one core):

```
VALID black wins 15x15 (25 node-positions checked, 25 nodes, plus 1749 cited files / 145906126 node-positions)
```

Root certificate sha256: `e9cd50f338b0e1b71d469bc32ccd41207907b9649c17da88dd8a85b5e4997243`.

## Context

- Harary asked which polyominoes are "winners" in this game; Snaky is the one hexomino whose status stayed open.  As reported on Wikipedia's page on Harary's generalized tic-tac-toe, Harary conjectured that Snaky wins, on a board of size about 15.
- Halupczok and Schlage-Puchta, *Achieving Snaky* (Integers 7, 2007), proved that Snaky loses on 8 × 8, wins in three dimensions, and wins on the plane with one extra Black stone (handicap 1).
- OpenAI, *Snaky in 21 Maker moves* (preprint dated 2026-09-25, `github.com/openai/math`), gives a Maker strategy winning within 21 Maker moves on the plane, proved in Lean 4 for the infinite board; the paper also derives a win on 17 × 17.
- This certificate gives a win on 15 × 15, two rows and columns smaller than the 17 × 17 board in OpenAI's paper, checked as an explicit game tree.

## How the certificate is built

- **Game tree with relevance zones.**  A Black node plays a cell.  A White node lists a zone Z of cells, a certificate child for each White reply in Z, and a "pass" child: a proof that Black wins even if White passes.  Any White move outside Z is covered by the pass child, because a Black win stays a win after extra White stones on cells that the winning subtree never mentions.
- **Symmetry.**  If a board symmetry fixes the current position, one child covers each orbit of White replies.
- **Citations.**  A node may cite another certificate file (by relative path and sha256) whose start position must equal the current position, and the checker verifies it recursively.  This is how the 1,750 files fit together.
- **The opening.**  Black plays the centre h8.  A pass proof for "Black h8, White passes" (Black to move again) has a 107-cell zone, and the 22 symmetry classes of White replies inside it each have their own certificate.
- **The search** that produced the certificate (in a separate working repository, not needed for verification) is a λ-search (threat-space) prover in Rust that writes certificates directly.  It recursively splits a position into "Black plays d, then every White reply in d's zone" sub-proofs, ranks candidate splits with a small convolutional network trained on earlier sub-proof outcomes, and orders its search best-first.
- **The hardest case** was White's reply touching the centre (h7, equivalent to h9, g8, i8).  After Black g8, three White replies resisted the solver's own search: f9, g9 and f8.  They closed once the solver tried the moves of OpenAI's 21-move strategy as first candidates.  For example, Black answers f8 with h11, three rows above the centre, which the solver's candidate generation had never considered.  The proofs themselves are this repository's own trees, checked here; OpenAI's strategy contributed move choices only.  It also needs all 17 columns in this line, so it does not fit 15 × 15 directly.

## What the checker checks

`checker/check.py` (about 330 lines, no dependencies) reads a certificate and accepts only if:

- every Black move is on a free cell;
- every "won" leaf is a placement of the shape owned by Black;
- every White node's zone, together with its pass child, covers all free cells: the zone must contain the support of the pass child, and every zone cell needs a child, up to a symmetry that fixes the position;
- every citation's file hash matches and its start position equals the citing position.

The tests (`tests/test_checker.py`) show it rejects certificates with a dropped child, an occupied reply cell, a non-placement "won" set, a zone that misses part of the pass child's support, a missing pass child, the wrong shape, a tampered cited file, or a citation from the wrong position.  The checker shares no code with the search.

## Lean

`lean/Snaky/Game.lean` defines the game (`placements`, `BlackWins`) without Mathlib; `lean/Snaky/Result.lean` states

```lean
theorem snaky_wins_15x15 : BlackWins (placements 15 15 snaky) (15 * 15) [] []
```

currently proved by `sorry`.  The planned proof ports the checker to Lean, proves it sound against `BlackWins` (the zone rule needs a monotonicity lemma: a Black win survives extra White stones outside the winning subtree's support; the symmetry rule needs invariance of `BlackWins` under board symmetries), and runs it on the certificate.

## Open

- **Smaller boards.**  The certificate uses cells in all 15 rows and columns, so it says nothing directly about 13 × 13 or 14 × 14.  Thirteen of the 22 opening replies have sub-proofs that fit in 13 × 13 windows (at different offsets); the replies touching the centre use the full width.  The search never tried to keep proofs compact.
- **Fewest moves.**  The certificate does not minimise the number of Black moves.

## Reproduce

```sh
./verify                                            # about 12 minutes
uv run --with pytest pytest -q tests                # checker teeth tests; SNAKY_FULL=1 adds the full check
cd lean && lake build                               # the statement (sorry)
```
