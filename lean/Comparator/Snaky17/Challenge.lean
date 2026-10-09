/-!
# Comparator challenge: Snaky is a first-player win on 17 × 17, within 20 Black moves

Imports nothing.  The definitions below are the project's own (`Snaky/Game.lean`,
`Snaky/Bounded.lean`), written out in full under their real names: the board, Snaky's placements,
the maker-breaker game `BlackWins`, and `BlackWinsIn`, the same game with a budget of Black moves.
`snaky_wins_17x17_in_20` is the claim and `snaky_wins_17x17` its unbounded form.  The strategy is
Nándor Sieben's 20-move proof sequence (github.com/nandorsieben/Snaky), which builds on OpenAI's
Maker strategy (*Snaky in 21 Maker moves*, 2026, github.com/openai/math).

Anchors and controls (proved in `Snaky/Controls.lean`, `Snaky/Bounded.lean`,
`Snaky/Result17.lean`): `placements_17x17_length` counts the placements; the `BlackWins` controls
are those of the 15 × 15 challenge; `domino_wins_1x3_in_2` / `domino_not_in_1_1x3` show the budget
counts Black's moves, and `snaky_not_in_5_17x17` shows it is not vacuous on this board (Snaky has
six cells, so five moves are too few).
-/
set_option warningAsError false

namespace Snaky

/-- Snaky: the I-tetromino plus a skew domino (Halupczok & Schlage-Puchta 2007, Fig. 1). -/
def snaky : List (Int × Int) := [(0, 0), (1, 0), (2, 0), (3, 0), (3, 1), (4, 1)]

/-- Translate so the minimum x and y are 0. -/
def normalize (s : List (Int × Int)) : List (Int × Int) :=
  let mx := (s.map (·.1)).foldl min (s.headD (0, 0)).1
  let my := (s.map (·.2)).foldl min (s.headD (0, 0)).2
  s.map fun p => (p.1 - mx, p.2 - my)

/-- The 8 rotations/reflections (with repetitions for symmetric shapes; harmless). -/
def orientations (s : List (Int × Int)) : List (List (Int × Int)) :=
  let rot : List (Int × Int) → List (Int × Int) := List.map fun p => (-p.2, p.1)
  let refl : List (Int × Int) → List (Int × Int) := List.map fun p => (p.1, -p.2)
  [s, rot s, rot (rot s), rot (rot (rot s)),
   refl s, rot (refl s), rot (rot (refl s)), rot (rot (rot (refl s)))].map normalize

/-- All placements of shape `s` on the `R × C` board, as lists of cell indices. -/
def placements (R C : Nat) (s : List (Int × Int)) : List (List Nat) :=
  (orientations s).flatMap fun o =>
    (List.range C).flatMap fun dx =>
      (List.range R).filterMap fun dy =>
        let cells : List (Int × Int) := o.map fun p => (p.1 + (dx : Int), p.2 + (dy : Int))
        if cells.all (fun q => decide (q.1 < (C : Int) ∧ q.2 < (R : Int))) then
          some (cells.map fun q => q.2.toNat * C + q.1.toNat)
        else none

mutual
/-- `BlackWins P N B W`: Black to move at position `(B, W)` on an `N`-cell board with
placement list `P`, and Black can force owning a placement. -/
inductive BlackWins (P : List (List Nat)) (N : Nat) : List Nat → List Nat → Prop
  | move (B W : List Nat) (b : Nat) (hb : b < N) (hB : b ∉ B) (hW : b ∉ W)
      (h : WhiteToMoveLoses P N (b :: B) W) : BlackWins P N B W

/-- `WhiteToMoveLoses P N B W`: Black has just moved; either she already owns a placement, or
a free cell exists and every White reply leaves a Black win. -/
inductive WhiteToMoveLoses (P : List (List Nat)) (N : Nat) : List Nat → List Nat → Prop
  | won (B W : List Nat) (p : List Nat) (hp : p ∈ P) (hsub : ∀ x ∈ p, x ∈ B) :
      WhiteToMoveLoses P N B W
  | reply (B W : List Nat) (hfree : ∃ w, w < N ∧ w ∉ B ∧ w ∉ W)
      (h : ∀ w, w < N → w ∉ B → w ∉ W → BlackWins P N B (w :: W)) :
      WhiteToMoveLoses P N B W
