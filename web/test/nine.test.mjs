// Tests for web/nine.js on the 6 x 6 and 7 x 7 White certificates (fixtures/, encoded by the
// search repo's exporter from certificates its checker passed).  The 9 x 9 certificates are too
// big to ship here; the page loads them from the site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCert, getNode, symmetries, repOf, Play } from '../nine.js';
import { parseLabel, EMPTY, BLACK, WHITE } from '../engine.js';

const load = (n) => readFileSync(fileURLToPath(new URL(`fixtures/snaky-${n}.txt`, import.meta.url)), 'utf8');
const TEXT = { 6: load('6x6'), 7: load('7x7') };

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const free = (p) => { const f = []; p.board.forEach((v, i) => v === EMPTY && f.push(i)); return f; };

// Black either plays at random or greedily (the free cell on the live Snaky with most Black stones).
function blackChoice(p, rand, greedy) {
  const cells = free(p);
  if (!greedy) return cells[Math.floor(rand() * cells.length)];
  let best = cells[0], score = -1;
  for (const s of p.live()) {
    const k = s.filter((i) => p.board[i] === BLACK).length;
    for (const i of s) if (p.board[i] === EMPTY && k > score) { best = i; score = k; }
  }
  return best;
}

// Independent of nine.js's bookkeeping: at a pairing leaf every live Snaky holds a pair with both
// cells empty, else the pairing could not still be winning.
function assertPairingHolds(p) {
  const v = p.view();
  if (!v || v.kind !== 'pave') return false;
  for (const s of p.live()) {
    assert.ok(v.pairs.some(([a, b]) => s.includes(a) && s.includes(b)), `live Snaky ${s} has no empty pair`);
  }
  return true;
}

function playOut(p, rand, greedy, whys) {
  let pave = 0;
  while (!p.won) {
    p.black(blackChoice(p, rand, greedy));
    whys.add(p.history.at(-1).why);
    if (assertPairingHolds(p)) pave++;
  }
  return pave;
}

test('parse: headers and node kinds', () => {
  const c = parseCert(TEXT[7]);
  assert.deepEqual([c.rows, c.cols, c.black, c.white], [7, 7, [], []]);
  const root = getNode(c, c.root);
  // The 7 x 7 certificate answers the 10 first moves up to symmetry at its root.
  assert.equal(root.moves.size, 10);
  assert.equal(root.moves.get(parseLabel(7, 'a1')).w, parseLabel(7, 'e4'));   // cert: [0, 25, ...]
  const kinds = new Set(c.lines.filter(Boolean).map((l) => l[0]));
  assert.deepEqual([...kinds].sort(), ['m', 'p']);
});

test('symmetries: 8 bijections on a square board, 4 on a rectangle; 9 x 9 has 15 first moves', () => {
  for (const [r, c, k] of [[9, 9, 8], [8, 9, 4]]) {
    const syms = symmetries(r, c);
    assert.equal(syms.length, k);
    for (const g of syms) assert.equal(new Set(g).size, r * c);
  }
  const reps = 'a1 b1 c1 d1 e1 b2 c2 d2 e2 c3 d3 e3 d4 e4 e5'.split(' ').map((s) => parseLabel(9, s));
  const hit = new Map();
  for (let cell = 0; cell < 81; cell++) {
    const r = repOf(9, 9, cell, reps);
    assert.ok(r && r.g[cell] === r.rep);
    hit.set(r.rep, (hit.get(r.rep) || 0) + 1);
  }
  assert.equal(hit.size, 15);
  assert.equal(hit.get(parseLabel(9, 'e5')), 1);   // the centre is its own class
  assert.equal(hit.get(parseLabel(9, 'a1')), 4);
});

test('White wins every game from the empty board (6 x 6, 7 x 7), every rule exercised', () => {
  const whys = new Set();
  for (const n of [6, 7]) {
    const cert = parseCert(TEXT[n]);
    let paveGames = 0;
    for (let s = 0; s < 120; s++) {
      const p = new Play(n, n);
      p.attach(cert);
      const pave = playOut(p, rng(1000 * n + s), s % 3 === 0, whys);
      assert.equal(p.won, 'white', `seed ${s} on ${n} x ${n}`);
      if (pave) paveGames++;
    }
    assert.ok(paveGames > 0);
  }
  for (const w of ['tree', 'symmetry', 'pair']) assert.ok(whys.has(w), `rule ${w} never fired`);
});

