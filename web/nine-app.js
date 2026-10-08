import { label, parseLabel, hintMarks, BLACK, EMPTY } from './engine.js';
import { parseCert, repOf, Play, Explorer } from './nine.js';

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
  svg.classList.remove('offproof', 'allbest');
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
let explore = null;        // Explorer on an open first move with a live search report
const reports = new Map(); // rep cell -> Promise<report>

function reportFor(rep) {
  if (!reports.has(rep)) {
    const rec = byRep.get(rep);
    reports.set(rep, fetch(DATA + rec.report, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`could not load ${rec.report}`);
      return r.json();
    }));
  }
  return reports.get(rep);
}

const FIRST = 'Your move: you are Black.  Pick a first move.';

async function newGame(moves = []) {
  play = null;
  explore = null;
  blacks = [];
  setStatus(FIRST, '');
  for (const m of moves) {
    if (!(await blackMove(m, false))) break;
  }
  render();
}

// Plays Black's move and White's answer (exploring a search report: the move of the side to
// move).  Returns false if the move was refused.
async function blackMove(cell, draw = true) {
  if (busy) return false;
  if (explore) {
    if (explore.board[cell] !== EMPTY || explore.winner()) return false;
    explore.place(cell);
    blacks.push(cell);
    describeExplore();
    if (draw) render();
    return true;
  }
  if (!play) {
    const rep = classOf[cell];
    const rec = byRep.get(rep);
    const { g } = repOf(N, N, cell, [rep]);
    if (rec.status !== 'proved' && rec.report) {
      busy = true;
      setStatus(`Loading the live search for ${rec.cell}…`, '');
      let rp;
      try { rp = await reportFor(rep); } catch (e) { setStatus(String(e.message), ''); busy = false; return false; }
      busy = false;
      const usable = (n) => n && Object.keys(n).length;
      const which = $('xpass').value === 'last' && usable(rp.last) ? rp.last : rp.nodes;
      explore = new Explorer(N, N, which);
      explore.report = rp;
      explore.start(cell, g);
      blacks = [cell];
      describeExplore();
      if (draw) render();
      return true;
    }
    play = new Play(N, N);
    if (rec.status !== 'proved') {
      // An unknown path: no proof yet.  White answers the candidate reply, mapped onto this cell.
      const c = rec.candidate ? parseLabel(N, rec.candidate) : -1;
      play.firstMoveUnknown(cell, c >= 0 ? g.indexOf(c) : -1);
    } else {
      busy = true;
      setStatus(`Loading White's proof for ${rec.cell} (${num(rec.nodes)} nodes)…`, '');
      let cert;
      try { cert = await certFor(rep); } catch (e) { setStatus(String(e.message), ''); busy = false; play = null; return false; }
      busy = false;
      play.firstMove(cell, cert, g);
    }
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
  guess: 'a guess (the cell in the most Snakys still open), not a proof',
};

function describe() {
  const live = play.live().length;
  const last = play.history.at(-1);
  const open = `${live} Snaky placement${live === 1 ? '' : 's'} still open to you.`;
  if (play.unknown) {
    const rec = byRep.get(classOf[blacks[0]]);
    if (play.won === 'black') {
      setStatus('Black made a Snaky, but only against White\'s guesses.',
        `That says nothing about the proof: the search may still find White a defence after ${rec.cell}.`);
    } else if (play.won === 'white') {
      setStatus('No Snaky fits any more, but White was guessing.', 'Off the proof, so this line proves nothing.');
    } else if (last.why === 'candidate') {
      const ex = rec.exhausted ? `  The search has gone to depth ${rec.exhausted} without one.` : '';
      setStatus(`Unknown path: no proof covers ${label(N, blacks[0])} yet.${ex}`,
        `White answered ${label(N, last.cell)}, ${rec.candidate_source || 'a guess'}.  From here White guesses, so nothing in this line is proved.`);
    } else {
      setStatus(`Unknown path, your move.  ${open}`, `White played ${label(N, last.cell)}, ${WHY.guess}.`);
    }
    return;
  }
  if (play.won === 'white') {
    setStatus('White wins: no Snaky fits anywhere now.', `White's last move ${label(N, last.cell)}.`);
    return;
  }
  if (play.won === 'black') {   // only if a published certificate were wrong
    setStatus('Black made a Snaky: this certificate is wrong.  Please report it.', '');
    return;
  }
  setStatus(`Your move.  ${open}`, `White played ${label(N, last.cell)}, ${WHY[last.why] || last.why}.`);
}

// No disc for 'pending' (not reached yet): that is most of the board at a fresh node.
const XSYM = { open: '✕', searching: '…', proved: '✓', pave: 'P', skipped: '–' };

function describeExplore() {
  const x = explore, rp = x.report;
  const rec = byRep.get(classOf[blacks[0]]);
  const pass = x.nodes === rp.last ? `last complete pass, depth ${rp.last_iter}` : `depth-${rp.iter} pass, in progress`;
  const when = rp.time ? new Date(rp.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '?';
  if (x.winner()) {
    setStatus('Black made a Snaky in this line.', 'Exploring only: you chose White\'s moves too, so this says nothing about the proof.');
    return;
  }
  setStatus(`Exploring the live search for ${rec.cell}: no proof yet.`,
    `${x.toMove() === BLACK ? 'Black' : 'White'} to move.  Search report ${when} (${pass}).`);
}

function exploreText() {
  const x = explore, r = x.record();
  const last = x.history.at(-1);
  const prev = last ? label(N, last.cell) : '';
  if (!r) return 'Beyond the search\'s report: nothing is recorded for this line yet.  Any move here is an unknown path.';
  if (r.result === 'paved') return `White has a pairing here: this line is settled for White.`;
  if (r.result === 'no depth left') return 'The search ran out of depth here: still open.';
  if (r.result === 'black won') return 'Black has a Snaky here.';
  if (r.result === 'double threat') return `Black has a double threat after ${prev}: this line fails for White at this depth.`;
  const count = (st) => [...x.listed().values()].filter((e) => e.status === st).length;
  if (r.side === 'W') {
    // Names on the board, not in the search's frame (they differ after a mirrored move).
    const board = (c) => label(N, x.finv[parseLabel(N, c)]);
    const list = Object.entries(r.cands || {}).map(([c, st]) => `${board(c)} ${st}`).join(', ');
    return `White to move after ${prev}.  The search tries ${Object.keys(r.cands || {}).length} replies here (${list}).  Tap one to play it for White.${r.forced ? '  (Forced: Black threatens to win.)' : ''}`;
  }
  const parts = ['open', 'searching', 'proved', 'pave', 'pending', 'skipped'].map((st) => [st, count(st)]).filter(([, n]) => n);
  const open = count('open');
  return `Black to move after White ${prev}: ${parts.map(([st, n]) => `${n} ${st}`).join(', ')}.` +
    (open ? `  ✕ marks the open sub-lines: Black moves White's ${prev} has no answer to yet at this depth.` : '') +
    '  Tap a Black move to follow it.';
}

function drawExplore() {
  const x = explore;
  svg.classList.add('offproof');
  svg.classList.remove('allbest');
  drawGrid((cell, r) => {
    if (x.board[cell] === EMPTY && !x.winner()) {
      r.classList.add('playable');
      r.addEventListener('click', () => blackMove(cell));
    }
  });
  x.board.forEach((v, cell) => {
    if (v === EMPTY) return;
    const [cx, cy] = centre(cell);
    el('circle', { cx, cy, r: 0.42, class: v === BLACK ? 'stone-b' : 'stone-w', 'pointer-events': 'none' }, svg);
  });
  const last = x.history.at(-1);
  if (last) {
    const [cx, cy] = centre(last.cell);
    el('circle', { cx, cy, r: 0.18, class: 'last', 'pointer-events': 'none' }, svg);
  }
  if ($('bhints').checked) {
    const g = el('g', { 'pointer-events': 'none' }, svg);
    for (const m of x.marks()) {
      const sym = XSYM[m.status];
      if (!sym) continue;
      const [cx, cy] = centre(m.cell);
      el('circle', { cx, cy, r: 0.42, class: `hint-disc xd-${m.status}` }, g);
      el('text', { x: cx, y: m.reply >= 0 ? cy - 0.06 : cy + 0.02, class: `x-sym xs-${m.status}` }, g).textContent = sym;
      if (m.reply >= 0) el('text', { x: cx, y: cy + 0.25, class: 'hint-left' }, g).textContent = `→${label(N, m.reply)}`;
    }
  }
  $('hint-head').textContent = exploreText();
  $('hints-help').hidden = true;
  $('explore-help').hidden = false;
  const usable = (n) => n && Object.keys(n).length;
  $('xpass-wrap').hidden = !usable(x.report.last);
  const list = $('moves');
  list.replaceChildren();
  for (let i = 0; i < x.history.length; i += 2) {
    const li = document.createElement('li');
    const w = x.history[i + 1];
    li.textContent = `${label(N, x.history[i].cell).padEnd(4)} ${w ? label(N, w.cell) : ''}`;
    list.appendChild(li);
  }
  list.scrollTop = list.scrollHeight;
  if (mode === 'play') history.replaceState(null, '', `#play=${blacks.map((c) => label(N, c)).join(',')}`);
}

function setStatus(a, b) { $('status').textContent = a; $('why').textContent = b; }

// Black hints, as the 15 x 15 page's White hints: a disc ringed green / amber / red, the big
// number the moves given up against Black's best known move, the small one the most Black moves
// White's proof can still need after that move.  Which cells get a disc: hintMarks in engine.js
// (the best always; the most common value and everything worse stay unmarked).
// "?" marks an unknown path (no proof yet), "!" a Black win, a dot a dead cell.
const lossClass = (loss) => (loss === 0 ? 'good' : loss < 3 ? 'hot' : 'bad');

function blackHints() {
  if (!play) {
    return Array.from({ length: N * N }, (_, cell) => {
      const rec = byRep.get(classOf[cell]);
      return rec.status === 'proved' ? { cell, kind: 'value', value: rec.height } : { cell, kind: 'unknown' };
    });
  }
  return play.won ? [] : play.hints();
}

function hintSummary(hints) {
  const vals = hints.filter((h) => h.kind === 'value');
  if (!vals.length) return { best: null, marks: null };
  const marks = hintMarks(vals.map((h) => h.value));
  return { best: marks.best, marks };
}

function drawHints(hints) {
  const { best, marks } = hintSummary(hints);
  const g = el('g', { 'pointer-events': 'none' }, svg);
  for (const h of hints) {
    const [cx, cy] = centre(h.cell);
    if (h.kind === 'dead') {
      el('circle', { cx, cy, r: 0.06, class: 'hint-dead' }, g);
    } else if (h.kind === 'unknown') {
      if (play && play.unknown) continue;   // off the proof every cell is unknown; the board tint says so
      el('circle', { cx, cy, r: 0.42, class: 'hint-disc hint-unknown' }, g);
      el('text', { x: cx, y: cy + 0.02, class: 'hint-loss hint-q' }, g).textContent = '?';
    } else if (h.kind === 'win') {
      el('circle', { cx, cy, r: 0.42, class: 'hint-disc hint-bad' }, g);
      el('text', { x: cx, y: cy + 0.02, class: 'hint-lost' }, g).textContent = '!';
    } else if (marks.show(h.value)) {
      el('circle', { cx, cy, r: 0.42, class: `hint-disc hint-${lossClass(best - h.value)}` }, g);
      el('text', { x: cx, y: cy - 0.05, class: 'hint-loss' }, g).textContent = String(best - h.value);
      el('text', { x: cx, y: cy + 0.25, class: 'hint-left' }, g).textContent = String(h.value);
    }
  }
}

function hintText(hints) {
  const { best, marks } = hintSummary(hints);
  const unknown = hints.some((h) => h.kind === 'unknown');
  const wins = hints.filter((h) => h.kind === 'win').map((h) => label(N, h.cell));
  const view = play && play.view();
  let head;
  if (play && play.unknown) {
    head = wins.length ? `Off the proof: Black wins at ${wins.join(' or ')} (!).`
      : 'Off the proof (purple board): every move here is an unknown path.';
  } else if (view && view.kind === 'pave') {
    head = $('pairs').checked
      ? 'White holds a pairing (the linked cells): it answers every move, so every move scores 0.'
      : 'White holds a pairing: it answers every move, so every move scores 0 (green).';
  } else if (best === 0) {
    head = 'The proof ends after your next move (green board): whatever you play, White\'s reply reaches a pairing.';
  } else if (marks && marks.uniform) {
    head = `Every move scores the same (green board): White's proof needs up to ${best} more Black moves whatever you play.`;
  } else if (best !== null) {
    head = `Your best ${unknown ? 'known ' : ''}moves (green, 0) keep White's proof going for up to ${best} more Black moves.`;
  } else head = '';
  const rest = !marks || marks.hiddenLoss === null || (view && view.kind === 'pave') ? ''
    : `Every unmarked cell gives up ${marks.hiddenLoss} or more.`;
  return { head, rest, unknown: unknown && !(play && play.unknown), values: best !== null };
}

function drawPlay() {
  $('explore-help').hidden = true;
  if (explore) { drawExplore(); return; }
  svg.classList.toggle('offproof', !!(play && play.unknown));
  drawGrid((cell, r) => {
    if (!play || (!play.won && play.board[cell] === EMPTY)) {
      r.classList.add('playable');
      r.addEventListener('click', () => blackMove(cell));
    }
  });
  const showHints = $('bhints').checked && snap;
  const hints = showHints ? blackHints() : [];
  if (play) {
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
  }
  // At a drawn pairing the pairs are the answer to every move; discs would cover them.
  const paired = play && play.view() && play.view().kind === 'pave' && $('pairs').checked;
  // When every move is a best move, a green board says it instead of a disc on every cell.
  const sum = showHints && !paired ? hintSummary(hints) : null;
  const allBest = !!(sum && sum.marks && sum.marks.uniform && !(play && play.unknown));
  svg.classList.toggle('allbest', allBest);
  if (showHints && !paired && !allBest) drawHints(hints);
  const t = showHints ? hintText(hints) : null;
  $('hints-help').hidden = !t;
  $('hint-head').textContent = t ? [t.head, t.rest].filter(Boolean).join('  ') : '';
  if (t) {
    $('hints-q').hidden = !t.unknown;
    $('hints-legend').hidden = !t.values;
  }
  const list = $('moves');
  list.replaceChildren();
  const h = play ? play.history : [];
  for (let i = 0; i < h.length; i += 2) {
    const li = document.createElement('li');
    const w = h[i + 1];
    const mark = w && (w.why === 'guess' || w.why === 'candidate') ? ' ?' : '';
    li.textContent = `${label(N, h[i].cell).padEnd(4)} ${w ? label(N, w.cell) + mark : ''}`;
    list.appendChild(li);
  }
  list.scrollTop = list.scrollHeight;
  if (mode === 'play') {
    const hash = blacks.map((c) => label(N, c)).join(',');
    history.replaceState(null, '', `#play${hash ? '=' + hash : ''}`);
  }
}

function setMode(m) {
  mode = m;
  $('tab-progress').setAttribute('aria-selected', String(m === 'progress'));
  $('tab-play').setAttribute('aria-selected', String(m === 'play'));
  $('progress-panel').hidden = m !== 'progress';
  $('play-panel').hidden = m !== 'play';
  $('play-buttons').hidden = m !== 'play';
  if (m === 'play' && !play) setStatus(FIRST, '');
  render();
}

$('tab-progress').addEventListener('click', () => setMode('progress'));
$('tab-play').addEventListener('click', () => setMode('play'));
$('new').addEventListener('click', () => newGame());
$('undo').addEventListener('click', () => newGame(blacks.slice(0, -1)));
$('pairs').addEventListener('change', render);
$('bhints').addEventListener('change', render);
$('xpass').addEventListener('change', () => newGame(blacks));

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