end

mutual
/-- `BlackWinsIn P N n B W`: Black to move at `(B, W)` forces owning a placement within `n` of her
own moves. -/
inductive BlackWinsIn (P : List (List Nat)) (N : Nat) : Nat → List Nat → List Nat → Prop
  | move (n : Nat) (B W : List Nat) (b : Nat) (hb : b < N) (hB : b ∉ B) (hW : b ∉ W)
      (h : WhiteToMoveLosesIn P N n (b :: B) W) : BlackWinsIn P N (n + 1) B W

/-- `WhiteToMoveLosesIn P N n B W`: Black has just moved; either she already owns a placement, or
a free cell exists and every White reply leaves a Black win within `n` more moves. -/
inductive WhiteToMoveLosesIn (P : List (List Nat)) (N : Nat) : Nat → List Nat → List Nat → Prop
  | won (n : Nat) (B W : List Nat) (p : List Nat) (hp : p ∈ P) (hsub : ∀ x ∈ p, x ∈ B) :
      WhiteToMoveLosesIn P N n B W
  | reply (n : Nat) (B W : List Nat) (hfree : ∃ w, w < N ∧ w ∉ B ∧ w ∉ W)
      (h : ∀ w, w < N → w ∉ B → w ∉ W → BlackWinsIn P N n B (w :: W)) :
      WhiteToMoveLosesIn P N n B W
end

/-- Non-vacuity anchor: `8 · 13 · 16 = 1664` placements on 17 × 17. -/
theorem placements_17x17_length : (placements 17 17 snaky).length = 1664 := by decide +kernel

/-- The horizontal domino. -/
def domino : List (Int × Int) := [(0, 0), (1, 0)]

/-- The straight tromino. -/
def tromino : List (Int × Int) := [(0, 0), (1, 0), (2, 0)]

/-- Falsification control: with no placements Black never wins, so a full board is a draw, not a
Black win (the draw guard `hfree` is load-bearing). -/
theorem no_placements_no_win (N : Nat) : ¬ BlackWins [] N [] [] := by
  sorry

/-- Positive control: on a 1 × 3 board Black forces a domino by taking the middle cell. -/
theorem domino_wins_1x3 : BlackWins (placements 1 3 domino) 3 [] [] := by
  sorry

/-- Negative control: on a 1 × 3 board Black cannot force a straight tromino. -/
theorem tromino_loses_1x3 : ¬ BlackWins (placements 1 3 tromino) 3 [] [] := by
  sorry

/-- Positive control: on a 1 × 3 board Black forces a domino within two moves. -/
theorem domino_wins_1x3_in_2 : BlackWinsIn (placements 1 3 domino) 3 2 [] [] := by
  sorry

/-- Negative control: on a 1 × 3 board Black cannot force a domino in one move. -/
theorem domino_not_in_1_1x3 : ¬ BlackWinsIn (placements 1 3 domino) 3 1 [] [] := by
  sorry

/-- Teeth for the move bound: Black cannot force Snaky on 17 × 17 within 5 moves. -/
theorem snaky_not_in_5_17x17 : ¬ BlackWinsIn (placements 17 17 snaky) (17 * 17) 5 [] [] := by
  sorry

/-- **Snaky is a first-player win on 17 × 17 within 20 Black moves.** -/
theorem snaky_wins_17x17_in_20 : BlackWinsIn (placements 17 17 snaky) (17 * 17) 20 [] [] := by
  sorry

/-- **Snaky is a first-player win on 17 × 17.** -/
theorem snaky_wins_17x17 : BlackWins (placements 17 17 snaky) (17 * 17) [] [] := by
  sorry

end Snaky
