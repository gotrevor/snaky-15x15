# Snaky: Breaker wins on 9 × 9

[ Written by Claude (Anthropic) at Trevor Morris's direction; the search, the certificate and this note are machine-produced, and the certificate is the evidence. ]

**Result.**  In the Maker-Breaker achievement game for Snaky on the empty 9 × 9 board, with Maker moving first, **Breaker wins**: White can stop Black from ever owning a copy of Snaky.  Together with Maker's win on 15 × 15 ([snaky-15x15.md](snaky-15x15.md)), Snaky's *board number*, the smallest n with a first-player win on n × n, is **between 10 and 15**.

Deciding 9 × 9 was posed as a challenge for solvers by V. Mayer-Eichberger and A. Saffidine (*Positional Games and QBF: The Corrective Encoding*, SAT 2020; arXiv 2005.05098), and S. Boucher's PhD thesis (UQAM, 2026) still lists it as out of reach.  To our knowledge it was open; corrections are welcome.

The evidence is a certificate of 3,650,251 nodes, accepted by an independent checker, and checked in Lean as `Snaky.snaky_loses_9x9` by a checker proved sound (see [In Lean](#in-lean)).

## The game

Snaky is the hexomino {(0,0),(1,0),(2,0),(3,0),(3,1),(4,1)}:

```
. . . . X X
X X X X . .
```

Two players alternately claim empty cells of the board; Black (Maker) moves first.  Black wins on owning all six cells of some copy of Snaky (any rotation or reflection, inside the board); White (Breaker) only blocks.  If the board fills first, White wins.  This is Harary's achievement game in the weak sense, the one in which Snaky's status was the last open hexomino case.

A Breaker win on a board is a Breaker win on every board inside it (a Maker win inside the smaller board would be one on the larger), so 9 × 9 settles every smaller square board too.  Halupczok and Schlage-Puchta proved the 8 × 8 case (*Achieving Snaky*, Integers 7, 2007).

## The certificate

A root that cites one White certificate per Black first move.  Up to the 8 board symmetries Black has 15 first moves; each file proves White wins after Black's move and White's answer:

| Black opens | a1 | b1 | c1 | d1 | e1 | b2 | c2 | d2 | e2 | c3 | d3 | e3 | d4 | e4 | e5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| White answers | e5 | e5 | e5 | e5 | e5 | e5 | e5 | e2 | e5 | e5 | e3 | e5 | e4 | e5 | e4 |

Columns a-i run from the left, rows 1-9 from the bottom.  White mostly takes the centre e5; against d2, d3, d4 and e5 itself, White answers next to Black's stone.  The 15 files hold 3,650,251 nodes; the largest, e2, has 817,303.

Each file is a tree of White replies to every relevant Black move.  Its leaves are *pavings*: disjoint pairs of empty cells such that every placement White has not yet blocked contains a pair, so White wins by answering inside whichever pair Black enters.  This is the leaf rule of Halupczok and Schlage-Puchta's 8 × 8 proof.  The checker's rules are in [snaky-checker.md](snaky-checker.md).

## Check it

[`snaky-9x9-certs.tar`](https://github.com/gotrevor/snaky-15x15/releases/download/9x9-certs/snaky-9x9-certs.tar) (115 MB, release [`9x9-certs`](https://github.com/gotrevor/snaky-15x15/releases/tag/9x9-certs)), sha256 `1b9a126cf2e5d93423302d214818ae83afb5e2efc9d9da2cb33d9ad93a1bbe29`.  It holds the root `release-9x9/snaky-9x9.json`, the 15 gzipped files and their `SHA256SUMS`.  From a clone of this repository:

```
tar -xf snaky-9x9-certs.tar
python3 checker/check.py release-9x9/snaky-9x9.json
VALID white wins 9x9 (16 node-positions checked, 16 nodes, plus 15 cited files / 8484135 node-positions)
```

About 25 minutes on one core and 5 GB of memory, Python standard library only.

## How it was found

Seven first moves (a1 b1 c1 d1 e1 b2 c3) fell to iterative-deepening search.  The other eight used budgeted proof-number search with White's candidates ordered by a learned model.  Every Black reply first gets a small budget; only the replies left open are split further, over White's best few answers; and positions already proved inside earlier certificates, up to symmetry, are imported rather than re-proved.  None of this is needed to check the certificate.

## In Lean

[`gotrevor/positional-games`](https://github.com/gotrevor/positional-games) states the result as `Snaky.snaky_loses_9x9 : LosesOn9x9`, over the same game definition as the 15 × 15 proof (`Game.lean` is copied unchanged from this repository).  The proof has two parts:

- `PositionalGames.Breaker.checkCert_sound`: if the Breaker checker accepts a certificate, White wins.  It is proved from the four rules the checker uses (pavings, an extra White stone never hurts, irrelevant cells, board symmetry), and `#print axioms` lists only `propext`, `Classical.choice` and `Quot.sound` (verified [DATE]).
- The checker run on the encoded certificate (about [N] minutes and [M] GB to build) by `native_decide`, which adds `Lean.ofReduceBool`.

Reproduce: in a clone, `scripts/gen-9x9.sh && lake build Results9x9` (fetches the release above and checks its hash).  The same checker proves Breaker wins on 8 × 9 in a few seconds (`Snaky.snaky_loses_8x9`), and `Results/Controls.lean` checks that it rejects corrupted certificates.

## What is not claimed

- **Not kernel-checked.**  The 15 × 15 result is checked by the Lean kernel; the 9 × 9 certificate is evaluated by `native_decide`, so the compiled checker code is trusted (axiom `Lean.ofReduceBool`).  The checker's soundness theorem is itself kernel-checked and uses no `native_decide`.
- **One project.**  The Python checker shares no code with the search, and the Lean checker is proved sound, but both come from the same project and the Lean one ports the Python one's rules.  An independently written checker is the confirmation we would most value.
- **Prior art.**  Our search for earlier solutions of 9 × 9 was not exhaustive.

## Next

The board number is now 10 to 15.  The open boards are **10 × 10** (does Breaker still win?) and **14 × 14** (does Maker already win?).  Everything on Snaky in this repository: [snaky.md](snaky.md).
