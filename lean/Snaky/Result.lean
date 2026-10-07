import Snaky.Game

/-!
# Snaky is a first-player win on 15 × 15

The statement is backed by the certificate in `../cert/snaky-15x15.tar.gz`, which the
independent checker `../checker/check.py` accepts (`../verify`).  The proof is `sorry` until the
checker is ported to Lean and proved sound against `BlackWins`.
-/
namespace Snaky

/-- **Snaky is a first-player win on 15 × 15.**  On the empty 15-row × 15-column board Black
(Maker), moving first, forces a copy of Snaky.

Evidence: `cert/snaky-15x15.tar.gz`, root `snaky-15x15/root/snaky-15x15.json` (sha256
`e9cd50f3…4997243`); `./verify` prints `VALID black wins 15x15 (25 node-positions checked,
25 nodes, plus 1749 cited files / 145906126 node-positions)`.  English proof: Black opens at
the centre `h8` (cell 112); a pass proof covers every White reply outside a 107-cell zone, and
each of the zone's 22 symmetry classes has its own certificate (`docs/notes/snaky.md`).
Confidence 95%: the residual risk is a checker bug or a mismatch between the checker's game and
`BlackWins`. -/
theorem snaky_wins_15x15 : BlackWins (placements 15 15 snaky) (15 * 15) [] [] := by
  sorry

theorem wins_on_some_board : WinsOnSomeBoard := ⟨15, 15, snaky_wins_15x15⟩

end Snaky