// The 9 x 9 page plays per-first-move certificates; split the 7 x 7 one the same way.
test('per-first-move certificates: every first move on 7 x 7, through its representative', () => {
  const full = parseCert(TEXT[7]);
  const root = getNode(full, full.root);
  const reps = [...root.moves.keys()];
  const sub = (b) => {
    const { w, child } = root.moves.get(b);
    const c = parseCert(TEXT[7]);
    return Object.assign(c, { root: child, black: [b], white: [w] });
  };
  for (let cell = 0; cell < 49; cell++) {
    const { rep, g } = repOf(7, 7, cell, reps);
    for (let s = 0; s < 6; s++) {
      const p = new Play(7, 7);
      const w = p.firstMove(cell, sub(rep), g);
      assert.equal(p.board[w], WHITE);
      playOut(p, rng(cell * 31 + s), s % 2 === 0, new Set());
      assert.equal(p.won, 'white');
    }
  }
});

test('teeth: a move the tree drops and no symmetry covers is caught', () => {
  // Drop a1 from the 7 x 7 root: its whole class (a1, a7, g1, g7) loses its answer.
  const a1 = parseLabel(7, 'a1');
  const ch = String.fromCharCode(40 + a1);
  const lines = TEXT[7].split('\n');
  const root = Number(lines[0].split(' ')[3]);
  lines[root + 1] = 'm' + lines[root + 1].slice(1).split(' ').filter((g) => g[0] !== ch).join(' ');
  const bad = parseCert(lines.join('\n'));
  for (const cell of ['a1', 'g7', 'a7', 'g1']) {
    const p = new Play(7, 7);
    p.attach(bad);
    assert.throws(() => p.black(parseLabel(7, cell)), /no answer to Black/);
  }
  const p = new Play(7, 7);
  p.attach(bad);
  assert.doesNotThrow(() => p.black(parseLabel(7, 'b1')));
});

test('teeth: the pairing check catches an emptied pairing', () => {
  // Every pave leaf replaced by an empty pairing: the first pairing leaf with a live Snaky fails.
  const lines = TEXT[7].split('\n').map((l, i) => (i > 0 && l[0] === 'p' ? 'p' : l));
  const bad = parseCert(lines.join('\n'));
  let caught = 0;
  for (let s = 0; s < 20; s++) {
    const p = new Play(7, 7);
    p.attach(bad);
    try {
      playOut(p, rng(s), s % 2 === 0, new Set());
    } catch (e) {
      if (e instanceof assert.AssertionError && /has no empty pair/.test(e.message)) caught++;
      else throw e;
    }
  }
  assert.ok(caught > 0, 'an empty pairing was never caught');
});

// The real 9 x 9 certificates, when a snapshot directory is at hand (they are not in this repo):
// SNAKY_WEB9=<dir with progress.json> node --test web/test
const WEB9 = process.env.SNAKY_WEB9;
test('9 x 9 snapshot: random and greedy Black lose from every proved first move', { skip: !WEB9 && 'set SNAKY_WEB9' }, () => {
  const snap = JSON.parse(readFileSync(`${WEB9}/progress.json`, 'utf8'));
  const reps = snap.moves.map((m) => parseLabel(9, m.cell));
  const whys = new Set();
  for (const m of snap.moves.filter((x) => x.status === 'proved')) {
    const cert = parseCert(readFileSync(`${WEB9}/${m.cert}`, 'utf8'));
    const rep = parseLabel(9, m.cell);
    assert.equal(cert.black[0], rep);
    for (let cell = 0; cell < 81; cell++) {
      const r = repOf(9, 9, cell, reps);
      if (r.rep !== rep) continue;
      for (let s = 0; s < 4; s++) {
        const p = new Play(9, 9);
        p.firstMove(cell, cert, r.g);
        playOut(p, rng(cell * 7 + s), s % 2 === 0, whys);
        assert.equal(p.won, 'white', `${m.cell} via ${cell} seed ${s}`);
      }
    }
  }
  for (const w of ['tree', 'symmetry', 'pair']) assert.ok(whys.has(w), `rule ${w} never fired`);
});
