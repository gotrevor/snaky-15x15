import Snaky.Game

/-!
# Falsification controls for `BlackWins`

`BlackWins` is the definition the claim rests on, so it needs evidence that it can be *false*:
a definition that held everywhere would make `snaky_wins_15x15` say nothing.  This file proves
`BlackWins` false where it must be and true where it must be, on boards small enough to check by
hand, through the real `placements`:

* `not_blackWins_of_blocked`: once White holds a cell of every placement, Black cannot win.
* `no_placements_no_win`: with no placements, Black never wins.  This is the teeth test for the
  draw guard `hfree` in `WhiteToMoveLoses.reply`: without it, a board filled with no Black
  placement would count as a Black win, and this theorem would be false.
* `domino_wins_1x3` / `tromino_loses_1x3`: on a 1 × 3 board Black, moving first, forces a domino
  (take the middle) but not a straight tromino (White takes any other cell).
-/

namespace Snaky

mutual
/-- Black cannot win from a position where White holds a cell of every placement (with Black's
and White's cells disjoint, as they are in any position reached by play). -/
theorem not_blackWins_of_blocked {P : List (List Nat)} {N : Nat} {B W : List Nat}
    (hd : ∀ x ∈ B, x ∉ W) (hb : ∀ p ∈ P, ∃ x ∈ p, x ∈ W) : ¬ BlackWins P N B W
  | .move _ _ b _ _ hW h =>
    not_whiteToMoveLoses_of_blocked
      (fun x hx => by
        cases List.mem_cons.mp hx with
        | inl e => exact e ▸ hW
        | inr hx => exact hd x hx)
      hb h

/-- The White-to-move half of `not_blackWins_of_blocked`. -/
theorem not_whiteToMoveLoses_of_blocked {P : List (List Nat)} {N : Nat} {B W : List Nat}
    (hd : ∀ x ∈ B, x ∉ W) (hb : ∀ p ∈ P, ∃ x ∈ p, x ∈ W) : ¬ WhiteToMoveLoses P N B W
  | .won _ _ p hp hsub =>
    let ⟨x, hx, hxW⟩ := hb p hp
    hd x (hsub x hx) hxW
  | .reply _ _ ⟨w, hw, hwB, hwW⟩ h =>
    not_blackWins_of_blocked
      (fun x hx hxw => by
        cases List.mem_cons.mp hxw with
        | inl e => exact hwB (e ▸ hx)
        | inr hxW => exact hd x hx hxW)
      (fun p hp => let ⟨x, hx, hxW⟩ := hb p hp; ⟨x, hx, List.mem_cons_of_mem w hxW⟩)
      (h w hw hwB hwW)
end

/-- With no placements Black never wins: the draw guard `hfree` is load-bearing. -/
theorem no_placements_no_win (N : Nat) : ¬ BlackWins [] N [] [] :=
  not_blackWins_of_blocked (fun _ h => nomatch h) (fun _ h => nomatch h)

/-- The horizontal domino. -/
def domino : List (Int × Int) := [(0, 0), (1, 0)]

/-- The straight tromino. -/
def tromino : List (Int × Int) := [(0, 0), (1, 0), (2, 0)]

/-- Positive control: on a 1 × 3 board Black forces a domino by taking the middle cell. -/
theorem domino_wins_1x3 : BlackWins (placements 1 3 domino) 3 [] [] := by
  refine .move [] [] 1 (by decide) (by decide) (by decide)
    (.reply _ _ ⟨0, by decide, by decide, by decide⟩ fun w hw hwB _ => ?_)
  have : w = 0 ∨ w = 1 ∨ w = 2 := by omega
  rcases this with rfl | rfl | rfl
  · exact .move _ _ 2 (by decide) (by decide) (by decide)
      (.won _ _ [1, 2] (by decide +kernel) (by decide))
  · exact absurd (List.mem_singleton_self 1) hwB
  · exact .move _ _ 0 (by decide) (by decide) (by decide)
      (.won _ _ [0, 1] (by decide +kernel) (by decide))

/-- Every tromino placement on 1 × 3 is the whole board. -/
theorem tromino_1x3_full : ∀ p ∈ placements 1 3 tromino, ∀ x < 3, x ∈ p := by decide +kernel

/-- Negative control: on a 1 × 3 board Black cannot force a straight tromino. -/
theorem tromino_loses_1x3 : ¬ BlackWins (placements 1 3 tromino) 3 [] [] := by
  intro h
  cases h with
  | move _ _ b hb _ _ h =>
  cases h with
  | won _ _ p hp hsub =>
    -- `p` is the whole board, but Black holds only `b`.
    have h0 := List.mem_singleton.mp (hsub 0 (tromino_1x3_full p hp 0 (by decide)))
    have h1 := List.mem_singleton.mp (hsub 1 (tromino_1x3_full p hp 1 (by decide)))
    omega
  | reply _ _ _ h =>
    -- White takes a cell other than `b`; it lies in every placement.
    let w := if b = 0 then 1 else 0
    have hw : w < 3 := by simp only [w]; split <;> decide
    have hwb : w ≠ b := by simp only [w]; split <;> omega
    exact not_blackWins_of_blocked
      (fun x hx hxw => by
        rw [List.mem_singleton] at hx hxw
        exact hwb (hxw ▸ hx ▸ rfl))
      (fun p hp => ⟨w, tromino_1x3_full p hp w hw, List.mem_singleton_self w⟩)
      (h w hw (by simpa [List.mem_singleton] using hwb) (nomatch ·))

/-! ### Teeth test for the draw guard

The same game with `hfree` dropped from `reply`.  It calls a board with no placements a Black win
(Black fills the only cell, then "every White reply" holds vacuously), so it fails
`no_placements_no_win`, which `BlackWins` passes. -/
namespace NoDrawGuard

mutual
/-- `BlackWins` without the draw guard. -/
inductive BlackWins (P : List (List Nat)) (N : Nat) : List Nat → List Nat → Prop
  | move (B W : List Nat) (b : Nat) (hb : b < N) (hB : b ∉ B) (hW : b ∉ W)
      (h : WhiteToMoveLoses P N (b :: B) W) : BlackWins P N B W

/-- `WhiteToMoveLoses` without `hfree`. -/
inductive WhiteToMoveLoses (P : List (List Nat)) (N : Nat) : List Nat → List Nat → Prop
  | won (B W : List Nat) (p : List Nat) (hp : p ∈ P) (hsub : ∀ x ∈ p, x ∈ B) :
      WhiteToMoveLoses P N B W
  | reply (B W : List Nat) (h : ∀ w, w < N → w ∉ B → w ∉ W → BlackWins P N B (w :: W)) :
      WhiteToMoveLoses P N B W
end

/-- Without the draw guard, a one-cell board with no placements is a "Black win". -/
theorem draw_counts_as_win : BlackWins [] 1 [] [] :=
  .move [] [] 0 (by decide) (by decide) (by decide)
    (.reply _ _ fun w hw hwB _ => absurd (by omega : w = 0) (by simpa using hwB))

end NoDrawGuard

end Snaky
