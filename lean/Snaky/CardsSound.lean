import Snaky.Cards

/-!
# Soundness of the card checker

`cards_sound`: if `allOK cs` and `rootOK cs R C i g`, then Black wins the empty `R × C` board.

Invariant for card `c` placed by `g` at position `(B, W)` (Black to move):
* every cell of `g(A)` is on the board and Black's;
* every cell of `g(S)` is on the board and not White's;
* `|B| + |W| + 2 h ≤ R C`, so both players always have a free cell.
Extra Black stones are allowed anywhere: if `g(p)` is already Black's, Black plays any free cell.
Induction on the height.
-/
namespace Snaky

/-! ## Symmetries -/

theorem Xf.app_comp (g g' : Xf) (q : Pt) : (g.comp g').app q = g.app (g'.app q) := by
  simp only [Xf.app, Xf.comp, Prod.mk.injEq]
  constructor
  · simp only [Int.add_mul, Int.mul_add, Int.mul_assoc]; omega
  · simp only [Int.add_mul, Int.mul_add, Int.mul_assoc]; omega

theorem Xf.isOrient_iff (g : Xf) : g.isOrient = true ↔ (g.a, g.b, g.c, g.d) ∈ orients := by
  simp [Xf.isOrient]

private def mmul (m m' : Int × Int × Int × Int) : Int × Int × Int × Int :=
  (m.1 * m'.1 + m.2.1 * m'.2.2.1, m.1 * m'.2.1 + m.2.1 * m'.2.2.2,
   m.2.2.1 * m'.1 + m.2.2.2 * m'.2.2.1, m.2.2.1 * m'.2.1 + m.2.2.2 * m'.2.2.2)

private theorem orients_closed : ∀ m ∈ orients, ∀ m' ∈ orients, mmul m m' ∈ orients := by
  decide

theorem Xf.isOrient_comp {g g' : Xf} (h : g.isOrient = true) (h' : g'.isOrient = true) :
    (g.comp g').isOrient = true := by
  rw [Xf.isOrient_iff] at *
  exact orients_closed _ h _ h'

theorem Xf.app_inj {g : Xf} (hg : g.isOrient = true) {q q' : Pt} (e : g.app q = g.app q') :
    q = q' := by
  rw [Xf.isOrient_iff] at hg
  obtain ⟨x, y⟩ := q
  obtain ⟨x', y'⟩ := q'
  obtain ⟨a, b, c, d, dx, dy⟩ := g
  simp only [Xf.app, Prod.mk.injEq] at e ⊢
  simp only [orients, List.mem_cons, Prod.mk.injEq, List.not_mem_nil, or_false] at hg
  rcases hg with ⟨rfl, rfl, rfl, rfl⟩ | ⟨rfl, rfl, rfl, rfl⟩ | ⟨rfl, rfl, rfl, rfl⟩ |
    ⟨rfl, rfl, rfl, rfl⟩ | ⟨rfl, rfl, rfl, rfl⟩ | ⟨rfl, rfl, rfl, rfl⟩ | ⟨rfl, rfl, rfl, rfl⟩ |
    ⟨rfl, rfl, rfl, rfl⟩ <;> omega

/-! ## Board cells -/

/-- Cell index of a board point, as in `placements`. -/
def idx (C : Nat) (q : Pt) : Nat := q.2.toNat * C + q.1.toNat

theorem idx_lt {R C : Nat} {q : Pt} (h : onBoard R C q) : idx C q < R * C := by
  obtain ⟨h1, h2, h3, h4⟩ := h
  unfold idx
  have hy : q.2.toNat + 1 ≤ R := by omega
  have hx : q.1.toNat < C := by omega
  calc q.2.toNat * C + q.1.toNat < q.2.toNat * C + C := by omega
    _ = (q.2.toNat + 1) * C := by rw [Nat.succ_mul]
    _ ≤ R * C := Nat.mul_le_mul_right _ hy

theorem idx_inj {R C : Nat} {q q' : Pt} (h : onBoard R C q) (h' : onBoard R C q')
    (e : idx C q = idx C q') : q = q' := by
  obtain ⟨h1, h2, h3, h4⟩ := h
  obtain ⟨h1', h2', h3', h4'⟩ := h'
  unfold idx at e
  have hx : q.1.toNat < C := by omega
  have hx' : q'.1.toNat < C := by omega
  have hC : 0 < C := by omega
  have e1 : q.1.toNat = q'.1.toNat := by
    have := congrArg (· % C) e
    simp only [Nat.mul_comm _ C, Nat.mul_add_mod, Nat.mod_eq_of_lt hx, Nat.mod_eq_of_lt hx']
      at this
    exact this
  have e2 : q.2.toNat = q'.2.toNat := by
    have := congrArg (· / C) e
    simp only [Nat.mul_comm _ C, Nat.mul_add_div hC, Nat.div_eq_of_lt hx,
      Nat.div_eq_of_lt hx'] at this
    simpa using this
  ext <;> omega

/-! ## Free cells -/

theorem le_length_of_forall_mem {L : List Nat} : ∀ {n : Nat}, (∀ x < n, x ∈ L) → n ≤ L.length
  | 0, _ => Nat.zero_le _
  | n + 1, h => by
    have hn : n ∈ L := h n (Nat.lt_succ_self n)
    have := le_length_of_forall_mem (L := L.erase n) (n := n) fun x hx =>
      (List.mem_erase_of_ne (Nat.ne_of_lt hx)).2 (h x (Nat.lt_succ_of_lt hx))
    rw [List.length_erase_of_mem hn] at this
    have : 0 < L.length := List.length_pos_of_mem hn
    omega

theorem exists_free {B W : List Nat} {N : Nat} (h : (B ++ W).length < N) :
    ∃ x, x < N ∧ x ∉ B ∧ x ∉ W := by
  apply Classical.byContradiction
  intro hno
  have : N ≤ (B ++ W).length := le_length_of_forall_mem fun x hx => by
    apply Classical.byContradiction
    intro hm
    simp only [List.mem_append, not_or] at hm
    exact hno ⟨x, hx, hm.1, hm.2⟩
  omega

/-! ## Won positions map to `placements` -/

def shift (T v : Pt) : Pt := (v.1 + T.1, v.2 + T.2)

def mApp (m : Int × Int × Int × Int) (q : Pt) : Pt :=
  (m.1 * q.1 + m.2.1 * q.2, m.2.2.1 * q.1 + m.2.2.2 * q.2)

/-- Each symmetry maps each orientation of Snaky onto a translate of an orientation, cell by
cell in list order. -/
private theorem orient_image : ∀ m ∈ orients, ∀ f ∈ orientations snaky, ∃ f' ∈ orientations snaky,
    f.map (mApp m) = f'.map (shift ((mApp m (f.headD (0, 0))).1 - (f'.headD (0, 0)).1,
      (mApp m (f.headD (0, 0))).2 - (f'.headD (0, 0)).2)) := by
  decide

private theorem orient_normal : ∀ f ∈ orientations snaky,
    (∃ v ∈ f, v.1 = 0) ∧ (∃ v ∈ f, v.2 = 0) := by
  decide

theorem Xf.app_eq (g : Xf) (q : Pt) :
    g.app q = shift (g.dx, g.dy) (mApp (g.a, g.b, g.c, g.d) q) := rfl

theorem mApp_shift (m : Int × Int × Int × Int) (t u : Pt) :
    mApp m (shift t u) = shift (mApp m t) (mApp m u) := by
  simp only [mApp, shift, Prod.mk.injEq, Int.mul_add]
  constructor <;> omega

theorem shift_shift (a b v : Pt) : shift a (shift b v) = shift (shift a b) v := by
  simp only [shift, Prod.mk.injEq]; constructor <;> omega

/-- A translate of an orientation lying on the board is (as a cell list) in `placements`. -/
theorem mem_placements {R C : Nat} {f : List Pt} (hf : f ∈ orientations snaky) {T : Pt}
    (hon : ∀ v ∈ f, onBoard R C (shift T v)) :
    (f.map (shift T)).map (idx C) ∈ placements R C snaky := by
  obtain ⟨⟨v1, hv1, e1⟩, ⟨v2, hv2, e2⟩⟩ := orient_normal f hf
  have b1 := hon v1 hv1
  have b2 := hon v2 hv2
  simp only [onBoard, shift, e1, e2, Int.zero_add] at b1 b2
  have hT1 : (T.1.toNat : Int) = T.1 := Int.toNat_of_nonneg (by omega)
  have hT2 : (T.2.toNat : Int) = T.2 := Int.toNat_of_nonneg (by omega)
  unfold placements
  rw [List.mem_flatMap]
  refine ⟨f, hf, ?_⟩
  rw [List.mem_flatMap]
  refine ⟨T.1.toNat, List.mem_range.2 (by omega), ?_⟩
  rw [List.mem_filterMap]
  refine ⟨T.2.toNat, List.mem_range.2 (by omega), ?_⟩
  simp only [hT1, hT2]
  have hall : (f.map fun p => (p.1 + T.1, p.2 + T.2)).all
      (fun q => decide (q.1 < (C : Int) ∧ q.2 < (R : Int))) = true := by
    simp only [List.all_map, List.all_eq_true, Function.comp_apply, decide_eq_true_eq]
    intro v hv
    have := hon v hv
    simp only [onBoard, shift] at this
    omega
  simp only [hall, ↓reduceIte]
  simp [shift, idx, List.map_map, Function.comp_def]

theorem won_image {R C : Nat} {B : List Pt} (hw : wonPlane B = true) {g : Xf}
    (hg : g.isOrient = true) (hon : ∀ q ∈ B, onBoard R C (g.app q)) :
    ∃ pl ∈ placements R C snaky, ∀ x ∈ pl, ∃ q ∈ B, x = idx C (g.app q) := by
  unfold wonPlane at hw
  simp only [List.any_eq_true, List.all_eq_true, List.contains_iff_mem] at hw
  obtain ⟨f, hf, q0, -, hfin⟩ := hw
  obtain ⟨t, hin⟩ : ∃ t, ∀ u ∈ f, shift t u ∈ B :=
    ⟨(q0.1 - (f.headD (0, 0)).1, q0.2 - (f.headD (0, 0)).2), fun u hu => by
      have := hfin u hu; simpa [shift] using this⟩
  rw [Xf.isOrient_iff] at hg
  obtain ⟨f', hf', himg⟩ := orient_image _ hg f hf
  generalize hc : ((mApp (g.a, g.b, g.c, g.d) (f.headD (0, 0))).1 - (f'.headD (0, 0)).1,
      (mApp (g.a, g.b, g.c, g.d) (f.headD (0, 0))).2 - (f'.headD (0, 0)).2) = c at himg
  -- the image of the placement, cell by cell
  have hlist : f.map (fun u => g.app (shift t u)) =
      f'.map (shift (shift (g.dx, g.dy) (shift (mApp (g.a, g.b, g.c, g.d) t) c))) := by
    have : (fun u => g.app (shift t u)) =
        (shift (g.dx, g.dy) ∘ shift (mApp (g.a, g.b, g.c, g.d) t)) ∘ mApp (g.a, g.b, g.c, g.d) := by
      funext u; simp [Xf.app_eq, mApp_shift]
    rw [this, ← List.map_map, himg, List.map_map]
    congr 1; funext v; simp [shift_shift]
  refine ⟨(f'.map (shift (shift (g.dx, g.dy) (shift (mApp (g.a, g.b, g.c, g.d) t) c)))).map
    (idx C), mem_placements hf' ?_, ?_⟩
  · intro v hv
    have : shift (shift (g.dx, g.dy) (shift (mApp (g.a, g.b, g.c, g.d) t) c)) v ∈
        f.map (fun u => g.app (shift t u)) := by
      rw [hlist]; exact List.mem_map_of_mem hv
    obtain ⟨u, hu, e⟩ := List.mem_map.1 this
    rw [← e]; exact hon _ (hin u hu)
  · intro x hx
    rw [← hlist, List.map_map, List.mem_map] at hx
    obtain ⟨u, hu, rfl⟩ := hx
    exact ⟨_, hin u hu, rfl⟩

/-! ## Unpacking the checker -/

theorem hintOK_spec {cs : Array Card} {h : Nat} {B : List Pt} {Rg : Pt → Bool} {hn : Hint}
    (hok : hintOK cs h B Rg hn = true) :
    ∃ c', cs[hn.1]? = some c' ∧ c'.h < h ∧ hn.2.isOrient = true ∧
      (∀ a ∈ c'.A, hn.2.app a ∈ B) ∧ ∀ s ∈ c'.S, Rg (hn.2.app s) = true := by
  unfold hintOK at hok
  split at hok
  · rename_i c' hc'
    simp only [Bool.and_eq_true, decide_eq_true_eq, List.all_eq_true,
      List.contains_iff_mem] at hok
    exact ⟨c', hc', hok.1.1.1, hok.1.1.2, hok.1.2, hok.2⟩
  · simp at hok

theorem allOK_spec {cs : Array Card} (hall : allOK cs = true) {j : Nat} {c : Card}
    (hj : cs[j]? = some c) : cardOK cs c = true := by
  unfold allOK at hall
  rw [List.all_eq_true] at hall
  apply hall
  obtain ⟨hlt, rfl⟩ := Array.getElem?_eq_some_iff.1 hj
  exact Array.getElem_mem_toList hlt

/-! ## The induction -/

/-- Card `c` placed by `g` at position `(B, W)`, Black to move. -/
def Placed (R C : Nat) (c : Card) (g : Xf) (B W : List Nat) : Prop :=
  (∀ a ∈ c.A, onBoard R C (g.app a) ∧ idx C (g.app a) ∈ B) ∧
  (∀ s ∈ c.S, onBoard R C (g.app s) ∧ idx C (g.app s) ∉ W) ∧
  (B ++ W).length + 2 * c.h ≤ R * C

theorem sound_aux {cs : Array Card} (hall : allOK cs = true) (R C : Nat) :
    ∀ n, ∀ c : Card, (∃ j : Nat, cs[j]? = some c) → c.h ≤ n → ∀ g : Xf, g.isOrient = true →
      ∀ B W, Placed R C c g B W → BlackWins (placements R C snaky) (R * C) B W := by
  intro n
  induction n with
  | zero =>
    intro c ⟨j, hj⟩ hn
    have hok := allOK_spec hall hj
    unfold cardOK at hok
    simp only [Bool.and_eq_true, decide_eq_true_eq] at hok
    omega
  | succ n ih =>
    intro c ⟨j, hj⟩ hn g hg B W ⟨hAinv, hSinv, hlen⟩
    have hok := allOK_spec hall hj
    unfold cardOK at hok
    simp only [Bool.and_eq_true, decide_eq_true_eq, Bool.or_eq_true, List.contains_iff_mem]
      at hok
    obtain ⟨⟨h1, hpS⟩, hrest⟩ := hok
    obtain ⟨hpon, hpW⟩ := hSinv c.p hpS
    have hlt : (B ++ W).length < R * C := by omega
    -- Black's move: `g(p)` if free, else any free cell (the extra stone never hurts)
    obtain ⟨b, hbN, hbB, hbW, hcov⟩ : ∃ b, b < R * C ∧ b ∉ B ∧ b ∉ W ∧
        idx C (g.app c.p) ∈ b :: B := by
      by_cases hpB : idx C (g.app c.p) ∈ B
      · obtain ⟨x, hx, hxB, hxW⟩ := exists_free hlt
        exact ⟨x, hx, hxB, hxW, List.mem_cons_of_mem _ hpB⟩
      · exact ⟨_, idx_lt hpon, hpB, hpW, List.mem_cons_self⟩
    apply BlackWins.move B W b hbN hbB hbW
    have hBl : ∀ q ∈ c.p :: c.A, onBoard R C (g.app q) ∧ idx C (g.app q) ∈ b :: B := by
      intro q hq
      rcases List.mem_cons.1 hq with rfl | hqA
      · exact ⟨hpon, hcov⟩
      · exact ⟨(hAinv q hqA).1, List.mem_cons_of_mem _ (hAinv q hqA).2⟩
    rcases hrest with hwon | ⟨hpass, hreps⟩
    · obtain ⟨pl, hpl, hsub⟩ := won_image hwon hg fun q hq => (hBl q hq).1
      refine WhiteToMoveLoses.won _ _ pl hpl fun x hx => ?_
      obtain ⟨q, hq, rfl⟩ := hsub x hx
      exact (hBl q hq).2
    · apply WhiteToMoveLoses.reply
      · apply exists_free
        simp only [List.length_append, List.length_cons] at hlen ⊢
        omega
      intro w hwN hwB hwW
      -- one White move answered by hint `hn` with region test `Rg`
      have step : ∀ (hn : Hint) (Rg : Pt → Bool),
          (∀ s, Rg s = true → s ∈ c.S ∧ idx C (g.app s) ≠ w) →
          hintOK cs c.h (c.p :: c.A) Rg hn = true →
          BlackWins (placements R C snaky) (R * C) (b :: B) (w :: W) := by
        intro hn Rg hRg hhint
        obtain ⟨c', hj', hlt', hor, hA', hS'⟩ := hintOK_spec hhint
        refine ih c' ⟨_, hj'⟩ (by omega) (g.comp hn.2) (Xf.isOrient_comp hg hor) _ _
          ⟨?_, ?_, ?_⟩
        · intro a ha
          rw [Xf.app_comp]
          exact hBl _ (hA' a ha)
        · intro s hs
          rw [Xf.app_comp]
          obtain ⟨hsS, hne⟩ := hRg _ (hS' s hs)
          obtain ⟨hon, hnW⟩ := hSinv _ hsS
          refine ⟨hon, ?_⟩
          rw [List.mem_cons, not_or]
          exact ⟨hne, hnW⟩
        · simp only [List.length_append, List.length_cons] at hlen ⊢
          omega
      by_cases hex : ∃ w0 ∈ c.S, idx C (g.app w0) = w
      · obtain ⟨w0, hw0S, rfl⟩ := hex
        have hw0 : w0 ∉ c.p :: c.A := fun hm => hwB (hBl w0 hm).2
        have hr := List.all_eq_true.1 hreps w0 hw0S
        have hw0' : (c.p :: c.A).contains w0 = false := by
          simpa [List.contains_iff_mem] using hw0
        rw [hw0', Bool.false_or] at hr
        split at hr
        · rename_i hn _
          refine step hn _ (fun s hs => ?_) hr
          simp only [Bool.and_eq_true, List.contains_iff_mem, bne_iff_ne, ne_eq] at hs
          refine ⟨hs.1, fun e => hs.2 (Xf.app_inj hg (idx_inj (hSinv s hs.1).1
            (hSinv w0 hw0S).1 e))⟩
        · simp at hr
      · split at hpass
        · rename_i hn _
          refine step hn _ (fun s hs => ?_) hpass
          rw [List.contains_iff_mem] at hs
          exact ⟨hs, fun e => hex ⟨s, hs, e⟩⟩
        · simp at hpass

/-- **Soundness of the card checker.** -/
theorem cards_sound {cs : Array Card} {R C i : Nat} {g : Xf} (hall : allOK cs = true)
    (hroot : rootOK cs R C i g = true) : BlackWins (placements R C snaky) (R * C) [] [] := by
  unfold rootOK at hroot
  split at hroot
  · rename_i c hc
    simp only [Bool.and_eq_true, List.isEmpty_iff, List.all_eq_true, decide_eq_true_eq]
      at hroot
    obtain ⟨⟨⟨hA, hg⟩, hS⟩, hh⟩ := hroot
    refine sound_aux hall R C c.h c ⟨i, hc⟩ (Nat.le_refl _) g hg [] [] ⟨?_, ?_, ?_⟩
    · simp [hA]
    · intro s hs; exact ⟨hS s hs, List.not_mem_nil⟩
    · simpa using hh
  · simp at hroot

theorem CardSet.sound {s : CardSet} (h : s.ok = true) :
    BlackWins (placements s.rows s.cols snaky) (s.rows * s.cols) [] [] := by
  unfold CardSet.ok at h
  rw [Bool.and_eq_true] at h
  exact cards_sound h.1 h.2

end Snaky
