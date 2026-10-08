// Tests for web/engine.js against the real card set (run: node --test web/test, or pytest tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCards, getCard, Game, Line, label, parseLabel, EMPTY, BLACK, WHITE } from '../engine.js';

const CARDS = fileURLToPath(new URL('../../cert/snaky-15x15-cards.txt', import.meta.url));
const text = readFileSync(CARDS, 'utf8');
const fresh = () => parseCards(text);
const cs = fresh();

// Deterministic PRNG (mulberry32) so failures reproduce.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const freeCells = (g) => { const f = []; g.board.forEach((v, i) => v === EMPTY && f.push(i)); return f; };

// Independent of engine.js: is `cells` (board indices) a rotation/reflection of Snaky?
function isSnaky(cells) {
  const norm = (pts) => {
    const mx = Math.min(...pts.map((p) => p[0])), my = Math.min(...pts.map((p) => p[1]));
    return JSON.stringify(pts.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  };
  let shape = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1]];
  const forms = new Set();
  for (let r = 0; r < 4; r++) {
    shape = shape.map(([x, y]) => [-y, x]);
    forms.add(norm(shape));
    forms.add(norm(shape.map(([x, y]) => [x, -y])));
  }
  return cells.length === 6 && forms.has(norm(cells.map((c) => [c % 15, Math.floor(c / 15)])));
}

// Play a game to the end with `pick(game) -> cell` choosing White's moves; check it as we go.
function playOut(pick, g = new Game(cs)) {
  while (!g.won) {
    const cell = pick(g);
    if (g.answerTo(cell) >= 0) {
      const ans = g.answerTo(cell);
      g.whiteMove(cell);
      assert.equal(g.history.at(-1).cell, ans, 'answerTo predicts the reply');
    } else {
      g.whiteMove(cell);
    }
    assert.equal(g.history.at(-1).color, BLACK);
  }
  assert.ok(isSnaky(g.won), 'winning cells form a Snaky');
  assert.ok(g.won.every((c) => g.board[c] === BLACK));
  const nb = g.history.filter((m) => m.color === BLACK).length;
  assert.ok(nb <= 25, `Black needed ${nb} moves, more than the root card's height 25`);
  return g;
}

test('card set header and root card', () => {
  assert.equal(cs.rows, 15);
  assert.equal(cs.cols, 15);
  assert.equal(cs.lines.length, 8671);
  assert.equal(cs.root, 0);
  assert.deepEqual(cs.rootXf, { a: 1, b: 0, c: 0, d: 1, dx: 0, dy: 0 });
  const c = getCard(cs, 0);
  assert.equal(c.h, 25);
  assert.deepEqual(c.p, [7, 7]);
  assert.equal(c.A.length, 0);
});

test('labels', () => {
  assert.equal(label(15, 7 * 15 + 7), 'h8');
  assert.equal(label(15, 0), 'a1');
  assert.equal(label(15, 224), 'o15');
  assert.equal(parseLabel(15, 'h8'), 112);
  assert.equal(parseLabel(15, 'zz'), -1);
});

test('Black opens at the centre with the root card', () => {
  const g = new Game(cs);
  assert.deepEqual(g.history, [{ color: BLACK, cell: 112 }]);
  assert.equal(g.bound(), 25);
});

test('a recorded game: White e5 f6 j11 j9 g9 loses to the snake h8-k8, k9, l9', () => {
  const g = new Game(cs);
  for (const w of ['e5', 'f6', 'j11', 'j9', 'g9']) g.whiteMove(parseLabel(15, w));
  const seq = g.history.map((m) => label(15, m.cell)).join(' ');
  assert.equal(seq, 'h8 e5 i8 f6 j8 j11 k8 j9 l9 g9 k9');
  assert.deepEqual([...g.won].sort((a, b) => a - b).map((c) => label(15, c)),
    ['h8', 'i8', 'j8', 'k8', 'k9', 'l9']);
});

test('random White: Black wins every game within 25 moves', () => {
  const r = rng(1);
  for (let n = 0; n < 3000; n++) {
    playOut((g) => { const f = freeCells(g); return f[Math.floor(r() * f.length)]; });
  }
});

test('every White first reply, then random play', () => {
  const r = rng(2);
  for (const first of freeCells(new Game(cs))) {
    for (let n = 0; n < 8; n++) {
      const g = new Game(cs);
      g.whiteMove(first);
      playOut((gg) => { const f = freeCells(gg); return f[Math.floor(r() * f.length)]; }, g);
    }
  }
});

