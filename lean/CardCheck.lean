import Snaky.Cards

/-! `cardcheck FILE.txt [--no-root]`: run the Lean card checker (the same `CardSet.ok` the proof evaluates)
on a card file written by `tools/cards2txt.py`. -/
open Snaky

def main (args : List String) : IO UInt32 := do
  let noRoot := args.contains "--no-root"
  let [path] := args.filter (· != "--no-root") | IO.println "usage: cardcheck CARDS.txt [--no-root]"; return 2
  let cs := parseCards (← IO.FS.readFile path)
  let bad := (List.range cs.cards.size).filter fun i => !cardOK (cs.cards[·]?) cs.cards[i]!
  if let i :: _ := bad then
    IO.println s!"INVALID: card {i} not justified ({bad.length} cards fail)"
    return 1
  if noRoot then
    IO.println s!"VALID cards={cs.cards.size} root=skipped"
    return 0
  if !rootOK (cs.cards[·]?) cs.rows cs.cols cs.root cs.rootXf then
    IO.println s!"INVALID: root card {cs.root} does not cover the empty {cs.rows}x{cs.cols} board"
    return 1
  IO.println s!"VALID cards={cs.cards.size} root={cs.root} board={cs.rows}x{cs.cols}"
  return 0
