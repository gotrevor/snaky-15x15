import Snaky.Game

/-!
# Card sets and their checker

A *card* `(A, S, p, h)` lives in the plane `ℤ × ℤ`: Black owns `A`, White owns nothing in the
region `S`, Black to move plays `p` and wins within `h` moves.  A card is used under any of the 8
board symmetries followed by a translation (`Xf`).

`cardOK` checks that a card is *justified*: `p ∈ S` and either `p :: A` already contains a Snaky
placement, or every White reply `w ∈ S` (off `p :: A`), and a White move outside `S` ("pass"),
is answered by a hint `(j, g)`: card `j` has a lower height, and under `g` its `A` lands inside
`p :: A` and its `S` inside `S` minus `w`.  Hints are checked, never trusted.

The checker reads cards through a lookup `get : Nat → Option Card`.  `Snaky.CardsSound` proves:
if every card `get` returns passes `cardOK get` and some card with `A = []` fits on the `R × C`
board, then `BlackWins (placements R C snaky) (R * C) [] []`.  The parser
`parseCards` is outside the trusted base: the theorem holds for whatever it returns.
-/
namespace Snaky

abbrev Pt := Int × Int

/-- The 8 symmetries of the square as matrices `(a, b, c, d)`: `(x, y) ↦ (a x + b y, c x + d y)`. -/
def orients : List (Int × Int × Int × Int) :=
  [(1, 0, 0, 1), (-1, 0, 0, 1), (0, -1, 1, 0), (0, 1, 1, 0),
   (-1, 0, 0, -1), (1, 0, 0, -1), (0, 1, -1, 0), (0, -1, -1, 0)]

/-- A board symmetry followed by a translation. -/
structure Xf where
  a : Int
  b : Int
  c : Int
  d : Int
  dx : Int
  dy : Int
deriving Repr, Inhabited

namespace Xf

def app (g : Xf) (q : Pt) : Pt := (g.a * q.1 + g.b * q.2 + g.dx, g.c * q.1 + g.d * q.2 + g.dy)

/-- `(comp g g').app = g.app ∘ g'.app`. -/
def comp (g g' : Xf) : Xf :=
  { a := g.a * g'.a + g.b * g'.c, b := g.a * g'.b + g.b * g'.d,
    c := g.c * g'.a + g.d * g'.c, d := g.c * g'.b + g.d * g'.d,
    dx := g.a * g'.dx + g.b * g'.dy + g.dx, dy := g.c * g'.dx + g.d * g'.dy + g.dy }

def isOrient (g : Xf) : Bool := orients.contains (g.a, g.b, g.c, g.d)

def ofIndex (k : Nat) (dx dy : Int) : Xf :=
  let m := orients.getD k (1, 0, 0, 1)
  { a := m.1, b := m.2.1, c := m.2.2.1, d := m.2.2.2, dx, dy }

end Xf

/-- A hint: card index and the map placing it. -/
abbrev Hint := Nat × Xf

structure Card where
  A : List Pt
  S : List Pt
  p : Pt
  h : Nat
  pass : Option Hint
  replies : List (Pt × Hint)
deriving Inhabited

/-- Does `B` contain a translate of one of Snaky's orientations?  Anchor: the orientation's first
cell lands on a cell of `B`. -/
def wonPlane (B : List Pt) : Bool :=
  (orientations snaky).any fun f =>
    B.any fun q =>
      let t : Pt := (q.1 - (f.headD (0, 0)).1, q.2 - (f.headD (0, 0)).2)
      f.all fun u => B.contains (u.1 + t.1, u.2 + t.2)

/-- Card `j` under `g`, of height below `h`, covers the position "Black owns `B`, region `R`". -/
def hintOK (get : Nat → Option Card) (h : Nat) (B : List Pt) (R : Pt → Bool) (hint : Hint) :
    Bool :=
  match get hint.1 with
  | some c' => decide (c'.h < h) && hint.2.isOrient &&
      c'.A.all (fun a => B.contains (hint.2.app a)) && c'.S.all (fun s => R (hint.2.app s))
  | none => false

/-- White passes (moves outside `S`): the pass hint covers `(p :: A, S)`. -/
def passOK (get : Nat → Option Card) (c : Card) : Bool :=
  match c.pass with
  | some hn => hintOK get c.h (c.p :: c.A) (fun s => c.S.contains s) hn
  | none => false

/-- White replies at `w`: `w` is already Black's, or its hint covers `(p :: A, S - w)`. -/
def replyOK (get : Nat → Option Card) (c : Card) (w : Pt) : Bool :=
  (c.p :: c.A).contains w ||
    match c.replies.lookup w with
    | some hn => hintOK get c.h (c.p :: c.A) (fun s => c.S.contains s && s != w) hn
    | none => false

def cardOK (get : Nat → Option Card) (c : Card) : Bool :=
  decide (1 ≤ c.h) && c.S.contains c.p &&
  (wonPlane (c.p :: c.A) || (passOK get c && c.S.all (replyOK get c)))

/-- Everything in `cardOK` except the replies (the kernel path checks a big card's replies in
several declarations; `cardOK_of_split`). -/
def cardHead (get : Nat → Option Card) (c : Card) : Bool :=
  decide (1 ≤ c.h) && c.S.contains c.p && passOK get c

