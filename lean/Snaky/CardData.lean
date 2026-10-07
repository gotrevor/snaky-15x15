import Snaky.Cards

/-!
# The 15 × 15 card set

`cert/snaky-15x15-cards.txt` (8,671 cards; written by `tools/cards2txt.py` from the card set
`snaky-15x15-cards.json`, sha256 `1bf7430e…aa52278376a8d7e65f5e4882ddbb3173362e956a72f9aaf658e1b`,
built from the tree certificate in `cert/snaky-15x15.tar.gz`).  The text is data, not trusted:
`CardSet.sound` holds for whatever `parseCards` returns.
-/
namespace Snaky

def cardText : String := include_str "../../cert/snaky-15x15-cards.txt"

def cards15 : CardSet := parseCards cardText

end Snaky
