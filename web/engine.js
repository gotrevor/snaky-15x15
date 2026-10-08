// Black's strategy for 15 x 15 Snaky, read straight off the card set that the Lean theorem
// `Snaky.snaky_wins_15x15` checks (cert/snaky-15x15-cards.txt, format in tools/cards2txt.py).
// No search: Black holds one card (A, S, p, h) placed on the board by a map G, plays G(p), and
// follows the card's hint for White's reply (or its pass hint if White moved outside G(S)).
// The invariant from lean/Snaky/CardsSound.lean is asserted at every Black move: Black owns
// G(A) and White owns nothing in G(S).  Pure module, no DOM: the page and the tests share it.

export const ORIENT = [[1, 0, 0, 1], [-1, 0, 0, 1], [0, -1, 1, 0], [0, 1, 1, 0],
  [-1, 0, 0, -1], [1, 0, 0, -1], [0, 1, -1, 0], [0, -1, -1, 0]];

export const SNAKY = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [4, 1]];

const key = (x, y) => (x + 512) * 1024 + (y + 512);

function xfOf(k, dx, dy) {
  const m = ORIENT[k];
  if (!m) throw new Error(`bad orientation index ${k}`);
  return { a: m[0], b: m[1], c: m[2], d: m[3], dx, dy };
}

export const app = (g, [x, y]) => [g.a * x + g.b * y + g.dx, g.c * x + g.d * y + g.dy];

// The orientation matrices are orthogonal, so the inverse is the transpose.
export const unapp = (g, [x, y]) => {
  const u = x - g.dx, v = y - g.dy;
  return [g.a * u + g.c * v, g.b * u + g.d * v];
};

// (comp g h) applies h, then g.  Same as Xf.comp in lean/Snaky/Cards.lean.
export const comp = (g, h) => ({
  a: g.a * h.a + g.b * h.c, b: g.a * h.b + g.b * h.d,
  c: g.c * h.a + g.d * h.c, d: g.c * h.b + g.d * h.d,
  dx: g.a * h.dx + g.b * h.dy + g.dx, dy: g.c * h.dx + g.d * h.dy + g.dy,
});

export function parseCards(text) {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const head = lines[0].trim().split(/\s+/);
  if (head[0] !== 'snaky-cards-txt-v1') throw new Error('not a snaky-cards-txt-v1 file');
  const [rows, cols, root, k, dx, dy] = head.slice(1).map(Number);
  return { rows, cols, root, rootXf: xfOf(k, dx, dy), lines: lines.slice(1), cache: new Map() };
}

export function getCard(cs, j) {
  let c = cs.cache.get(j);
  if (c) return c;
  const line = cs.lines[j];
  if (line === undefined) throw new Error(`no card ${j}`);
  const t = line.trim().split(/\s+/).map(Number);
  let i = 0;
  const next = () => t[i++];
  const pts = () => {
    const n = next(), out = [];
    for (let q = 0; q < n; q++) out.push([next(), next()]);
    return out;
  };
  const hint = (j2) => ({ j: j2, g: xfOf(next(), next(), next()) });
  const h = next();
  const p = [next(), next()];
  const A = pts();
  const S = pts();
  const pj = next();
  const pass = pj < 0 ? null : hint(pj);
  const replies = new Map();
  const nr = next();
  for (let q = 0; q < nr; q++) {
    const w = key(next(), next());
    replies.set(w, hint(next()));
  }
  c = { h, p, A, S, Sset: new Set(S.map(([x, y]) => key(x, y))), pass, replies };
  cs.cache.set(j, c);
  return c;
}

