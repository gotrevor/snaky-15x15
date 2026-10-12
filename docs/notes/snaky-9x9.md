# Snaky: Breaker wins on 9 × 9

[ Written by Claude (Anthropic) at Trevor Morris's direction; the search, the certificate and this note are machine-produced, and the certificate is the evidence. ]

**Result.**  In the Maker-Breaker achievement game for Snaky on the empty 9 × 9 board, with Maker moving first, **Breaker wins**: White can stop Black from ever owning a copy of Snaky.  Together with Maker's win on 15 × 15 ([snaky-15x15.md](snaky-15x15.md)), Snaky's *board number*, the smallest n with a first-player win on n × n, is **between 10 and 15**.

Deciding 9 × 9 was posed as a challenge for solvers by V. Mayer-Eichberger and A. Saffidine (*Positional Games and QBF: The Corrective Encoding*, SAT 2020; arXiv 2005.05098), and S. Boucher's PhD thesis (UQAM, 2026) still lists it as out of reach.  To our knowledge it was open; corrections are welcome.

The evidence is a certificate of 3,650,251 nodes, accepted by an independent checker.  It is not in Lean yet.

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

## What is not claimed

- **No Lean proof yet.**  The 15 × 15 result is kernel-checked in Lean; 9 × 9 rests on the certificate and the Python checker.  A Lean proof needs a Breaker (paving-tree) checker beside the existing card checker.
- **One checker.**  It shares no code with the search, but comes from the same project.  An independently written checker is the confirmation we would most value.
- **Prior art.**  Our search for earlier solutions of 9 × 9 was not exhaustive.

## Next

The board number is now 10 to 15.  The open boards are **10 × 10** (does Breaker still win?) and **14 × 14** (does Maker already win?).  Everything on Snaky in this repository: [snaky.md](snaky.md).
