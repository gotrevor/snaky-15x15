import { parseCards, Game, Line, label, parseLabel, hintMarks, SNAKY, BLACK, WHITE, EMPTY } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const svg = $('board');

let cs = null;
let game = null;
let hover = -1;
let line = new Line();  // White's moves, plus what ← took back for → to replay

function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Board geometry: cell (x, y) is the unit square at column x, row (rows - 1 - y), so row 1 is at
// the bottom.  Coordinates sit in a margin on the left and bottom.
const M = 0.8;
const sx = (x) => x;
const sy = (y) => game.rows - 1 - y;
const centre = (cell) => { const [x, y] = game.xy(cell); return [sx(x) + 0.5, sy(y) + 0.5]; };

function whiteMoves() {
  return game.history.filter((m) => m.color === WHITE).map((m) => m.cell);
}

function newGame(whites = []) {
  game = new Game(cs);
  for (const w of whites) {
    if (game.won || game.board[w] !== EMPTY) break;
    game.whiteMove(w);
  }
  hover = -1;
  render();
}

// The six winning cells in path order (Snaky is a path), for drawing the snake.
function snakePath(cells) {
  const set = new Set(cells);
  const nbrs = (c) => cells.filter((d) => {
    const [x, y] = game.xy(c), [u, v] = game.xy(d);
    return Math.abs(x - u) + Math.abs(y - v) === 1;
  });
  let cur = cells.find((c) => nbrs(c).length === 1);
  const out = [cur];
  set.delete(cur);
  while (set.size) {
    cur = nbrs(cur).find((d) => set.has(d));
    out.push(cur);
    set.delete(cur);
  }
  return out;
}

function render() {
  const { rows, cols } = game;
  svg.setAttribute('viewBox', `${-M} 0 ${cols + M} ${rows + M}`);
  svg.replaceChildren();
  const showView = $('view').checked && !game.won;
  const view = showView ? game.view() : null;
  const zone = new Set(view ? view.S : []);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = y * cols + x;
      const r = el('rect', { x: sx(x), y: sy(y), width: 1, height: 1, class: 'cell' }, svg);
      if (!game.won && game.board[cell] === EMPTY) {
        r.classList.add('playable');
        r.addEventListener('click', () => play(cell));
        r.addEventListener('mouseenter', () => { hover = cell; drawHover(); });
      }
      r.appendChild(document.createElementNS(NS, 'title')).textContent = label(cols, cell);
      if (zone.has(cell)) el('rect', { x: sx(x), y: sy(y), width: 1, height: 1, class: 'zone' }, svg);
    }
  }
  for (let x = 0; x < cols; x++) {
    el('text', { x: sx(x) + 0.5, y: rows + M / 2, class: 'coord' }, svg).textContent = String.fromCharCode(97 + x);
  }
  for (let y = 0; y < rows; y++) {
    el('text', { x: -M / 2, y: sy(y) + 0.5, class: 'coord' }, svg).textContent = String(y + 1);
  }

  game.board.forEach((v, cell) => {
    if (v === EMPTY) return;
    const [cx, cy] = centre(cell);
    el('circle', { cx, cy, r: 0.42, class: v === BLACK ? 'stone-b' : 'stone-w', 'pointer-events': 'none' }, svg);
  });

  if (view) {
    for (const cell of [...view.A, view.p]) {
      const [cx, cy] = centre(cell);
      el('circle', { cx, cy, r: 0.3, class: 'ring-a' }, svg);
    }
  }
  if ($('hints').checked && !game.won) drawHints();
  hoverLayer = el('g', { 'pointer-events': 'none' }, svg);
  drawHover();

  const last = game.history[game.history.length - 1];
  if (last && !game.won) {
    const [cx, cy] = centre(last.cell);
    el('circle', { cx, cy, r: 0.18, class: 'last', 'pointer-events': 'none' }, svg);
  }

  if (game.won) {
    for (const cell of game.won) {
      const [x, y] = game.xy(cell);
      el('rect', { x: sx(x) + 0.07, y: sy(y) + 0.07, width: 0.86, height: 0.86, rx: 0.12, class: 'win-cell' }, svg);
    }
    const pts = snakePath(game.won).map((c) => centre(c).join(',')).join(' ');
    el('polyline', { points: pts, class: 'win-path' }, svg);
  }

  renderPanel();
}

let hoverLayer = null;

// White hints, drawn like ninepaths' candidates: a White disc ringed green / amber / red, the big
// number the moves it gives up against White's best, the small one the most Black moves the
// strategy can still need.  Most cells share one value (everything outside the card's region
// gets the pass answer, and the opening card's region is nearly the whole board), so cells with
// the best value always get a disc, and so does every value better than the most common one; the
// most common value and everything worse stay unmarked (hintMarks in engine.js).  Black's
// threats override: one is a forced move ("!"), two or more a forced loss ("✕" on each).
const lossClass = (loss) => (loss === 0 ? 'good' : loss < 3 ? 'hot' : 'bad');

function hintSummary() {
  const vals = game.whiteValues();
  const best = Math.max(...vals.map((v) => v.value));
  return { vals, best, marks: hintMarks(vals.map((v) => v.value)) };
}

