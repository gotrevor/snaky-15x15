import { label, parseLabel, BLACK, EMPTY } from './engine.js';
import { parseCert, repOf, Play } from './nine.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const svg = $('board');
const N = 9;
const DATA = '9x9/';

let snap = null;           // progress.json
let byRep = new Map();     // rep cell -> move record
let classOf = [];          // cell -> rep cell
let mode = 'progress';
let selected = -1;         // rep cell shown in the detail box
let play = null;
let blacks = [];           // Black's moves in the current game, for take-back
const certs = new Map();   // rep cell -> Promise<cert>

function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Row 1 at the bottom, coordinates in a margin on the left and bottom (as on the 15 x 15 page).
const M = 0.8;
const xy = (cell) => [cell % N, Math.floor(cell / N)];
const sx = (x) => x;
const sy = (y) => N - 1 - y;
const centre = (cell) => { const [x, y] = xy(cell); return [sx(x) + 0.5, sy(y) + 0.5]; };

const fmtH = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
const num = (n) => n.toLocaleString('en-US');

function statusOf(rec) {
  if (!rec) return 'open';
  if (rec.status === 'proved') return 'proved';
  return rec.running ? 'running' : 'open';
}

function depthText(rec) {
  if (rec.status === 'proved') return String(rec.depth);
  const next = rec.running && rec.running.depth ? rec.running.depth : (rec.exhausted || 0) + 1;
  return `≥${next}`;
}

async function loadSnapshot() {
  try {
    const r = await fetch(DATA + 'progress.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.statusText);
    snap = await r.json();
  } catch (e) {
    $('summary').textContent = 'No snapshot is published yet.';
    return;
  }
  const reps = snap.moves.map((m) => parseLabel(N, m.cell));
  byRep = new Map(snap.moves.map((m) => [parseLabel(N, m.cell), m]));
  classOf = Array.from({ length: N * N }, (_, c) => repOf(N, N, c, reps).rep);
  renderSummary();
  render();
}

function classSize(rep) { return classOf.filter((r) => r === rep).length; }

function renderSummary() {
  const moves = snap.moves;
  const proved = moves.filter((m) => m.status === 'proved');
  const running = moves.filter((m) => m.running);
  const cpu = moves.reduce((s, m) => s + m.cpu_seconds, 0);
  $('summary').innerHTML = `<b>${proved.length} of ${moves.length}</b> first moves proved`;
  const bar = $('bar');
  bar.replaceChildren();
  for (const m of [...proved, ...moves.filter((m) => m.status !== 'proved')]) {
    const s = document.createElement('span');
    s.className = `seg seg-${statusOf(m)}`;
    s.title = m.cell;
    bar.appendChild(s);
  }
  const when = new Date(snap.generated);
  $('stamp').textContent = `Snapshot ${when.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` +
    ` · ${running.length} searches running · ${fmtH(cpu)} of search so far`;
}

function renderDetail() {
  const box = $('detail');
  const rec = byRep.get(selected);
  if (!rec) { box.replaceChildren(); return; }
  const k = classSize(selected);
  const same = k === 1 ? 'the centre, its own class' : `${k} cells by symmetry`;
  const lines = [`<h3>${rec.cell} <span class="sub">${same}</span></h3>`];
  if (rec.status === 'proved') {
    lines.push(`<p><b>Proved.</b>  White answers ${rec.reply}; depth ${rec.depth}, found in ${fmtH(rec.seconds)}.` +
      `  Certificate: ${num(rec.nodes)} nodes, checker: <code>${rec.check}</code>.</p>`);
    lines.push(`<p><button id="play-this">Play Black from ${rec.cell}</button></p>`);
  } else {
    const ex = rec.exhausted ? `Searched to depth ${rec.exhausted} with no proof yet.` : 'Not searched yet.';
    const run = rec.running ? `  Running now at depth ${rec.running.depth || '?'} (this run ${fmtH(rec.running.elapsed)}).` : '';
    lines.push(`<p><b>Open.</b>  ${ex}${run}  ${fmtH(rec.cpu_seconds)} of search finished so far.</p>`);
  }
  lines.push(chart(rec));
  box.innerHTML = lines.join('');
  const b = $('play-this');
  if (b) b.addEventListener('click', () => { setMode('play'); newGame([selected]); });
}

// One bar per depth searched: time spent (log scale), green where the proof was found.
function chart(rec) {
  const att = rec.attempts;
  if (!att.length) return '';
  const byDepth = new Map();
  for (const a of att) {
    const cur = byDepth.get(a.depth);
    if (!cur || a.proved || a.seconds > cur.seconds) byDepth.set(a.depth, a);
  }
  const ds = [...byDepth.keys()].sort((a, b) => a - b);
  if (rec.running && rec.running.depth && !byDepth.has(rec.running.depth)) ds.push(rec.running.depth);
  const max = Math.log10(Math.max(...att.map((a) => a.seconds), rec.running ? rec.running.elapsed : 1, 10));
  const W = 18, H = 70;
  let s = `<svg class="chart" viewBox="0 0 ${ds.length * W + 4} ${H + 16}" role="img" aria-label="time per depth">`;
  ds.forEach((d, i) => {
    const a = byDepth.get(d);
    const secs = a ? a.seconds : rec.running.elapsed;
    const h = Math.max(2, (Math.log10(Math.max(secs, 1)) / max) * H);
    const cls = a ? (a.proved ? 'bar-proved' : 'bar-fail') : 'bar-running';
    s += `<rect class="${cls}" x="${i * W + 3}" y="${H - h}" width="${W - 5}" height="${h}"><title>depth ${d}: ` +
      `${a ? (a.proved ? 'proved' : 'no proof') : 'running'}, ${fmtH(secs)}</title></rect>`;
    s += `<text x="${i * W + W / 2 + 0.5}" y="${H + 12}">${d}</text>`;
  });
  return `${s}</svg><p class="help">Time per depth (log scale); grey: no proof, green: proved, dashed: running.</p>`;
}

function render() {
  svg.setAttribute('viewBox', `${-M} 0 ${N + M} ${N + M}`);
  svg.replaceChildren();
  if (mode === 'progress') drawProgress(); else drawPlay();
}

function drawGrid(onCell) {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const cell = y * N + x;
      const r = el('rect', { x: sx(x), y: sy(y), width: 1, height: 1, class: 'cell' }, svg);
      r.appendChild(document.createElementNS(NS, 'title')).textContent = label(N, cell);
      onCell(cell, r);
    }
  }
  for (let x = 0; x < N; x++) el('text', { x: sx(x) + 0.5, y: N + M / 2, class: 'coord' }, svg).textContent = String.fromCharCode(97 + x);
  for (let y = 0; y < N; y++) el('text', { x: -M / 2, y: sy(y) + 0.5, class: 'coord' }, svg).textContent = String(y + 1);
}

