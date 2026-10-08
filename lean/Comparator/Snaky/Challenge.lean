/-!
# Comparator challenge: Snaky is a first-player win on 15 × 15

Imports nothing.  The definitions below are the project's own (`Snaky/Game.lean`), written out in
full under their real names, so they can be read here on their own terms: the board, Snaky's
placements, and the maker-breaker game `BlackWins`.  `snaky_wins_15x15` is the claim;
`placements_15x15_length` is a proved non-vacuity anchor for `placements`, and the three
falsification controls show `BlackWins` is false where it must be (proved in
`Snaky/Controls.lean`, checked here by the comparator).
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

/-- Snaky is a winner on some finite board: Black, moving first on an empty `R × C` board,
forces a placement.  By board monotonicity this implies Snaky is a winner on the plane. -/
def WinsOnSomeBoard : Prop := ∃ R C, BlackWins (placements R C snaky) (R * C) [] []

/-- Non-vacuity anchor: `8 · 11 · 14 = 1232` placements on 15 × 15 (same formula). -/
theorem placements_15x15_length : (placements 15 15 snaky).length = 1232 := by decide +kernel

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

/-- **Snaky is a first-player win on 15 × 15.** -/
theorem snaky_wins_15x15 : BlackWins (placements 15 15 snaky) (15 * 15) [] [] := by
  sorry

end Snaky
