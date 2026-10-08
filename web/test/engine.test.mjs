// Tests for web/engine.js against the real card set (run: node --test web/test, or pytest tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCards, getCard, Game, label, parseLabel, EMPTY, BLACK, WHITE } from '../engine.js';

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