function drawProgress() {
  if (!snap) { drawGrid(() => {}); return; }
  drawGrid((cell, r) => {
    const rep = classOf[cell];
    const rec = byRep.get(rep);
    r.classList.add(`st-${statusOf(rec)}`, 'playable');
    if (rep === selected) r.classList.add('sel');
    r.addEventListener('click', () => { selected = rep; renderDetail(); render(); });
    const [cx, cy] = centre(cell);
    if (rep === cell) {
      el('text', { x: cx, y: cy - 0.17, class: 'rep-label' }, svg).textContent = rec.cell;
      el('text', { x: cx, y: cy + 0.2, class: 'rep-depth' }, svg).textContent = depthText(rec);
    } else {
      el('text', { x: cx, y: cy, class: 'echo' }, svg).textContent = rec.cell;
    }
  });
}

// ---- play Black ---------------------------------------------------------------------------

function certFor(rep) {
  if (!certs.has(rep)) {
    const rec = byRep.get(rep);
    certs.set(rep, fetch(DATA + rec.cert).then((r) => {
      if (!r.ok) throw new Error(`could not load ${rec.cert}`);
      return r.text();
    }).then(parseCert));
  }
  return certs.get(rep);
}

let busy = false;

async function newGame(moves = []) {
  play = null;
  blacks = [];
  setStatus('Your move: you are Black.  Pick a first move; the green ones are proved.', '');
  for (const m of moves) {
    if (!(await blackMove(m, false))) break;
  }
  render();
}

// Plays Black's move and White's answer.  Returns false if the move was refused.
async function blackMove(cell, draw = true) {
  if (busy) return false;
  if (!play) {
    const rep = classOf[cell];
    const rec = byRep.get(rep);
    if (rec.status !== 'proved') {
      setStatus(`${label(N, cell)} is still open, so there is no proof to play yet.`,
        rec.exhausted ? `The search has reached depth ${rec.exhausted} without one.` : '');
      return false;
    }
    busy = true;
    setStatus(`Loading White's proof for ${rec.cell} (${num(rec.nodes)} nodes)…`, '');
    let cert;
    try { cert = await certFor(rep); } catch (e) { setStatus(String(e.message), ''); busy = false; return false; }
    busy = false;
    const { g } = repOf(N, N, cell, [rep]);
    play = new Play(N, N);
    play.firstMove(cell, cert, g);
    blacks = [cell];
  } else {
    if (play.won || play.board[cell] !== EMPTY) return false;
    play.black(cell);
    blacks.push(cell);
  }
  describe();
  if (draw) render();
  return true;
}