def allOK (cs : Array Card) : Bool := cs.toList.all (cardOK (cs[·]?))

def onBoard (R C : Nat) (q : Pt) : Prop := 0 ≤ q.1 ∧ q.1 < C ∧ 0 ≤ q.2 ∧ q.2 < R

instance (R C : Nat) (q : Pt) : Decidable (onBoard R C q) := by
  unfold onBoard; infer_instance

/-- The root: card `i` has `A = []`, fits on the board under `g`, and `2 h ≤ R C` (enough free
cells for both players throughout). -/
def rootOK (get : Nat → Option Card) (R C : Nat) (i : Nat) (g : Xf) : Bool :=
  match get i with
  | some c => c.A.isEmpty && g.isOrient && c.S.all (fun s => decide (onBoard R C (g.app s))) &&
      decide (2 * c.h ≤ R * C)
  | none => false

/-! ## Lookup trees (the kernel-checked data path) -/

/-- A card lookup the kernel can evaluate cheaply (an `Array` literal is a list underneath, so
`cs[j]?` walks it).  `leaf i c` holds card `i`; `node m l r` sends indices below `m` left. -/
inductive CTree where
  | leaf (i : Nat) (c : Card)
  | node (m : Nat) (l r : CTree)

def CTree.get : CTree → Nat → Option Card
  | .leaf i c, j => if j = i then some c else none
  | .node m l r, j => if j < m then l.get j else r.get j

def CTree.all (p : Card → Bool) : CTree → Bool
  | .leaf _ c => p c
  | .node _ l r => l.all p && r.all p

/-! ## Parser (untrusted) -/

/-- Cards plus the root hint `(rows, cols, i, g)`. -/
structure CardSet where
  rows : Nat
  cols : Nat
  root : Nat
  rootXf : Xf
  cards : Array Card
deriving Inhabited

/-- All integer tokens of a byte string (ASCII digits with an optional leading `-`). -/
private def ints (s : ByteArray) : Array Int := Id.run do
  let mut out : Array Int := #[]
  let mut cur : Nat := 0
  let mut neg := false
  let mut inNum := false
  for ch in s do
    if 48 ≤ ch.toNat ∧ ch.toNat ≤ 57 then
      cur := cur * 10 + (ch.toNat - 48)
      inNum := true
    else
      if inNum then
        out := out.push (if neg then -(cur : Int) else cur)
      cur := 0
      inNum := false
      neg := ch.toNat == 45
  if inNum then
    out := out.push (if neg then -(cur : Int) else cur)
  return out

private structure Rd where
  xs : Array Int
  i : Nat

private def Rd.next (r : Rd) : Int × Rd := (r.xs.getD r.i 0, { r with i := r.i + 1 })

private def Rd.pts (r : Rd) : List Pt × Rd := Id.run do
  let (n, r) := r.next
  let mut r := r
  let mut out : Array Pt := #[]
  for _ in [0:n.toNat] do
    let (x, r1) := r.next
    let (y, r2) := r1.next
    r := r2
    out := out.push (x, y)
  return (out.toList, r)

private def Rd.hint (r : Rd) (j : Int) : Hint × Rd :=
  let (k, r) := r.next
  let (dx, r) := r.next
  let (dy, r) := r.next
  ((j.toNat, Xf.ofIndex k.toNat dx dy), r)

private def Rd.card (r : Rd) : Card × Rd := Id.run do
  let (h, r) := r.next
  let (px, r) := r.next
  let (py, r) := r.next
  let (A, r) := r.pts
  let (S, r) := r.pts
  let (j, r) := r.next
  let (pass, r) := if j < 0 then (none, r) else
    let (hn, r) := r.hint j
    (some hn, r)
  let (nr, r) := r.next
  let mut r := r
  let mut reps : Array (Pt × Hint) := #[]
  for _ in [0:nr.toNat] do
    let (wx, r1) := r.next
    let (wy, r2) := r1.next
    let (j, r3) := r2.next
    let (hn, r4) := r3.hint j
    r := r4
    reps := reps.push ((wx, wy), hn)
  return ({ A, S, p := (px, py), h := h.toNat, pass, replies := reps.toList }, r)

/-- Parse the text format written by `tools/cards2txt.py`. -/
def parseCards (s : String) : CardSet := Id.run do
  -- the format tag `snaky-cards-txt-v1` contributes the token `1`; skip it
  let r : Rd := { xs := ints s.toUTF8, i := 1 }
  let (rows, r) := r.next
  let (cols, r) := r.next
  let (root, r) := r.next
  let (k, r) := r.next
  let (dx, r) := r.next
  let (dy, r) := r.next
  let mut r := r
  let mut cards : Array Card := #[]
  while r.i < r.xs.size do
    let (c, r') := r.card
    r := r'
    cards := cards.push c
  return { rows := rows.toNat, cols := cols.toNat, root := root.toNat,
           rootXf := Xf.ofIndex k.toNat dx dy, cards }

/-- The whole check: every card justified and the root fits on the board. -/
def CardSet.ok (cs : CardSet) : Bool :=
  allOK cs.cards && rootOK (cs.cards[·]?) cs.rows cs.cols cs.root cs.rootXf

end Snaky