function orientations(shape) {
  const forms = [], seen = new Set();
  for (const m of ORIENT) {
    const q = shape.map(([x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y]);
    const mx = Math.min(...q.map((p) => p[0])), my = Math.min(...q.map((p) => p[1]));
    const norm = q.map(([x, y]) => [x - mx, y - my]).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
    const s = JSON.stringify(norm);
    if (!seen.has(s)) { seen.add(s); forms.push(norm); }
  }
  return forms;
}

// Every placement of Snaky on the board, as arrays of cell indices (cell = y * cols + x).
export function placements(rows, cols, shape = SNAKY) {
  const out = [];
  for (const f of orientations(shape)) {
    for (let y0 = 0; y0 < rows; y0++) {
      for (let x0 = 0; x0 < cols; x0++) {
        const cells = f.map(([x, y]) => [x0 + x, y0 + y]);
        if (cells.every(([x, y]) => x < cols && y < rows)) out.push(cells.map(([x, y]) => y * cols + x));
      }
    }
  }
  return out;
}

export const EMPTY = 0, BLACK = 1, WHITE = 2;

export class Game {
  constructor(cs) {
    this.cs = cs;
    this.rows = cs.rows;
    this.cols = cs.cols;
    this.placements = placements(cs.rows, cs.cols);
    this.byCell = Array.from({ length: cs.rows * cs.cols }, () => []);
    for (const p of this.placements) for (const c of p) this.byCell[c].push(p);
    this.board = new Int8Array(cs.rows * cs.cols);
    this.k = cs.root;            // current card index
    this.G = cs.rootXf;          // its placement on the board
    this.history = [];           // [{color, cell}]
    this.won = null;             // the winning placement's cells, once Black has one
    this.offCard = 0;            // Black moves where G(p) was already Black's (any free cell)
    this.shortcuts = 0;          // Black moves that took an immediate win instead of G(p)
    this.blackMove();
  }

  cell([x, y]) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return -1;
    return y * this.cols + x;
  }

  xy(cell) { return [cell % this.cols, Math.floor(cell / this.cols)]; }

  card() { return getCard(this.cs, this.k); }

  // Black's remaining moves are at most this (the card height), counting the one about to be played.
  bound() { return this.card().h; }

  // Cards the current card relies on, on the board: G(A) (Black's), G(p), and G(S) (White-free).
  view() {
    const c = this.card();
    const on = (pts) => pts.map((q) => this.cell(app(this.G, q))).filter((i) => i >= 0);
    return { A: on(c.A), p: this.cell(app(this.G, c.p)), S: on(c.S), h: c.h };
  }

  checkInvariant() {
    const c = this.card();
    for (const q of c.A) {
      const i = this.cell(app(this.G, q));
      if (i < 0 || this.board[i] !== BLACK) throw new Error(`invariant: G(A) cell ${q} is not Black's`);
    }
    for (const q of c.S) {
      const i = this.cell(app(this.G, q));
      if (i < 0) throw new Error(`invariant: G(S) cell ${q} is off the board`);
      if (this.board[i] === WHITE) throw new Error(`invariant: White owns G(S) cell ${q}`);
    }
  }

  winningPlacement(cell) {
    for (const p of this.byCell[cell]) if (p.every((i) => this.board[i] === BLACK)) return p;
    return null;
  }

  blackMove() {
    this.checkInvariant();
    const c = this.card();
    let cell = this.cell(app(this.G, c.p));
    const win = this.threats();
    if (win.length) {
      // An immediate win ends the game, so it needs no card; the cards don't always take one.
      cell = win[0];
      this.shortcuts++;
    } else if (this.board[cell] !== EMPTY) {
      // G(p) is already Black's (White cannot own it: p is in S).  An extra Black stone never hurts.
      if (this.board[cell] !== BLACK) throw new Error('invariant: G(p) is White\'s');
      cell = this.board.indexOf(EMPTY);
      if (cell < 0) throw new Error('board full');
      this.offCard++;
    }
    this.board[cell] = BLACK;
    this.history.push({ color: BLACK, cell });
    this.won = this.winningPlacement(cell);
    return cell;
  }

  // The hint the current card gives for a White move at `cell`: its reply hint inside G(S), else
  // the pass hint.
  hintFor(cell) {
    const c = this.card();
    const [x, y] = unapp(this.G, this.xy(cell));
    if (c.Sset.has(key(x, y))) {
      const hint = c.replies.get(key(x, y));
      if (!hint) throw new Error(`card ${this.k} has no reply for White at ${[x, y]}`);
      return hint;
    }
    if (!c.pass) throw new Error(`card ${this.k} has no pass hint`);
    return c.pass;
  }

  // White hints: for every empty cell, the most Black moves the strategy can still need after
  // White plays there - the next card's height, which equals the longest line through the card
  // graph (a test checks this for every card), or 1 if the move leaves Black an immediate win.  `zone` marks cells in G(S); the rest all take
  // the pass hint, so they share one value.
  whiteValues() {
    const c = this.card();
    const threats = this.threats();
    const out = [];
    this.board.forEach((v, cell) => {
      if (v !== EMPTY) return;
      const [x, y] = unapp(this.G, this.xy(cell));
      // Unless White blocks Black's only threat, Black wins on its next move.
      const blocks = threats.length === 0 || (threats.length === 1 && threats[0] === cell);
      const value = blocks ? getCard(this.cs, this.hintFor(cell).j).h : 1;
      out.push({ cell, value, zone: c.Sset.has(key(x, y)) });
    });
    return out;
  }

  // Empty cells where Black would complete a Snaky by playing next: one is a forced move for
  // White, two or more are a forced loss.  A board fact, independent of the cards.
  threats() {
    const out = [];
    this.board.forEach((v, c) => {
      if (v === EMPTY && this.byCell[c].some((p) => p.every((i) => i === c || this.board[i] === BLACK))) out.push(c);
    });
    return out;
  }

  // Where Black would answer a White move at the empty `cell`, without playing it (-1 if the
  // answer would be "any free cell").
  answerTo(cell) {
    if (this.won || this.board[cell] !== EMPTY) return -1;
    const win = this.threats().filter((t) => t !== cell);
    if (win.length) return win[0];
    const hint = this.hintFor(cell);
    const i = this.cell(app(comp(this.G, hint.g), getCard(this.cs, hint.j).p));
    return i !== cell && this.board[i] === EMPTY ? i : -1;
  }

  whiteMove(cell) {
    if (this.won) throw new Error('game over');
    if (!(cell >= 0 && cell < this.board.length) || this.board[cell] !== EMPTY) throw new Error('occupied');
    const c = this.card();
    const hint = this.hintFor(cell);
    this.board[cell] = WHITE;
    this.history.push({ color: WHITE, cell });
    if (!(getCard(this.cs, hint.j).h < c.h)) throw new Error('hint height does not drop');
    this.k = hint.j;
    this.G = comp(this.G, hint.g);
    return this.blackMove();
  }
}