const WHY = {
  tree: 'from its tree',
  symmetry: 'from its tree, through a symmetry of the position',
  pair: 'the partner of your move in its pairing',
  pass: 'anywhere: its tree passes here, so this stone is a bonus',
  irrelevant: 'anywhere: your move is in no Snaky that can still fit',
  unpaired: 'anywhere: your move is in no pair, so it threatens nothing',
  taken: 'anywhere: the cell its proof names is already taken',
};

function describe() {
  const live = play.live().length;
  const last = play.history.at(-1);
  if (play.won === 'white') {
    setStatus('White wins: no Snaky fits anywhere now.', `White's last move ${label(N, last.cell)}.`);
    return;
  }
  if (play.won === 'black') {   // only if a published certificate were wrong
    setStatus('Black made a Snaky: this certificate is wrong.  Please report it.', '');
    return;
  }
  setStatus(`Your move.  ${live} Snaky placement${live === 1 ? '' : 's'} still open to you.`,
    `White played ${label(N, last.cell)}, ${WHY[last.why] || last.why}.`);
}

function setStatus(a, b) { $('status').textContent = a; $('why').textContent = b; }

function drawPlay() {
  const proved = (cell) => snap && byRep.get(classOf[cell]).status === 'proved';
  drawGrid((cell, r) => {
    if (!play) {
      r.classList.add(proved(cell) ? 'st-proved' : 'st-open', 'playable');
      r.addEventListener('click', () => blackMove(cell));
    } else if (!play.won && play.board[cell] === EMPTY) {
      r.classList.add('playable');
      r.addEventListener('click', () => blackMove(cell));
    }
  });
  if (!play) return;
  const view = play.view();
  if (view && view.kind === 'pave' && $('pairs').checked) {
    const g = el('g', { 'pointer-events': 'none' }, svg);
    for (const [a, b] of view.pairs) {
      const [x1, y1] = centre(a), [x2, y2] = centre(b);
      el('line', { x1, y1, x2, y2, class: 'pair' }, g);
      for (const [cx, cy] of [[x1, y1], [x2, y2]]) el('circle', { cx, cy, r: 0.11, class: 'pair-end' }, g);
    }
  }
  play.board.forEach((v, cell) => {
    if (v === EMPTY) return;
    const [cx, cy] = centre(cell);
    el('circle', { cx, cy, r: 0.42, class: v === BLACK ? 'stone-b' : 'stone-w', 'pointer-events': 'none' }, svg);
  });
  const last = play.history.at(-1);
  if (last) {
    const [cx, cy] = centre(last.cell);
    el('circle', { cx, cy, r: 0.18, class: 'last', 'pointer-events': 'none' }, svg);
  }
  const list = $('moves');
  list.replaceChildren();
  for (let i = 0; i < play.history.length; i += 2) {
    const li = document.createElement('li');
    const w = play.history[i + 1];
    li.textContent = `${label(N, play.history[i].cell)}  ${w ? label(N, w.cell) : ''}`;
    list.appendChild(li);
  }
  list.scrollTop = list.scrollHeight;
}

function setMode(m) {
  mode = m;
  $('tab-progress').setAttribute('aria-selected', String(m === 'progress'));
  $('tab-play').setAttribute('aria-selected', String(m === 'play'));
  $('progress-panel').hidden = m !== 'progress';
  $('play-panel').hidden = m !== 'play';
  if (m === 'play' && !play) setStatus('Your move: you are Black.  Pick a first move; the green ones are proved.', '');
  render();
}

$('tab-progress').addEventListener('click', () => setMode('progress'));
$('tab-play').addEventListener('click', () => setMode('play'));
$('new').addEventListener('click', () => newGame());
$('undo').addEventListener('click', () => newGame(blacks.slice(0, -1)));
$('pairs').addEventListener('change', render);

// Deep links: #play=c3,e4 starts a game with those Black moves; #c3 selects a first move.
async function fromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('play')) {
    setMode('play');
    const ms = h.slice(5).split(',').map((s) => parseLabel(N, s)).filter((c) => c >= 0 && c < N * N);
    await newGame(ms);
  } else if (h) {
    const c = parseLabel(N, h);
    if (c >= 0 && c < N * N && classOf.length) { selected = classOf[c]; renderDetail(); render(); }
  }
}

loadSnapshot().then(fromHash);
