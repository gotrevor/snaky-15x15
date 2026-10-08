// tools/build-web stamps every script, stylesheet and import with its content hash, so a fresh
// page never runs a cached older script (the host caches .js/.css for hours).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

test('build-web: every asset reference carries the hash of the file it names', () => {
  const out = mkdtempSync(join(tmpdir(), 'snaky-web-'));
  execFileSync('python3', [join(ROOT, 'tools/build-web'), out], { stdio: 'pipe' });  // stdlib only; CI has no uv
  const files = readdirSync(out).filter((f) => /\.(html|js|css)$/.test(f));
  let refs = 0;
  for (const f of files) {
    const text = readFileSync(join(out, f), 'utf8');
    for (const m of text.matchAll(/(?:src|href)="([\w.-]+\.(?:js|css))([^"]*)"|from '\.\/([\w.-]+\.js)([^']*)'/g)) {
      const name = m[1] || m[3], q = m[2] ?? m[4];
      const want = createHash('sha256').update(readFileSync(join(out, name))).digest('hex').slice(0, 10);
      assert.equal(q, `?v=${want}`, `${f} -> ${name}`);
      refs++;
    }
  }
  assert.ok(refs >= 8, `only ${refs} references found`);
});