// Coordinates: columns a..o left to right, rows 1..15 bottom to top (cell = y * cols + x, y = 0 at the bottom).
export const label = (cols, cell) => String.fromCharCode(97 + (cell % cols)) + (Math.floor(cell / cols) + 1);

export function parseLabel(cols, s) {
  const m = /^([a-z])(\d+)$/.exec(s.trim().toLowerCase());
  if (!m) return -1;
  return (Number(m[2]) - 1) * cols + (m[1].charCodeAt(0) - 97);
}

// White's move line with take-back and replay: back() moves the last White move onto a redo
// stack, forward() replays it, and a fresh move ends the replay line unless it is the very
// move forward() would have replayed.
export class Line {
  constructor(whites = []) { this.whites = [...whites]; this.redo = []; }
  back() {
    if (!this.whites.length) return false;
    this.redo.push(this.whites.pop());
    return true;
  }
  forward() {
    if (!this.redo.length) return false;
    this.whites.push(this.redo.pop());
    return true;
  }
  play(cell) {
    if (this.redo.at(-1) === cell) this.redo.pop();
    else this.redo = [];
    this.whites.push(cell);
  }
}

// Which hint values get a disc (both pages).  Higher value = better move.  The best value always
// does, and so does every value better than the most common one (ties: the lower value counts as
// most common); the most common value and everything worse stay unmarked - the worst moves,
// usually most of the board.  When every move scores the same, every move is a best move and
// all are marked.  hiddenLoss is the smallest loss among unmarked cells, or null if none is.
export function hintMarks(values) {
  const best = Math.max(...values);
  const count = new Map();
  for (const v of values) count.set(v, (count.get(v) || 0) + 1);
  const common = [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  const show = (v) => v === best || v > common;
  const hidden = values.filter((v) => !show(v));
  return { best, show, hiddenLoss: hidden.length ? best - Math.max(...hidden) : null,
    uniform: values.every((v) => v === best) };
}