test('stubborn White (always the reply whose card is tallest) lasts the full 25 moves and loses', () => {
  const r = rng(3);
  let longest = 0;
  for (let n = 0; n < 300; n++) {
    const g = playOut((gg) => {
      let best = -1, bestH = -1;
      for (const c of freeCells(gg)) {
        const h = getCard(cs, gg.hintFor(c).j).h + r();     // random tie-break
        if (h > bestH) { bestH = h; best = c; }
      }
      return best;
    });
    longest = Math.max(longest, g.history.filter((m) => m.color === BLACK).length);
  }
  // Measured: every such game runs to exactly the root card's height, so the bound is reached.
  assert.equal(longest, 25);
});

test('White moves on occupied cells and after the game are refused', () => {
  const g = new Game(cs);
  assert.throws(() => g.whiteMove(112), /occupied/);
  playOut((gg) => freeCells(gg)[0], g);
  assert.throws(() => g.whiteMove(freeCells(g)[0]), /game over/);
});

// Teeth: the engine's checks fire on a corrupted card set.

test('a reply hint whose height does not drop is refused', () => {
  const bad = fresh();
  const g = new Game(bad);
  const cell = parseLabel(15, 'h9');
  const hint = g.hintFor(cell);
  getCard(bad, hint.j).h = 25;                       // the next card is no lower than the root
  assert.throws(() => g.whiteMove(cell), /height does not drop/);
});

test('a card whose A is not Black\'s trips the invariant', () => {
  const bad = fresh();
  const g = new Game(bad);
  const cell = parseLabel(15, 'h9');
  const hint = g.hintFor(cell);
  getCard(bad, hint.j).A.push([-100, -100]);         // a required Black stone off the board
  assert.throws(() => g.whiteMove(cell), /invariant/);
});

test('a card whose S holds a White stone trips the invariant', () => {
  const bad = fresh();
  const g = new Game(bad);
  const cell = parseLabel(15, 'h9');
  const hint = g.hintFor(cell);
  const next = getCard(bad, hint.j);
  // Put the White move itself into the next card's region, in that card's own coordinates.
  const [x, y] = g.xy(cell);
  const G2 = { ...hint.g };
  const u = x - G2.dx, v = y - G2.dy;
  next.S.push([G2.a * u + G2.c * v, G2.b * u + G2.d * v]);
  assert.throws(() => g.whiteMove(cell), /invariant: White owns/);
});

test('a missing reply hint is refused', () => {
  const bad = fresh();
  const g = new Game(bad);
  getCard(bad, 0).replies.clear();
  assert.throws(() => g.whiteMove(parseLabel(15, 'h9')), /no reply/);
});

test('the board never holds both colours on a cell, and stones alternate', () => {
  const g = playOut((gg) => freeCells(gg).at(-1));
  g.history.forEach((m, i) => assert.equal(m.color, i % 2 === 0 ? BLACK : WHITE));
  assert.equal(new Set(g.history.map((m) => m.cell)).size, g.history.length);
});

// White hints.

test('every card height is exactly its longest line: 1 + the tallest hinted card (1 if none)', () => {
  for (let j = 0; j < cs.lines.length; j++) {
    const c = getCard(cs, j);
    const kids = [...c.replies.values(), ...(c.pass ? [c.pass] : [])].map((h) => getCard(cs, h.j).h);
    assert.equal(c.h, kids.length ? 1 + Math.max(...kids) : 1, `card ${j}`);
  }
});

test('opening hints: the four cells touching h8 are White\'s best, 24; most cells are 15', () => {
  const vals = new Game(cs).whiteValues();
  assert.equal(vals.length, 224);
  const best = Math.max(...vals.map((v) => v.value));
  assert.equal(best, 24);
  assert.deepEqual(vals.filter((v) => v.value === 24).map((v) => label(15, v.cell)).sort(),
    ['g8', 'h7', 'h9', 'i8']);
  const fifteen = vals.filter((v) => v.value === 15).length;
  assert.ok(fifteen > 150, `expected most cells at 15, got ${fifteen}`);
});

