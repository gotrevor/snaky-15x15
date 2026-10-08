// White's proved strategy for 9 x 9 Snaky, read off a certificate in snaky-white-cert-txt-v1
// (written by the search repo's exporter; every certificate there passes an independent checker
// before it is published).  No search here: the page plays the certificate.
//
// The certificate is a tree of Black-to-move nodes.  At a "moves" node, Black's move b has White's
// reply w (or a pass) and a child node.  At a "pave" leaf White holds a pairing: disjoint free
// pairs such that every live Snaky (one with no White stone) contains a pair, and White answers a
// move in a pair with its partner.  Black moves the tree leaves out are covered by the checker's
// rules: R2, the cell lies in no live Snaky, so White answers as if Black had passed; R3, a board
// symmetry fixing the position (live Snakys, and Black's stones on them) maps the move onto one
// the tree answers.  A pass, or a reply whose cell is already taken, becomes an extra White stone
// anywhere, which never hurts White (R1).
//
// The board and the certificate use different frames once R3 fires, so `f` maps board cells to
// certificate cells.  `vb`/`vw` hold the position the checker visited at the current node, in the
// certificate's frame; R2 and R3 are decided on it, exactly as the checker decided them.
// Pure module, no DOM: the page and the tests share it.

import { placements, label, EMPTY, BLACK, WHITE } from './engine.js';

export const cellOf = (ch) => ch.charCodeAt(0) - 40;

export function parseCert(text) {
  const lines = text.split('\n');
  const head = lines[0].trim().split(/\s+/);
  if (head[0] !== 'snaky-white-cert-txt-v1') throw new Error('not a snaky-white-cert-txt-v1 file');
  const stones = (s) => (s === '-' ? [] : [...s].map(cellOf));
  return {
    rows: Number(head[1]), cols: Number(head[2]), root: Number(head[3]),
    black: stones(head[4]), white: stones(head[5]), lines: lines.slice(1), cache: new Map(),
  };
}

// {pave: Map cell -> partner} or {moves: Map black cell -> {w: cell | null, child}}
export function getNode(cert, i) {
  let n = cert.cache.get(i);
  if (n) return n;
  const line = cert.lines[i];
  if (!line) throw new Error(`no node ${i}`);
  if (line[0] === 'p') {
    const pave = new Map();
    for (let k = 1; k + 1 < line.length; k += 2) {
      const a = cellOf(line[k]), b = cellOf(line[k + 1]);
      pave.set(a, b);
      pave.set(b, a);
    }
    n = { pave };
  } else if (line[0] === 'm') {
    const moves = new Map();
    for (const g of line.slice(1).split(' ')) {
      moves.set(cellOf(g[0]), { w: g[1] === '!' ? null : cellOf(g[1]), child: parseInt(g.slice(2), 16) });
    }
    n = { moves };
  } else {
    throw new Error(`node ${i}: unknown kind ${JSON.stringify(line[0])}`);
  }
  cert.cache.set(i, n);
  return n;
}

// The most Black moves White's tree can still need from node i before every line reaches a
// pairing (0 at a pairing).  The exporter computes the same number for each root.
export function height(cert, i) {
  if (!cert.heights) cert.heights = new Map();
  const memo = cert.heights;
  if (memo.has(i)) return memo.get(i);
  let h = 0;
  if (cert.lines[i][0] === 'm') {
    for (const { child } of getNode(cert, i).moves.values()) h = Math.max(h, 1 + height(cert, child));
  }
  memo.set(i, h);
  return h;
}

// The board's symmetries as cell permutations, in the checker's order (identity first).
export function symmetries(rows, cols) {
  const maps = [(r, c) => [r, c], (r, c) => [rows - 1 - r, c], (r, c) => [r, cols - 1 - c],
    (r, c) => [rows - 1 - r, cols - 1 - c]];
  if (rows === cols) {
    const n = rows;
    maps.push((r, c) => [c, r], (r, c) => [n - 1 - c, r], (r, c) => [c, n - 1 - r], (r, c) => [n - 1 - c, n - 1 - r]);
  }
  return maps.map((m) => {
    const perm = new Int16Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const [r2, c2] = m(r, c);
        perm[r * cols + c] = r2 * cols + c2;
      }
    }
    return perm;
  });
}

