#!/usr/bin/env -S uv run --quiet python3
"""Independent certificate checker for weak (maker-breaker) polyomino achievement games.

Shares NO code with the search.  Deliberately naive: Python sets, no bitboards, no SAT.
This is the piece meant to be ported to Lean, so every rule below is one small lemma.

Game.  Board = rows x cols, cell index i = r*cols + c.  A placement is a translate of one of the
8 rotations/reflections of `shape` lying inside the board.  Black (maker) moves first in the
given start position (`black`, `white` stones already placed; Black to move).  Black wins iff
Black's stones contain a placement.  A placement is LIVE if it holds no White stone.

Rules used (each must become a Lean lemma; see docs/PLAN.md):
  R1 monotone-white : an extra White stone never hurts White (justifies White "pass", w = null).
  R2 irrelevant-cell: a Black move on a cell in no live placement can be answered by White
                      as if Black had passed (so it needs no child).
  R3 symmetry       : if a board symmetry g maps the normalized position (Black stones on live
                      cells, union of live placements) to itself, a child for g(c) covers c.
  R4 paving         : disjoint free pairs, every live placement contains a pair  =>  White wins.
  R5 zone           : a Black win T from Q stays a win after extra White stones outside
                      supp(T) (all cells T mentions).  So at a White node, moves outside the
                      zone Z are covered by the "pass" child when Z >= supp(pass) & free.

Certificate (JSON, "format": "snaky-cert-v1"): "nodes" is a list, children are node indices.
 claim "white" (Black to move at every node):
   {"pave": [[a, b], ...]}                       leaf, rule R4
   {"moves": [[b, w|null, child], ...]}          Black plays b, White answers w (null = pass)
 claim "black":
   Black node  {"play": b, "next": child}         child is a White node
   Black node  {"cite": "file.json[.gz]", "sha256": hex}
                                                  a separate certificate (path relative to the
                                                  citing file) whose start position must equal
                                                  the current one; checked by its own Checker
   White node  {"won": [cells]}                   Black already owns this placement
               {"zone": [cells], "replies": [[w, child], ...], "pass": child|null}

usage: check.py CERT.json   -> prints "VALID <claim> ..." and exits 0, else "INVALID: why", exit 1
"""
import gzip
import json
import os
import sys

sys.setrecursionlimit(1000000)


class Invalid(Exception):
    pass


def require(cond, msg):
    if not cond:
        raise Invalid(msg)


def all_orientations(shape):
    forms = []
    pts = [tuple(p) for p in shape]
    for reflect in (False, True):
        q = [(x, -y) for (x, y) in pts] if reflect else list(pts)
        for _ in range(4):
            q = [(y, -x) for (x, y) in q]          # rotate 90 degrees
            mx = min(x for x, y in q)
            my = min(y for x, y in q)
            norm = sorted((x - mx, y - my) for x, y in q)
            if norm not in forms:
                forms.append(norm)
    return forms


def all_placements(rows, cols, shape):
    out = []
    for form in all_orientations(shape):
        for r0 in range(rows):
            for c0 in range(cols):
                cells = []
                for (x, y) in form:
                    r, c = r0 + y, c0 + x
                    if r < rows and c < cols:
                        cells.append(r * cols + c)
                if len(cells) == len(form):
                    s = frozenset(cells)
                    if s not in out:
                        out.append(s)
    return out


def board_symmetries(rows, cols):
    maps = [lambda r, c: (r, c), lambda r, c: (rows - 1 - r, c),
            lambda r, c: (r, cols - 1 - c), lambda r, c: (rows - 1 - r, cols - 1 - c)]
    if rows == cols:
        n = rows
        maps += [lambda r, c: (c, r), lambda r, c: (n - 1 - c, r),
                 lambda r, c: (c, n - 1 - r), lambda r, c: (n - 1 - c, n - 1 - r)]
    syms = []
    for f in maps:
        perm = {}
        for r in range(rows):
            for c in range(cols):
                r2, c2 = f(r, c)
                perm[r * cols + c] = r2 * cols + c2
        syms.append(perm)
    return syms


