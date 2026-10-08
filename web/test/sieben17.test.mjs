// web/engine.js playing Sieben's 20-move proof sequence on 17 x 17 (third_party/sieben/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCards, getCard, Game, EMPTY, BLACK } from '../engine.js';

const CARDS = fileURLToPath(new URL('../../third_party/sieben/cards-17x17.txt', import.meta.url));
const cs = parseCards(readFileSync(CARDS, 'utf8'));

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const freeCells = (g) => { const f = []; g.board.forEach((v, i) => v === EMPTY && f.push(i)); return f; };
const blackMoves = (g) => g.history.filter((m) => m.color === BLACK).length;

function playOut(pick, g = new Game(cs)) {
  while (!g.won) g.whiteMove(pick(g));
  assert.ok(g.won.every((c) => g.board[c] === BLACK));
  assert.ok(blackMoves(g) <= 20, `Black needed ${blackMoves(g)} moves`);
  return g;
}

test('17 x 17 board, root height 20', () => {
  assert.equal(cs.rows, 17);
  assert.equal(cs.cols, 17);
  assert.equal(getCard(cs, cs.root).h, 20);
});

test('random White: Black wins every game within 20 moves', () => {
  const r = rng(11);
  for (let n = 0; n < 2000; n++) playOut((g) => { const f = freeCells(g); return f[Math.floor(r() * f.length)]; });
});

test('every White first reply, then random play', () => {
  const r = rng(12);
  for (const first of freeCells(new Game(cs))) {
    const g = new Game(cs);
    g.whiteMove(first);
    playOut((gg) => { const f = freeCells(gg); return f[Math.floor(r() * f.length)]; }, g);
  }
});

test('stubborn White (always the tallest hinted card) lasts exactly 20 moves', () => {
  const r = rng(13);
  let longest = 0;
  for (let n = 0; n < 200; n++) {
    const g = playOut((gg) => {
      let best = -1, bestH = -1;
      for (const c of freeCells(gg)) {
        const h = getCard(cs, gg.hintFor(c).j).h + r();
        if (h > bestH) { bestH = h; best = c; }
      }
      return best;
    });
    longest = Math.max(longest, blackMoves(g));
  }
  assert.equal(longest, 20);
});

test('every card height is exactly its longest line', () => {
  for (let j = 0; j < cs.lines.length; j++) {
    const c = getCard(cs, j);
    const kids = [...c.replies.values(), ...(c.pass ? [c.pass] : [])].map((h) => getCard(cs, h.j).h);
    assert.equal(c.h, kids.length ? 1 + Math.max(...kids) : 1, `card ${j}`);
  }
});
