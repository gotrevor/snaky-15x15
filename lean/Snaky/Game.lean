/-!
# Harary's generalized tic-tac-toe, weak (maker-breaker) game, on a finite board

Board `R × C`, cell index `i = r * C + c` (as in `../checker/check.py`).  A shape is
a list of `(x, y) = (col, row)` offsets; a *placement* is a translate of one of its 8
rotations/reflections lying inside the board.  Black (maker) moves first from the given
position and wins by owning every cell of some placement; White (breaker) only blocks.

No Mathlib: everything is `List`/`Nat` so the statements build in seconds.
-/
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

/-- Sanity: `8 (n-4) (n-1)` placements on `n × n` (320 on 9×9, hand formula in PLAN.md §1);
Snaky's 8 orientations are pairwise distinct, so `placements` lists each placement once. -/
example : (placements 9 9 snaky).length = 320 := by decide +kernel

/-- Non-vacuity anchor: `8 · 11 · 14 = 1232` placements on 15 × 15 (same formula). -/
theorem placements_15x15_length : (placements 15 15 snaky).length = 1232 := by decide +kernel

end Snaky
