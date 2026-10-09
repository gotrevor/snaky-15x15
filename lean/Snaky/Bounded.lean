import Snaky.Controls

/-!
# The game with a move bound

`BlackWinsIn P N n B W` is `BlackWins P N B W` with a budget: Black, to move, owns a placement by
her `n`-th move at the latest (the winning move counts).  Each Black move spends one unit, and no
constructor produces budget `0`, so `BlackWinsIn P N 0 B W` is false.  The two games differ only
in the index; `BlackWinsIn.toBlackWins` forgets it.

Controls, so the index is known to count Black's moves:

* `domino_wins_1x3_in_2` / `domino_not_in_1_1x3`: on a 1 × 3 board Black forces a domino in two
  moves (middle, then the free side) and not in one.
* `not_blackWinsIn_of_short`: a Black win within `n` moves from the empty board owns a placement
  inside a list of at most `n` cells; so a shape of `k` distinct cells needs at least `k` moves.
-/

namespace Snaky

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

mutual
/-- A win within a bound is a win. -/
theorem BlackWinsIn.toBlackWins {P : List (List Nat)} {N n : Nat} {B W : List Nat} :
    BlackWinsIn P N n B W → BlackWins P N B W
  | .move _ _ _ b hb hB hW h => .move _ _ b hb hB hW h.toWhiteToMoveLoses

/-- The White-to-move half of `BlackWinsIn.toBlackWins`. -/
theorem WhiteToMoveLosesIn.toWhiteToMoveLoses {P : List (List Nat)} {N n : Nat}
    {B W : List Nat} : WhiteToMoveLosesIn P N n B W → WhiteToMoveLoses P N B W
  | .won _ _ _ p hp hsub => .won _ _ p hp hsub
  | .reply _ _ _ hf h => .reply _ _ hf fun w hw hwB hwW => (h w hw hwB hwW).toBlackWins
end

/-- No moves left, no win. -/
theorem not_blackWinsIn_zero {P : List (List Nat)} {N : Nat} {B W : List Nat} :
    ¬ BlackWinsIn P N 0 B W := nofun

/-! ## Controls -/

/-- Positive control: on a 1 × 3 board Black forces a domino within two moves. -/
theorem domino_wins_1x3_in_2 : BlackWinsIn (placements 1 3 domino) 3 2 [] [] := by
  refine .move 1 [] [] 1 (by decide) (by decide) (by decide)
    (.reply _ _ _ ⟨0, by decide, by decide, by decide⟩ fun w hw hwB _ => ?_)
  have : w = 0 ∨ w = 1 ∨ w = 2 := by omega
  rcases this with rfl | rfl | rfl
  · exact .move 0 _ _ 2 (by decide) (by decide) (by decide)
      (.won _ _ _ [1, 2] (by decide +kernel) (by decide))
  · exact absurd (List.mem_singleton_self 1) hwB
  · exact .move 0 _ _ 0 (by decide) (by decide) (by decide)
      (.won _ _ _ [0, 1] (by decide +kernel) (by decide))

mutual
/-- Black's win within `n` moves owns a placement inside her stones plus at most `n` more cells. -/
theorem BlackWinsIn.owns {P : List (List Nat)} {N n : Nat} {B W : List Nat} :
    BlackWinsIn P N n B W → ∃ p ∈ P, ∃ L : List Nat, L.length ≤ n ∧ ∀ x ∈ p, x ∈ L ++ B
  | .move n _ _ b _ _ _ h =>
    let ⟨p, hp, L, hL, hsub⟩ := h.owns
    ⟨p, hp, b :: L, by simp only [List.length_cons]; omega, fun x hx => by
      have := hsub x hx
      simp only [List.mem_append, List.mem_cons] at this ⊢
      rcases this with h | h | h
      · exact Or.inl (Or.inr h)
      · exact Or.inl (Or.inl h)
      · exact Or.inr h⟩

/-- The White-to-move half of `BlackWinsIn.owns`. -/
theorem WhiteToMoveLosesIn.owns {P : List (List Nat)} {N n : Nat} {B W : List Nat} :
    WhiteToMoveLosesIn P N n B W → ∃ p ∈ P, ∃ L : List Nat, L.length ≤ n ∧ ∀ x ∈ p, x ∈ L ++ B
  | .won _ _ _ p hp hsub => ⟨p, hp, [], Nat.zero_le _, fun x hx => by simpa using hsub x hx⟩
  | .reply _ _ _ ⟨w, hw, hwB, hwW⟩ h => (h w hw hwB hwW).owns
end

/-- From the empty board, a win within `n` moves needs a placement with at most `n` distinct
cells. -/
theorem not_blackWinsIn_of_short {P : List (List Nat)} {N n : Nat}
    (hP : ∀ p ∈ P, p.Nodup ∧ n < p.length) : ¬ BlackWinsIn P N n [] [] := fun h =>
  let ⟨p, hp, L, hL, hsub⟩ := h.owns
  have := List.Nodup.length_le_of_subset (hP p hp).1 fun x hx => by simpa using hsub x hx
  absurd (hP p hp).2 (by omega)

/-- Every domino placement on 1 × 3 has two distinct cells. -/
theorem domino_1x3_two : ∀ p ∈ placements 1 3 domino, p.Nodup ∧ 1 < p.length := by
  decide +kernel

/-- Negative control: on a 1 × 3 board Black cannot force a domino in one move. -/
theorem domino_not_in_1_1x3 : ¬ BlackWinsIn (placements 1 3 domino) 3 1 [] [] :=
  not_blackWinsIn_of_short domino_1x3_two

end Snaky
