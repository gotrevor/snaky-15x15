import Snaky.CardsSound
import Snaky.Gen.All

/-!
# Snaky is a first-player win on 15 × 15

Proof: the card set `../cert/snaky-15x15-cards.txt` (8,671 cards, compressed from the tree
certificate `../cert/snaky-15x15.tar.gz`) is generated as Lean data (`Snaky/Gen/`, by
`../tools/cards2lean.py`); the kernel evaluates the checker `cardOK` on every card in chunks
(`decide +kernel`, no `native_decide`), and `CTree.sound` proves any accepted card set gives
`BlackWins`.
-/
namespace Snaky

/-- **Snaky is a first-player win on 15 × 15.**  On the empty 15-row × 15-column board Black
(Maker), moving first, forces a copy of Snaky.

English proof: each card (A, S, p, h) says "Black owns A, White owns nothing in S, Black plays p
and wins within h moves"; the checker verifies each White reply inside S, and a White move
outside S, is answered by a card of lower height, and the root card (A empty, h = 25) fits on the
board.  Black opens at the centre `h8` (cell 112).  Independent evidence: `./verify` checks the
tree certificate in Python. -/
theorem snaky_wins_15x15 : BlackWins (placements 15 15 snaky) (15 * 15) [] [] :=
  CTree.sound Gen.tree_ok Gen.root_ok

theorem wins_on_some_board : WinsOnSomeBoard := ⟨15, 15, snaky_wins_15x15⟩

end Snaky