function drawHints() {
  const { vals, best, marks } = hintSummary();
  const threats = game.threats();
  const g = el('g', { 'pointer-events': 'none' }, svg);
  if (threats.length >= 2) {
    for (const cell of threats) {
      const [cx, cy] = centre(cell);
      el('text', { x: cx, y: cy, class: 'hint-lost' }, g).textContent = '✕';
    }
    return;
  }
  for (const { cell, value } of vals) {
    const loss = best - value;
    const [cx, cy] = centre(cell);
    if (threats[0] === cell) {
      el('circle', { cx, cy, r: 0.42, class: 'hint-disc hint-forced' }, g);
      el('text', { x: cx, y: cy - 0.05, class: 'hint-loss hint-forced-mark' }, g).textContent = '!';
      el('text', { x: cx, y: cy + 0.25, class: 'hint-left' }, g).textContent = String(value);
      continue;
    }
    if (!marks.show(value)) continue;
    el('circle', { cx, cy, r: 0.42, class: `hint-disc hint-${lossClass(loss)}` }, g);
    el('text', { x: cx, y: cy - 0.05, class: 'hint-loss' }, g).textContent = String(loss);
    el('text', { x: cx, y: cy + 0.25, class: 'hint-left' }, g).textContent = String(value);
  }
}

// Black's answer to the cell under the pointer (proof's view only); redraws one layer, not the board.
function drawHover() {
  if (!hoverLayer) return;
  hoverLayer.replaceChildren();
  if (!$('view').checked || hover < 0) return;
  const ans = game.answerTo(hover);
  if (ans < 0) return;
  const [cx, cy] = centre(ans);
  el('circle', { cx, cy, r: 0.38, class: 'ring-p' }, hoverLayer);
}

function renderPanel() {
  const nb = game.history.filter((m) => m.color === BLACK).length;
  const status = $('status');
  status.classList.toggle('win', !!game.won);
  const lastBlack = label(game.cols, [...game.history].reverse().find((m) => m.color === BLACK).cell);
  if (game.won) {
    status.textContent = `Black wins with ${lastBlack}: a Snaky in ${nb} moves.`;
    $('bound').textContent = 'The snake is outlined.  Take back a move, or start again.';
  } else {
    status.textContent = `Black played ${lastBlack}.  Your move.`;
    const h = game.bound() - 1;
    $('bound').textContent = `Black's card promises a win within ${h} more move${h === 1 ? '' : 's'}.`;
  }
  $('undo').disabled = whiteMoves().length === 0;
  $('view-help').hidden = !$('view').checked;
  const showHints = $('hints').checked && !game.won;
  $('hints-help').hidden = !showHints;
  if (showHints) {
    const { best, marks } = hintSummary();
    const threats = game.threats().map((c) => label(game.cols, c));
    $('hints-best').textContent = threats.length >= 2
      ? `Lost: Black wins next move at ${threats.join(' or ')} (✕), and you can block only one.`
      : threats.length === 1
        ? `Forced: Black wins at ${threats[0]} next move unless you play there (!).`
        : `Your best moves (green, 0) leave Black needing up to ${best} more.`;
    $('hints-pass').textContent = threats.length >= 2 || marks.hiddenLoss === null ? ''
      : marks.hiddenLoss === best - 1
        ? 'Anywhere else, Black wins next move.'
        : `Every unmarked cell gives up ${marks.hiddenLoss} or more.`;
    $('hints-legend').hidden = threats.length >= 2;
  }

  const ol = $('moves');
  ol.replaceChildren();
  for (let i = 0; i < game.history.length; i += 2) {
    const li = document.createElement('li');
    const b = label(game.cols, game.history[i].cell);
    const w = game.history[i + 1] ? label(game.cols, game.history[i + 1].cell) : '';
    li.textContent = `${b.padEnd(4)} ${w}`;
    ol.appendChild(li);
  }
  ol.scrollTop = ol.scrollHeight;

  const hash = whiteMoves().map((c) => label(game.cols, c)).join('-');
  history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
}

function play(cell) {
  if (game.won || game.board[cell] !== EMPTY) return;
  line.play(cell);
  try {
    game.whiteMove(cell);
  } catch (e) {
    $('status').textContent = `Strategy error: ${e.message}`;
    throw e;
  }
  hover = -1;
  render();
}

function drawShape() {
  const s = $('shape');
  for (const [x, y] of SNAKY) el('rect', { x, y: 1 - y, width: 1, height: 1 }, s);
}

async function main() {
  drawShape();
  const src = document.body.dataset.cards || 'cards.txt';  // 17x17.html plays Sieben's card set
  const resp = await fetch(src);
  if (!resp.ok) throw new Error(`${src}: HTTP ${resp.status}`);
  const text = await resp.text();
  cs = parseCards(text);
  const digest = await crypto.subtle?.digest('SHA-256', new TextEncoder().encode(text));
  if (digest) {
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    $('provenance').textContent = `Card set: ${cs.lines.length} cards, sha256 ${hex}.`;
  }

  const params = new URLSearchParams(location.search);
  if (params.has('view')) $('view').checked = true;
  if (params.has('hints')) $('hints').checked = true;
  const whites = location.hash.slice(1).split('-').filter(Boolean).map((s) => parseLabel(cs.cols, s));
  newGame(whites.every((c) => c >= 0) ? whites : []);
  line = new Line(whiteMoves());

  $('new').addEventListener('click', () => { line = new Line(); newGame(); });
  $('undo').addEventListener('click', () => { if (line.back()) newGame(line.whites); });
  // ← is "Take back", as in ninepaths; → replays what ← took back.
  addEventListener('keydown', (e) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowLeft' && !$('undo').disabled) $('undo').click();
    if (e.key === 'ArrowRight' && line.redo.length) play(line.redo.at(-1));
  });
  $('view').addEventListener('change', render);
  $('hints').addEventListener('change', render);
  svg.addEventListener('mouseleave', () => { hover = -1; drawHover(); });
}

main().catch((e) => { $('status').textContent = `Could not load the strategy: ${e.message}`; });