class Checker:
    def __init__(self, cert, base=".", verified=None, stats=None):
        self.cert = cert
        self.base = base
        self.verified = {} if verified is None else verified    # (path, B, W) -> supp
        self.stats = {"files": 1, "positions": 0} if stats is None else stats
        self.rows, self.cols = cert["rows"], cert["cols"]
        self.cells = set(range(self.rows * self.cols))
        self.placements = all_placements(self.rows, self.cols, cert["shape"])
        self.syms = board_symmetries(self.rows, self.cols)
        self.nodes = cert["nodes"]
        self.done = set()
        self.supp_memo = {}
        self.checked = 0

    def node(self, i):
        require(isinstance(i, int) and 0 <= i < len(self.nodes), f"bad node id {i!r}")
        return self.nodes[i]

    def live(self, white):
        return [p for p in self.placements if not (p & white)]

    def symmetric_cover(self, black, white, c, covered):
        """R3: some symmetry fixing the normalized position maps c into `covered`."""
        live = self.live(white)
        U = set().union(*live) if live else set()
        Bn = black & U
        for g in self.syms:
            if {g[x] for x in U} == U and {g[x] for x in Bn} == Bn and g[c] in covered:
                return True
        return False

    # ---- claim "white" ----------------------------------------------------------------------
    def white_node(self, i, black, white):
        key = (i, black, white)
        if key in self.done:
            return
        self.checked += 1
        n = self.node(i)
        free = self.cells - black - white
        live = self.live(white)
        for p in live:
            require(not p <= black, f"node {i}: Black already owns a placement")
        if "pave" in n:
            used = set()
            pairs = []
            for pr in n["pave"]:
                require(len(pr) == 2 and pr[0] != pr[1], f"node {i}: bad pair {pr}")
                a, b = pr
                require(a in free and b in free, f"node {i}: pair {pr} not on free cells")
                require(a not in used and b not in used, f"node {i}: pairs not disjoint")
                used |= {a, b}
                pairs.append({a, b})
            for p in live:
                require(any(pr <= p for pr in pairs),
                        f"node {i}: live placement {sorted(p)} contains no pair")
        else:
            require("moves" in n, f"node {i}: neither pave nor moves")
            moves = {}
            for b, w, child in n["moves"]:
                require(b in free, f"node {i}: Black move {b} not free")
                require(b not in moves, f"node {i}: duplicate Black move {b}")
                if w is not None:
                    require(w in free and w != b, f"node {i}: White reply {w} not free")
                moves[b] = (w, child)
            relevant = set().union(*live) & free if live else set()
            for c in sorted(free):
                if c not in relevant:
                    continue                        # R2
                if c in moves:
                    continue
                require(self.symmetric_cover(black, white, c, set(moves)),
                        f"node {i}: no answer to Black move {c}")
            for b, (w, child) in moves.items():
                nb = black | {b}
                nw = white | ({w} if w is not None else set())
                self.white_node(child, frozenset(nb), frozenset(nw))
        self.done.add(key)

    # ---- claim "black" ----------------------------------------------------------------------
    def supp(self, i, stack=()):
        if i in self.supp_memo:
            return self.supp_memo[i]
        require(i not in stack, f"cycle through node {i}")
        stack = stack + (i,)
        n = self.node(i)
        if "cite" in n:
            s = set(self.cite_supp(n))
        elif "play" in n:
            s = {n["play"]} | self.supp(n["next"], stack)
        elif "won" in n:
            s = set(n["won"])
        else:
            require("zone" in n, f"node {i}: unknown node kind")
            s = set(n["zone"])
            for w, child in n["replies"]:
                s |= self.supp(child, stack)
            if n.get("pass") is not None:
                s |= self.supp(n["pass"], stack)
        self.supp_memo[i] = frozenset(s)
        return self.supp_memo[i]

    def load_cited(self, n):
        import hashlib
        require(isinstance(n.get("cite"), str), "cite must be a path")
        path = os.path.normpath(os.path.join(self.base, n["cite"]))
        raw = open(path, "rb").read()
        require(hashlib.sha256(raw).hexdigest() == n.get("sha256"), f"sha256 mismatch for {path}")
        text = gzip.decompress(raw).decode() if path.endswith(".gz") else raw.decode()
        sub = json.loads(text)
        require(sub.get("format") == "snaky-cert-v1" and sub.get("claim") == "black",
                f"{path}: not a Black certificate")
        require((sub["rows"], sub["cols"]) == (self.rows, self.cols) and
                sorted(map(tuple, sub["shape"])) == sorted(map(tuple, self.cert["shape"])),
                f"{path}: different board or shape")
        return path, sub

    def cite_supp(self, n):
        path, sub = self.load_cited(n)
        ch = Checker(sub, os.path.dirname(path), self.verified, self.stats)
        return ch.supp(sub["root"])

    def check_cite(self, n, black, white):
        path, sub = self.load_cited(n)
        require(frozenset(sub["black"]) == black and frozenset(sub["white"]) == white,
                f"{path}: start position differs from the citing position")
        key = (path, black, white)
        if key in self.verified:
            return
        ch = Checker(sub, os.path.dirname(path), self.verified, self.stats)
        ch.black_node(sub["root"], black, white)
        self.stats["files"] += 1
        self.stats["positions"] += ch.checked
        self.verified[key] = True

    def black_node(self, i, black, white):
        key = ("B", i, black, white)
        if key in self.done:
            return
        self.checked += 1
        n = self.node(i)
        if "cite" in n:
            self.check_cite(n, black, white)
            self.done.add(key)
            return
        require("play" in n, f"node {i}: expected a Black node")
        b = n["play"]
        require(b in self.cells - black - white, f"node {i}: Black move {b} not free")
        self.white_node_b(n["next"], frozenset(black | {b}), white)
        self.done.add(key)

    def white_node_b(self, i, black, white):
        key = ("W", i, black, white)
        if key in self.done:
            return
        self.checked += 1
        n = self.node(i)
        if "won" in n:
            s = frozenset(n["won"])
            require(s in self.placements, f"node {i}: 'won' cells are not a placement")
            require(s <= black, f"node {i}: 'won' placement not all Black")
            self.done.add(key)
            return
        require("zone" in n, f"node {i}: expected a White node")
        free = self.cells - black - white
        require(free, f"node {i}: board full and Black has not won")
        zone = set(n["zone"])
        require(zone <= free, f"node {i}: zone has non-free cells")
        replies = {}
        for w, child in n["replies"]:
            require(w in zone, f"node {i}: reply {w} outside zone")
            require(w not in replies, f"node {i}: duplicate reply {w}")
            replies[w] = child
        for w in sorted(zone):
            if w not in replies:
                require(self.symmetric_cover(black, white, w, set(replies)),
                        f"node {i}: no answer to White move {w}")
        if n.get("pass") is None:
            require(zone == free, f"node {i}: no pass child but zone != all free cells")
        else:
            need = self.supp(n["pass"]) & free
            require(need <= zone, f"node {i}: zone misses {sorted(need - zone)} of supp(pass)")
            self.black_node(n["pass"], black, white)
        for w, child in replies.items():
            self.black_node(child, black, frozenset(white | {w}))
        self.done.add(key)

    def run(self):
        c = self.cert
        require(c.get("format") == "snaky-cert-v1", "unknown format")
        black, white = frozenset(c.get("black", [])), frozenset(c.get("white", []))
        require(black <= self.cells and white <= self.cells and not (black & white), "bad start")
        if c["claim"] == "white":
            self.white_node(c["root"], black, white)
        elif c["claim"] == "black":
            self.black_node(c["root"], black, white)
        else:
            raise Invalid("claim must be 'white' or 'black'")
        return c["claim"]


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    opener = gzip.open if sys.argv[1].endswith(".gz") else open
    with opener(sys.argv[1], "rt") as fh:
        cert = json.load(fh)
    ch = Checker(cert, os.path.dirname(os.path.abspath(sys.argv[1])))
    try:
        claim = ch.run()
    except (Invalid, KeyError, TypeError, ValueError, OSError, EOFError) as e:
        print(f"INVALID: {e}")
        sys.exit(1)
    cited = (f", plus {ch.stats['files'] - 1} cited files / {ch.stats['positions']} node-positions"
             if ch.stats["files"] > 1 else "")
    print(f"VALID {claim} wins {cert['rows']}x{cert['cols']} "
          f"({ch.checked} node-positions checked, {len(cert['nodes'])} nodes{cited})")


if __name__ == "__main__":
    main()