test('a hint value is what the counter shows after playing it, and never beats bound - 1', () => {
  const r = rng(4);
  for (let n = 0; n < 200; n++) {
    const g = new Game(cs);
    while (!g.won) {
      const vals = g.whiteValues();
      assert.ok(Math.max(...vals.map((v) => v.value)) <= g.bound() - 1);
      const pick = vals[Math.floor(r() * vals.length)];
      g.whiteMove(pick.cell);
      if (!g.won) assert.equal(g.bound(), pick.value);
    }
  }
});

test('threats: none at the start; one (a forced move) and two (a forced loss) in recorded games', () => {
  const g = new Game(cs);
  assert.deepEqual(g.threats(), []);
  // Black h8 i8 j8 k8 l9: only k9 completes a Snaky (h8-k8, k9, l9).
  for (const w of ['e5', 'f6', 'j11', 'j9']) g.whiteMove(parseLabel(15, w));
  assert.deepEqual(g.threats().map((c) => label(15, c)), ['k9']);
  const lost = new Game(cs);
  for (const w of ['f9', 'k6', 'k8', 'k11', 'g5', 'g3']) lost.whiteMove(parseLabel(15, w));
  assert.deepEqual(lost.threats().map((c) => label(15, c)).sort(), ['i3', 'i5']);
});

test('blocking a lone threat never hands Black a win at once; ignoring it always does', () => {
  const r = rng(5);
  let forced = 0;
  for (let n = 0; n < 300; n++) {
    const g = new Game(cs);
    while (!g.won) {
      const t = g.threats();
      if (t.length === 1) {
        forced++;
        const ignore = new Game(cs);
        for (const m of g.history.filter((h) => h.color === WHITE)) ignore.whiteMove(m.cell);
        ignore.whiteMove(freeCells(ignore).find((c) => c !== t[0]));
        assert.ok(ignore.won, 'ignoring the threat lets Black complete it');
      }
      const f = freeCells(g);
      g.whiteMove(t.length === 1 ? t[0] : f[Math.floor(r() * f.length)]);
      if (t.length === 1 && !g.won) assert.notEqual(g.history.at(-1).cell, t[0]);
    }
  }
  assert.ok(forced > 50, `expected many forced moves, saw ${forced}`);
});

test('Line: ← takes back, → replays in order, a different move ends the replay line', () => {
  const l = new Line([1, 2, 3]);
  assert.ok(l.back()); assert.ok(l.back());
  assert.deepEqual(l.whites, [1]);
  assert.ok(l.forward());
  assert.deepEqual(l.whites, [1, 2]);
  l.play(3);                                  // the move → would replay: the line survives
  assert.deepEqual([l.whites, l.redo], [[1, 2, 3], []]);
  l.back(); l.back();
  l.play(9);                                  // a different move: nothing left to replay
  assert.deepEqual([l.whites, l.redo], [[1, 9], []]);
  assert.equal(l.forward(), false);
  assert.ok(l.back()); assert.ok(l.back());
  assert.equal(l.back(), false);              // nothing before Black's opening move
  assert.deepEqual(l.whites, []);
});

test('hintMarks: best always marked, plus anything better than the most common; the rest hidden', async () => {
  const { hintMarks } = await import('../engine.js');
  const shown = (vals) => { const m = hintMarks(vals); return vals.filter(m.show); };
  // 9 x 9 after c3 e5: the best value is also the most common one.
  assert.deepEqual(shown([6, 6, 6, 5, 4, 2]), [6, 6, 6]);
  assert.equal(hintMarks([6, 6, 6, 5, 4, 2]).hiddenLoss, 1);
  // 15 x 15 after h8 h7 i8: common 10 is not the best; 9 (worse than common) is hidden too.
  assert.deepEqual(shown([10, 10, 10, 10, 23, 21, 13, 9]), [23, 21, 13]);
  assert.equal(hintMarks([10, 10, 10, 10, 23, 21, 13, 9]).hiddenLoss, 13);
  // A tie for most common: the lower value counts, so the higher one is shown.
  assert.deepEqual(shown([3, 3, 5, 5, 7]), [5, 5, 7]);
  // Every move the same: every move is a best move, so all are marked (9 x 9 after c3 e5 f6 f5
  // g6 d6: all 75 moves score 0, and an earlier rule left the board blank).
  assert.equal(hintMarks([0, 0, 0]).uniform, true);
  assert.equal(hintMarks([0, 0, 0]).hiddenLoss, null);
  assert.deepEqual(shown([0, 0, 0]), [0, 0, 0]);
});
