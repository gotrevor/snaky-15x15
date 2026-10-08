#!/usr/bin/env python3
"""Convert Nándor Sieben's Snaky proof sequence (github.com/nandorsieben/Snaky,
proof-sequence-20.html.gz) to the card text format (tools/cards2txt.py), so the play page and
the Lean checker (`cardcheck`) can use it.  The output is untrusted: `cardcheck` checks it.

His HTML draws situations s_i of depth k: Maker (Black) owns the dotted cells, Breaker (White)
is to move, and each free cell of the situation's region R_i is labelled with the situation
reached after Breaker plays there and Maker answers.  Depth 0 situations hold a Snaky.

Card D(j, q), for a situation j and a cell q of M_j (the Maker stone that produced it, or none):
A = M_j - {q}, p = q, S = R_j + M_j, height 1 if j is won, else 1 + the largest height among its
hints.  White's reply w in R_j with label t is answered by D(t, q') under the map g that puts
s_t inside "s_j after w": g(M_t) <= M_j + {m}, m in R_j - {w}, g(R_t) <= R_j + M_j + {m} - {w},
q' = g^-1(m).  A White move outside S takes the hint of some cell of R_j.  The root is D(root, c)
for the root's single stone c, so its A is empty.

usage: sieben2cards.py SRC.html[.gz] OUT.txt [--size N]   (default N 17)
"""
import gzip
import re
import sys

ORIENT = [(1, 0, 0, 1), (-1, 0, 0, 1), (0, -1, 1, 0), (0, 1, 1, 0),
          (-1, 0, 0, -1), (1, 0, 0, -1), (0, 1, -1, 0), (0, -1, -1, 0)]
SNAKY = [(0, 0), (1, 0), (2, 0), (3, 0), (3, 1), (4, 1)]
CELL = re.compile(r'M([\d.]+) ([\d.]+)h')


def cells(d):
    return {(int(float(x)), int(float(y))) for x, y in CELL.findall(d)}


def parse(path):
    raw = open(path, 'rb').read()
    h = (gzip.decompress(raw) if path.endswith('.gz') else raw).decode()
    S = {}
    for m in re.finditer(r'<figure id="s-(\d+)".*?</figure>', h, re.S):
        f, i = m.group(0), int(m.group(1))
        k = int(re.search(r'depth (\d+)', f).group(1))
        maker = set()
        for d in re.findall(r'<path class="maker" d="([^"]*)"', f):
            maker |= {(int(float(x)), int(float(y))) for x, y in re.findall(r'M([\d.]+) ([\d.]+)h', d)}
        links = {}
        for a in re.finditer(r'<a href="#s-(\d+)"[^>]*>(.*?)</a>', f, re.S):
            for d in re.findall(r'class="cell" d="([^"]*)"', a.group(2)):
                for c in cells(d):
                    links[c] = int(a.group(1))
        S[i] = (sorted(maker), links, k)
    return S


def app(o, t, q):
    a, b, c, d = ORIENT[o]
    return (a * q[0] + b * q[1] + t[0], c * q[0] + d * q[1] + t[1])


def embed(parent, child, w):
    """(o, t, m) placing `child` inside `parent` after Breaker plays w, or None."""
    M, R = set(parent[0]), set(parent[1])
    Mc, Rc = child[0], list(child[1])
    for o in range(8):
        a0 = app(o, (0, 0), Mc[0])
        for c in sorted(M | R):
            t = (c[0] - a0[0], c[1] - a0[1])
            img = {app(o, t, q) for q in Mc}
            extra = img - M
            if len(extra) > 1 or not extra <= R - {w}:
                continue
            m = next(iter(extra), None)
            if all(r != w and (r in R or r in M or r == m) for r in (app(o, t, q) for q in Rc)):
                return o, t, m
    return None


def inverse(o, t, m):
    a, b, c, d = ORIENT[o]
    u, v = m[0] - t[0], m[1] - t[1]
    return (a * u + c * v, b * u + d * v)  # orthogonal: inverse is the transpose


def convert(S, size):
    roots = [i for i in S if not any(i in L.values() for _, L, _ in S.values())]
    assert len(roots) == 1 and len(S[roots[0]][0]) == 1, roots
    root = roots[0]
    index, cards, height = {}, [], {}

    def card(j, q):
        """Index of card D(j, q), built on first use (children first, so heights are known)."""
        if (j, q) in index:
            return index[(j, q)]
        M, L, k = S[j]
        A = [c for c in M if c != q]
        p = q if q is not None else M[0]
        Sc = sorted(L) + list(M)
        replies, hs = [], []
        if k > 0:
            for w in sorted(L):
                t = L[w]
                e = embed(S[j], S[t], w)
                if e is None:
                    sys.exit(f"s{j}: no embedding for Breaker {w} -> s{t}")
                o, tr, m = e
                qq = inverse(o, tr, m) if m is not None else None
                ci = card(t, qq)
                replies.append((w, (ci, o, *tr)))
                hs.append(height[ci])
            pas = min(replies, key=lambda r: height[r[1][0]])[1]
        else:
            pas = None
        h = 1 if k == 0 else 1 + max(hs)
        i = len(cards)
        cards.append((h, p, A, Sc, pas, replies))
        height[i] = h
        index[(j, q)] = i
        return i

    sys.setrecursionlimit(10000)
    r = card(root, S[root][0][0])
    reg = cards[r][3]
    dx, dy = -min(x for x, _ in reg), -min(y for _, y in reg)
    if max(x for x, _ in reg) + dx >= size or max(y for _, y in reg) + dy >= size:
        sys.exit(f"root region does not fit {size} x {size}")
    out = [f"snaky-cards-txt-v1 {size} {size} {r} 0 {dx} {dy}"]
    for h, p, A, Sc, pas, replies in cards:
        t = [h, *p, len(A)]
        for q in A:
            t += q
        t.append(len(Sc))
        for q in Sc:
            t += q
        t += list(pas) if pas else [-1]
        t.append(len(replies))
        for w, hint in replies:
            t += [*w, *hint]
        out.append(" ".join(map(str, t)))
    return "\n".join(out) + "\n", len(cards), cards[r][0]


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
    size = int(args[args.index('--size') + 1]) if '--size' in args else 17
    text, n, h = convert(parse(args[0]), size)
    open(args[1], 'w').write(text)
    print(f"wrote {args[1]}: {n} cards, root height {h}, board {size} x {size}")


if __name__ == '__main__':
    main()
