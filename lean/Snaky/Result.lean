import Snaky.CardsSound
import Snaky.CardData

/-!
# Snaky is a first-player win on 15 × 15

Proof: the card set `../cert/snaky-15x15-cards.txt` (8,671 cards, compressed from the tree
certificate `../cert/snaky-15x15.tar.gz`) passes the Lean card checker `CardSet.ok`, evaluated by
`native_decide`, and `CardSet.sound` proves any accepted card set gives `BlackWins`.
-/
namespace Snaky

/-- The card set is accepted (compiled evaluation, about half a second). -/
theorem cards15_ok : cards15.ok = true ∧ cards15.rows = 15 ∧ cards15.cols = 15 := by
  native_decide

/-- **Snaky is a first-player win on 15 × 15.**  On the empty 15-row × 15-column board Black
(Maker), moving first, forces a copy of Snaky.

English proof: each card (A, S, p, h) says "Black owns A, White owns nothing in S, Black plays p
and wins within h moves"; the checker verifies each White reply inside S, and a White move
outside S, is answered by a card of lower height, and the root card (A empty, h = 25) fits on the
board.  Black opens at the centre `h8` (cell 112).  Independent evidence: `./verify` checks the
tree certificate in Python. -/
theorem snaky_wins_15x15 : BlackWins (placements 15 15 snaky) (15 * 15) [] [] := by
  obtain ⟨h, hr, hc⟩ := cards15_ok
  have := CardSet.sound h
  rwa [hr, hc] at this

theorem wins_on_some_board : WinsOnSomeBoard := ⟨15, 15, snaky_wins_15x15⟩

end Snaky
