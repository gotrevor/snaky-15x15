# Snaky is a first-player win on 15 × 15

[ Written by Claude (Anthropic) at Trevor Morris's direction; the search, the certificate and this note are machine-produced, and the certificate is the evidence. ]

## OpenAI's result, and what this adds

OpenAI's preprint *Snaky in 21 Maker moves* (2026-09-25, problem 187 in [`github.com/openai/math`](https://github.com/openai/math)) settled the open question: the first player (Maker) wins Snaky on the empty infinite board, within 21 of its own moves.  Their Lean 4 proof covers the infinite board.  The paper also shows (Corollary 6) that the same bound holds on a 17 × 17 board, because Maker's claims stay inside a fixed 251-cell region; that finite-board statement is proved on paper, not in Lean.

This repository adds three things:

- **A smaller board, 15 × 15.**  This is the board size in Harary's conjecture (see Context below), two rows and columns smaller than OpenAI's 17 × 17.  A win on 15 × 15 implies the win on the plane, so this is also a second, separately checked proof that Snaky wins on the plane (without OpenAI's 21-move bound).
- **A finite-board Lean proof.**  `snaky_wins_15x15` is stated on the 15 × 15 board and checked by the Lean kernel, with no `native_decide` and only the standard axioms.
- **A different kind of evidence.**  The win is also an explicit game tree (1,750 files) accepted by a stand-alone checker of about 330 lines of Python that shares no code with the search.

OpenAI's work also helped directly: their 21-move strategy supplied the Black moves that closed the last three positions our search could not (see "The hardest case" below).  The proofs of those positions are this repository's own trees.

## The result

In the weak (maker-breaker) achievement game for Snaky, the hexomino {(0,0),(1,0),(2,0),(3,0),(3,1),(4,1)}, the first player (Maker, "Black") wins on the empty 15 × 15 board.  Black claims cells, White claims cells to block, and Black wins on owning all six cells of some copy of Snaky (any rotation or reflection, inside the board).

A win on 15 × 15 is a win on every larger board and on the infinite plane: Black plays the same strategy inside the window and answers any White move outside it with an arbitrary move.

The evidence is a certificate: a Black strategy tree, 1,750 JSON files (93 MB, 12 MB compressed) in `cert/snaky-15x15.tar.gz`, accepted by the stand-alone checker in `checker/check.py`.  `./verify` checks the archive hash, unpacks it, and runs the checker (Python standard library only, about 12 minutes on one core):

```
VALID black wins 15x15 (25 node-positions checked, 25 nodes, plus 1749 cited files / 145906126 node-positions)
```

Root certificate sha256: `e9cd50f338b0e1b71d469bc32ccd41207907b9649c17da88dd8a85b5e4997243`.

## Context

- Harary asked which polyominoes are "winners" in this game; Snaky is the one hexomino whose status stayed open.  Harary conjectured that Snaky wins on a 15 × 15 board (S. Boucher, PhD thesis, UQAM 2026, §7, citing Beck, *Combinatorial Games: Tic-Tac-Toe Theory*, 2008, where the conjecture is traced to a colleague of Harary who won every game on that board as first player).  Boucher's thesis (January 2026) lists Snaky's status as open.
- Halupczok and Schlage-Puchta, *Achieving Snaky* (Integers 7, 2007), proved that Snaky loses on 8 × 8, wins in three dimensions, and wins on the plane with one extra Black stone (handicap 1).
- OpenAI, *Snaky in 21 Maker moves* (2026): Maker wins on the plane within 21 moves, and on 17 × 17 (see the section above).

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

with no `sorry`.  The proof does not replay the tree.  The tree certificate is first compressed (by the search repository; the compression is untrusted) into a set of 8,671 *cards*, `cert/snaky-15x15-cards.txt`.  A card (A, S, p, h) says: Black owns the cells A, White owns nothing in the region S, Black to move plays p and wins within h moves.  Cards apply under the 8 board symmetries plus translation.  A card is justified when A + p already holds a placement, or every White reply in S, and a White move outside S, leads to a position covered by a card of lower height.  This is the same kind of composition rule as OpenAI's 728-card strategy, with many more cards because they come from a search rather than a design.

- `lean/Snaky/Cards.lean`: the card checker (`cardOK`, `rootOK`), which reads cards through a lookup function.  Every reply carries a hint (card index and map), which the checker verifies; there is no search.
- `lean/Snaky/CardsSound.lean`: `cards_sound` (and its forms `CTree.sound`, `CardSet.sound`), any accepted card set gives `BlackWins` on the empty board.  It uses induction on the height, with the invariant "Black owns the image of A, White owns nothing in the image of S, and |B| + |W| + 2h ≤ R C" (so both players always have a free cell).  If the card's move is already Black's, Black plays any free cell; an extra Black stone never hurts.  The won case maps the plane placement into `placements` through the symmetries.  Axioms: `propext`, `Classical.choice`, `Quot.sound`.
- `lean/Snaky/Gen/`: the card set as Lean data, generated by `tools/cards2lean.py` from the card text (a test checks the committed files match): one definition per card, a balanced lookup tree, and about 200 proof modules (`tK.all (cardOK getK) = true`, the two biggest cards in pieces), each discharged by the kernel (`decide +kernel`).  No `native_decide`: `#print axioms Snaky.snaky_wins_15x15` gives `propext`, `Classical.choice`, `Quot.sound`.
- `lean/Snaky/Result.lean`: `snaky_wins_15x15 := CTree.sound Gen.tree_ok Gen.root_ok`.
- `lean/Comparator/Snaky/`: a [comparator](https://github.com/leanprover/comparator) harness.  `Challenge.lean` imports nothing and writes out the game's definitions under their real names, so the claim can be read in one file.

The kernel checks take about 25 CPU minutes; `tools/build-kernel` builds the chunks in batches under a memory budget (no module needs more than about 5 GB), about 9 minutes on a 16-core laptop.  `cd lean && lake build cardcheck && .lake/build/bin/cardcheck ../cert/snaky-15x15-cards.txt` runs the same checker as compiled code in under a second (`VALID cards=8671 root=0 board=15x15`); `tests/test_lean_cards.py` shows it rejects a wrong hint, a missing reply or pass hint, a height that does not drop, an enlarged required set, an unwinnable finishing card, a root with too little room, and a corrupted card in the real set; `tests/test_kernel_cards.py` shows the kernel accepts a hand-worked card set and rejects it when a height does not drop.

## Open

- **Smaller boards.**  The certificate uses cells in all 15 rows and columns, so it says nothing directly about 13 × 13 or 14 × 14.  Thirteen of the 22 opening replies have sub-proofs that fit in 13 × 13 windows (at different offsets); the replies touching the centre use the full width.  The search never tried to keep proofs compact.
- **Fewest moves.**  The certificate does not minimise the number of Black moves.

## Reproduce

```sh
./verify                                            # about 12 minutes
uv run --with pytest pytest -q tests                # checker teeth tests; SNAKY_FULL=1 adds the full check
tools/build-kernel                                  # the Lean proof (about 9 minutes, kernel-checked)
```
