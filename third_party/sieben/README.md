# Sieben's 20-move Snaky proof sequence, as cards

`cards-17x17.txt` is Nándor Sieben's proof sequence for Snaky
([nandorsieben/Snaky](https://github.com/nandorsieben/Snaky) at `a0a36dd`,
`proof-sequence-20.html.gz`, sha256 `0485b874…dc082d55`), converted to the card text format by
`tools/sieben2cards.py`.  The 17 × 17 page (`web/17x17.html`) plays it.  Published with his permission (email to Trevor Morris, 2026-10-08).

- His HTML: 1,510 situations, each "Maker's stones, Breaker to move", every region cell labelled
  with the situation after Breaker plays there and Maker answers.  The root has one Maker stone
  at depth 19, so Maker wins within 20 moves; its region (250 cells plus the stone) spans 17 × 17.
- Converted: 1,738 cards, root height 20 (heights recomputed as the longest line).
- Checked: `lean/.lake/build/bin/cardcheck third_party/sieben/cards-17x17.txt` prints
  `VALID cards=1738 root=1737 board=17x17`, the same checker as `Snaky.snaky_wins_15x15` uses,
  compiled (no kernel proof of this set).

Regenerate: `tools/sieben2cards.py proof-sequence-20.html.gz third_party/sieben/cards-17x17.txt`.