const invert = (p) => { const q = new Int16Array(p.length); p.forEach((v, i) => { q[v] = i; }); return q; };

// The first move up to symmetry: the representative in `reps` (cell indices) that `cell` maps to,
// and a symmetry g with g[cell] = rep.
export function repOf(rows, cols, cell, reps) {
  for (const g of symmetries(rows, cols)) if (reps.includes(g[cell])) return { rep: g[cell], g };
  return null;
}

export class Play {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.placements = placements(rows, cols);
    this.syms = symmetries(rows, cols);
    this.board = new Int8Array(rows * cols);
    this.history = [];     // [{color, cell, why}]
    this.cert = null;
    this.node = -1;
    this.won = null;       // 'white' once no Snaky fits; 'black' only if the certificate were wrong
    this.winCells = null;  //   (or, off the proof, against White's guesses)
    this.unknown = false;  // off the proof: no certificate covers this line
  }

  // Follow `cert` from its root; g maps board cells to certificate cells (identity if omitted).
  attach(cert, g = null) {
    if (cert.rows !== this.rows || cert.cols !== this.cols) throw new Error('certificate is for another board');
    this.cert = cert;
    this.f = g || this.syms[0];
    this.finv = invert(this.f);
    this.node = cert.root;
    this.vb = new Set(cert.black);
    this.vw = new Set(cert.white);
  }

  // A certificate that starts after Black's first move b and White's reply: Black plays `cell`,
  // g maps it onto b, and White answers with the certificate's reply.
  firstMove(cell, cert, g) {
    if (cert.black.length !== 1 || cert.white.length !== 1 || g[cell] !== cert.black[0]) {
      throw new Error('certificate does not start from this first move');
    }
    this.place(BLACK, cell, null);
    this.attach(cert, g);
    this.place(WHITE, this.finv[cert.white[0]], 'tree');
    return this.history.at(-1).cell;
  }

  // An open first move: no certificate yet.  White answers `reply` and the game goes on off the
  // proof, White playing the extra-stone heuristic.
  firstMoveUnknown(cell, reply) {
    this.place(BLACK, cell, null);
    this.unknown = true;
    this.place(WHITE, reply >= 0 && this.board[reply] === EMPTY ? reply : this.extra(), 'candidate');
    return this.history.at(-1).cell;
  }

  place(color, cell, why) {
    if (cell < 0) return;
    if (this.board[cell] !== EMPTY) throw new Error(`${label(this.cols, cell)} is taken`);
    this.board[cell] = color;
    this.history.push({ color, cell, why });
  }

  live() { return this.placements.filter((p) => p.every((i) => this.board[i] !== WHITE)); }

  // Black plays `cell`; returns White's answer (-1 if the board is full) after playing it.
  black(cell) {
    if (this.won) throw new Error('game over');
    this.place(BLACK, cell, null);
    const won = this.placements.find((p) => p.includes(cell) && p.every((i) => this.board[i] === BLACK));
    if (won) {
      this.won = 'black';
      this.winCells = won;
      return -1;
    }
    const { cell: w, why } = this.answer(cell);
    this.place(WHITE, w, why);
    if (this.live().length === 0 || !this.board.includes(EMPTY)) this.won = 'white';
    return w;
  }

  answer(a) {
    if (this.unknown) return { cell: this.extra(), why: 'guess' };
    let c = this.f[a];
    const n = getNode(this.cert, this.node);
    if (n.pave) {
      const x = n.pave.get(c);
      if (x === undefined) return { cell: this.extra(), why: 'unpaired' };
      const w = this.finv[x];
      return this.board[w] === EMPTY ? { cell: w, why: 'pair' } : { cell: this.extra(), why: 'taken' };
    }
    let hit = n.moves.get(c);
    let why = 'tree';
    if (!hit) {
      if (!this.relevant(c)) return { cell: this.extra(), why: 'irrelevant' };   // R2
      const g = this.cover(c, n.moves);                                          // R3
      if (!g) throw new Error(`certificate has no answer to Black ${label(this.cols, a)}`);
      this.f = this.f.map((v) => g[v]);
      this.finv = invert(this.f);
      c = g[c];
      hit = n.moves.get(c);
      why = 'symmetry';
    }
    this.vb.add(c);
    if (hit.w !== null) this.vw.add(hit.w);
    this.node = hit.child;
    if (hit.w === null) return { cell: this.extra(), why: 'pass' };
    const w = this.finv[hit.w];
    return this.board[w] === EMPTY ? { cell: w, why } : { cell: this.extra(), why: 'taken' };
  }

  // The checker's position at this node: its live Snakys, their union U, and Black's stones on U.
  normal() {
    const live = this.placements.filter((p) => p.every((i) => !this.vw.has(i)));
    const U = new Set(live.flat());
    return { U, Bn: new Set([...this.vb].filter((i) => U.has(i))) };
  }

  relevant(c) { return !this.vb.has(c) && !this.vw.has(c) && this.normal().U.has(c); }

  cover(c, moves) {
    const { U, Bn } = this.normal();
    const fixes = (g, S) => [...S].every((i) => S.has(g[i]));
    return this.syms.find((g) => moves.has(g[c]) && fixes(g, U) && fixes(g, Bn)) || null;
  }

  // An extra White stone: the free cell in the most live Snakys (lowest index on ties).
  extra() {
    const count = new Int16Array(this.board.length);
    for (const p of this.live()) for (const i of p) count[i]++;
    let best = -1;
    this.board.forEach((v, i) => { if (v === EMPTY && (best < 0 || count[i] > count[best])) best = i; });
    return best;
  }

  // Black hints, one per empty cell: {cell, kind, value}.  kind 'value': after Black plays there,
  // White's tree can still need `value` more Black moves before a pairing.  'dead': the cell is in
  // no Snaky that can still fit.  'win': Black completes a Snaky there (only off the proof).
  // 'unknown': off the proof, nothing is known.
  hints() {
    const live = this.live();
    const inLive = new Set(live.flat());
    const wins = new Set();
    for (const p of live) {
      const empty = p.filter((i) => this.board[i] === EMPTY);
      if (empty.length === 1) wins.add(empty[0]);
    }
    const n = this.cert && !this.unknown ? getNode(this.cert, this.node) : null;
    const out = [];
    this.board.forEach((v, a) => {
      if (v !== EMPTY) return;
      if (wins.has(a)) out.push({ cell: a, kind: 'win' });
      else if (!inLive.has(a)) out.push({ cell: a, kind: 'dead' });
      else if (!n) out.push({ cell: a, kind: 'unknown' });
      else if (n.pave) out.push({ cell: a, kind: 'value', value: 0 });
      else {
        const c = this.f[a];
        let hit = n.moves.get(c);
        if (!hit) {
          if (!this.relevant(c)) { out.push({ cell: a, kind: 'dead' }); return; }
          const g = this.cover(c, n.moves);
          if (!g) throw new Error(`certificate has no answer to Black ${label(this.cols, a)}`);
          hit = n.moves.get(g[c]);
        }
        out.push({ cell: a, kind: 'value', value: height(this.cert, hit.child) });
      }
    });
    return out;
  }

  // What the certificate holds at this moment, on the board: a pairing (pairs with both cells
  // still empty) or a tree node and how many Black moves it answers directly.
  view() {
    if (!this.cert || this.unknown || this.won) return null;
    const n = getNode(this.cert, this.node);
    if (n.pave) {
      const pairs = [];
      for (const [a, b] of n.pave) {
        if (a > b) continue;
        const u = this.finv[a], v = this.finv[b];
        if (this.board[u] === EMPTY && this.board[v] === EMPTY) pairs.push([u, v]);
      }
      return { kind: 'pave', pairs };
    }
    return { kind: 'moves', answers: [...n.moves.keys()].map((c) => this.finv[c]) };
  }
}
