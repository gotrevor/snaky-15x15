import Snaky.CardsSound
import Snaky.Gen17.All

/-!
# Snaky is a first-player win on 17 × 17, within 20 Black moves

The strategy is Nándor Sieben's 20-move proof sequence for Snaky
([github.com/nandorsieben/Snaky](https://github.com/nandorsieben/Snaky),
`proof-sequence-20.html.gz`), which builds on OpenAI's Maker strategy (*Snaky in 21 Maker moves*,
2026, problem 187 in [github.com/openai/math](https://github.com/openai/math)).  It is converted to
cards by `../tools/sieben2cards.py` (`../third_party/sieben/cards-17x17.txt`, 1,738 cards, root
height 20); the conversion is untrusted.  The cards are generated as Lean data (`Snaky/Gen17/`, by
`../tools/cards2lean.py --name=Gen17`), the kernel evaluates the checker `cardOK` on every card in
chunks (`decide +kernel`, no `native_decide`), and `CTree.sound_in` proves an accepted card set
whose root card has height at most `k` gives `BlackWinsIn … k`.  This is the same checker and
soundness proof as `snaky_wins_15x15`.
-/
namespace Snaky

/-- The root card 1737 of the 17 × 17 set has height at most 20. -/
theorem Gen17.root_height : (Gen17.getK 1737).all (fun c => decide (c.h ≤ 20)) = true := by
  decide +kernel

/-- **Snaky is a first-player win on 17 × 17 within 20 Black moves.**  On the empty 17-row ×
17-column board Black (Maker), moving first, forces a copy of Snaky by her 20th move.

English proof: as for `snaky_wins_15x15`, each card (A, S, p, h) says "Black owns A, White owns
nothing in S, Black plays p and wins within h moves"; the checker verifies that each White reply
inside S, and a White move outside S, is answered by a card of lower height, and that the root card
(A empty, h = 20) fits on the board.  Black opens at the centre, cell 144 = (8, 8). -/
theorem snaky_wins_17x17_in_20 : BlackWinsIn (placements 17 17 snaky) (17 * 17) 20 [] [] :=
  CTree.sound_in Gen17.tree_ok Gen17.root_ok Gen17.root_height

/-- **Snaky is a first-player win on 17 × 17.** -/
theorem snaky_wins_17x17 : BlackWins (placements 17 17 snaky) (17 * 17) [] [] :=
  snaky_wins_17x17_in_20.toBlackWins

/-- Non-vacuity anchor: `8 · 13 · 16 = 1664` placements on 17 × 17. -/
theorem placements_17x17_length : (placements 17 17 snaky).length = 1664 := by decide +kernel

/-- Every Snaky placement on 17 × 17 has six distinct cells. -/
theorem placements_17x17_six : ∀ p ∈ placements 17 17 snaky, p.Nodup ∧ 5 < p.length := by
  decide +kernel

/-- Teeth for the move bound: Black cannot force Snaky on 17 × 17 within 5 moves. -/
theorem snaky_not_in_5_17x17 : ¬ BlackWinsIn (placements 17 17 snaky) (17 * 17) 5 [] [] :=
  not_blackWinsIn_of_short placements_17x17_six

end Snaky
