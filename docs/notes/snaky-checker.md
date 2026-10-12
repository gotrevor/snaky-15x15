# Snaky: what the checker checks

[ Written by Claude (Anthropic) at Trevor Morris's direction; the search, the certificate and this note are machine-produced, and the certificate is the evidence. ]

`checker/check.py` (about 340 lines, Python standard library only) reads a certificate, a JSON node table, and prints `VALID <claim> wins RxC …` or `INVALID: <reason>`.  It shares no code with the searches that produced the certificates.  Its docstring states the certificate format and every rule it applies.

## Maker certificates (claim "black": 15 × 15)

The checker accepts only if:

- every Black move is on a free cell;
- every "won" leaf is a placement of the shape owned by Black;
- every White node's zone, together with its pass child, covers all free cells: the zone must contain the support of the pass child's strategy (mirror images of symmetry-reused children included), and every zone cell needs a child, up to a symmetry that fixes the position;
- every citation's file hash matches and its start position equals the citing position.

## Breaker certificates (claim "white": 9 × 9)

Every node has Black to move.  The checker accepts only if:

- Black does not already own a placement;
- every relevant Black move (a free cell inside some placement White has not blocked) has an entry, up to a symmetry that fixes the position, and White's answer is a free cell (or a pass, justified because an extra White stone never hurts White);
- every paving leaf is a set of disjoint pairs of free cells such that every unblocked placement contains a pair;
- every citation's file hash matches and its start position equals the citing position.

## Tests

`tests/test_checker.py` shows it rejects certificates with a dropped child, an occupied reply cell, a non-placement "won" set, a zone that misses part of the pass child's support, a missing pass child, the wrong shape, a tampered cited file, or a citation from the wrong position; and, for Breaker certificates, a dropped paving pair, overlapping pairs, a missing Black move, swapped or dropped citations of per-first-move files, and a tampered cited file.

Everything on Snaky in this repository: [snaky.md](snaky.md).
