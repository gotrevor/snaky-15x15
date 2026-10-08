// Tests for web/nine.js on the 6 x 6 and 7 x 7 White certificates (fixtures/, encoded by the
// search repo's exporter from certificates its checker passed).  The 9 x 9 certificates are too
// big to ship here; the page loads them from the site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCert, getNode, symmetries, repOf, height, Play } from '../nine.js';
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

test('height: 0 at a pairing, 1 + the tallest child at a tree node', () => {
  const c = parseCert(TEXT[7]);
  for (let i = 0; i < c.lines.length; i++) {
    if (!c.lines[i]) continue;
    const n = getNode(c, i);
    const want = n.pave ? 0 : Math.max(0, ...[...n.moves.values()].map((m) => 1 + height(c, m.child)));
    assert.equal(height(c, i), want);
  }
  assert.equal(height(c, c.root), 2);   // 7 x 7: the exporter (Python) also gives 2
});

test("Black hints: each value is the height White's tree reaches after that move", () => {
  const kinds = new Set();
  for (const n of [6, 7]) {
    const cert = parseCert(TEXT[n]);
    for (let s = 0; s < 40; s++) {
      const p = new Play(n, n);
      p.attach(cert);
      const rand = rng(77 * n + s);
      while (!p.won) {
        const hints = p.hints();
        for (const h of hints) kinds.add(h.kind);
        assert.ok(!hints.some((h) => h.kind === 'win' || h.kind === 'unknown'), 'a proved line offers Black a win or an unknown');
        const h = hints[Math.floor(rand() * hints.length)];
        const before = p.node;
        p.black(h.cell);
        if (h.kind === 'dead') assert.equal(p.node, before);
        else if (getNode(cert, before).moves) assert.equal(height(cert, p.node), h.value);
        else assert.equal(h.value, 0);
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ['dead', 'value']);
});

test('off the proof: an open first move gets the candidate reply, then guesses, and hints say unknown', () => {
  const p = new Play(9, 9);
  const w = p.firstMoveUnknown(parseLabel(9, 'e5'), parseLabel(9, 'e4'));
  assert.equal(w, parseLabel(9, 'e4'));
  assert.ok(p.unknown);
  assert.equal(p.history.at(-1).why, 'candidate');
  assert.ok(p.hints().every((h) => h.kind === 'unknown'));
  // Black's row-5 line: d5 f5 c5 g5 ... White guesses; Black's one-move wins show as 'win'.
  const rand = rng(5);
  let wins = 0;
  for (let k = 0; k < 40 && !p.won; k++) {
    const hs = p.hints();
    wins += hs.filter((h) => h.kind === 'win').length;
    const win = hs.find((h) => h.kind === 'win');
    p.black(win ? win.cell : hs[Math.floor(rand() * hs.length)].cell);
    if (!p.won || p.won === 'white') assert.equal(p.history.at(-1).why, 'guess');
  }
  assert.ok(p.won);
  void wins;
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
    assert.equal(height(cert, cert.root), m.height, `${m.cell}: height`);
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

test('every position of every game shows at least one best move (6 x 6, 7 x 7)', async () => {
  const { hintMarks } = await import('../engine.js');
  for (const n of [6, 7]) {
    const cert = parseCert(TEXT[n]);
    for (let s = 0; s < 60; s++) {
      const p = new Play(n, n);
      p.attach(cert);
      const rand = rng(31 * n + s);
      while (!p.won) {
        const vals = p.hints().filter((h) => h.kind === 'value').map((h) => h.value);
        if (vals.length) assert.ok(vals.some(hintMarks(vals).show), `blank board after ${p.history.map((h) => h.cell)}`);
        p.black(blackChoice(p, rand, s % 2 === 0));
      }
    }
  }
});

test('9 x 9 c3 e5, f6 f5, g6 d6: every move scores 0 and all 75 are marked', { skip: !WEB9 && 'set SNAKY_WEB9' }, async () => {
  const { hintMarks } = await import('../engine.js');
  const cert = parseCert(readFileSync(`${WEB9}/cert-c3.txt`, 'utf8'));
  const p = new Play(9, 9);
  const c3 = parseLabel(9, 'c3');
  p.firstMove(c3, cert, repOf(9, 9, c3, [c3]).g);
  assert.equal(p.black(parseLabel(9, 'f6')), parseLabel(9, 'f5'));
  assert.equal(p.black(parseLabel(9, 'g6')), parseLabel(9, 'd6'));
  const vals = p.hints().filter((h) => h.kind === 'value').map((h) => h.value);
  assert.equal(vals.length, 75);
  assert.ok(vals.every((v) => v === 0));
  assert.equal(vals.filter(hintMarks(vals).show).length, 75);
});

// ---- Explorer: the live search reports ------------------------------------------------------
test('Explorer: statuses by side to move, mirrored moves map onto the listed ones, frame follows', async () => {
  const { Explorer } = await import('../nine.js');
  const L = (s) => parseLabel(9, s);
  const nodes = {
    e5: { side: 'W', d: 15, cands: { e4: 'searching', d5: 'pending' } },
    'e5 e4': { side: 'B', d: 14, moves: { d5: ['open', null], d4: ['proved', 'c4'], e6: ['pave', 'e7'] } },
    'e5 e4 d5': { side: 'W', d: 14, cands: { c5: 'searching', f5: 'open' } },
  };
  const x = new Explorer(9, 9, nodes);
  x.start(L('e5'), symmetries(9, 9)[0]);
  const at = (m, s) => m.find((h) => h.cell === L(s));
  let m = x.marks();
  assert.equal(at(m, 'e4').status, 'searching');
  assert.equal(at(m, 'd5').status, 'pending');
  assert.equal(at(m, 'f5').status, 'pending');          // e5 alone is fixed by all 8 symmetries
  assert.equal(at(m, 'a1').status, 'unknown');
  x.place(L('e4'));
  m = x.marks();
  assert.equal(at(m, 'd5').status, 'open');
  assert.equal(at(m, 'f5').status, 'open');            // mirror of d5 across the e file fixes e5, e4
  assert.equal(at(m, 'f4').status, 'proved');          // mirror of d4
  assert.equal(at(m, 'f4').reply, L('g4'));            // and its reply c4 mirrors to g4
  assert.equal(at(m, 'e6').status, 'pave');
  assert.equal(at(m, 'a9').status, 'unknown');         // not listed in this record
  // Play the mirror f5: the frame flips, so the next record is "e5 e4 d5" and c5 shows at g5.
  x.place(L('f5'));
  assert.equal(x.key(), 'e5 e4 d5');
  m = x.marks();
  assert.equal(at(m, 'g5').status, 'searching');
  assert.equal(at(m, 'd5').status, 'open');            // f5 in the search's frame
  x.place(L('g5'));
  assert.equal(x.record(), null);                       // beyond the report: unknown everywhere
  assert.ok(x.marks().every((h) => h.status === 'unknown' || h.status === 'dead'));
});

test('9 x 9 snapshot: every published report walks cleanly from every cell of its first move', { skip: !WEB9 && 'set SNAKY_WEB9' }, async () => {
  const { Explorer } = await import('../nine.js');
  const snap = JSON.parse(readFileSync(`${WEB9}/progress.json`, 'utf8'));
  const reps = snap.moves.map((m) => parseLabel(9, m.cell));
  let walked = 0;
  for (const m of snap.moves.filter((x) => x.report)) {
    const rep = JSON.parse(readFileSync(`${WEB9}/${m.report}`, 'utf8'));
    assert.equal(rep.format, 'snaky-white-report-v1');
    for (const nodes of [rep.nodes, rep.last]) {
      if (!nodes || !Object.keys(nodes).length) continue;
      assert.ok(nodes[m.cell], `${m.cell}: no root record`);
      for (let cell = 0; cell < 81; cell++) {
        const r = repOf(9, 9, cell, reps);
        if (r.rep !== parseLabel(9, m.cell)) continue;
        const x = new Explorer(9, 9, nodes);
        x.start(cell, r.g);
        assert.equal(x.key(), m.cell);
        // Follow the first listed move at each step while records last.
        for (let k = 0; k < 12 && x.record(); k++) {
          const next = x.marks().find((h) => !['unknown', 'dead'].includes(h.status));
          if (!next) break;
          x.place(next.cell);
          walked++;
        }
      }
    }
  }
  assert.ok(walked > 0 || !snap.moves.some((x) => x.report));
});
