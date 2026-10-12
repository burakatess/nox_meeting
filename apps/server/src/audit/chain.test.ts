import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditFields, AuditRecord, GENESIS_HASH, canonicalize, computeHash, verifyChain } from './chain';

function build(n: number): AuditRecord[] {
  const out: AuditRecord[] = [];
  let prev = GENESIS_HASH;
  for (let i = 1; i <= n; i++) {
    const f: AuditFields = {
      seq: i, at: new Date(1_700_000_000_000 + i).toISOString(), who: 'u', what: 'x', whereIp: null,
      result: 'success', objectType: null, objectId: null, sessionId: null, device: null, details: { i },
    };
    const hash = computeHash(prev, f);
    out.push({ ...f, prevHash: prev, hash });
    prev = hash;
  }
  return out;
}

test('canonicalize anahtar sırasından bağımsız', () => {
  assert.equal(canonicalize({ b: 1, a: [2, { d: 1, c: 2 }] }), canonicalize({ a: [2, { c: 2, d: 1 }], b: 1 }));
});

test('sağlam zincir doğrulanır', () => {
  assert.deepEqual(verifyChain(build(5)), { ok: true, checked: 5 });
});

test('içerik değişikliği yakalanır', () => {
  const c = build(5);
  c[2].result = 'failure';
  const r = verifyChain(c);
  assert.equal(r.ok, false);
  assert.equal(r.brokenAtSeq, 3);
});

test('silinen kayıt yakalanır', () => {
  const c = build(5);
  c.splice(2, 1);
  const r = verifyChain(c);
  assert.equal(r.ok, false);
  assert.equal(r.brokenAtSeq, 3);
});

test('sondan kesme zincirin kendisiyle yakalanamaz (harici çıpa/SIEM gerekir)', () => {
  assert.equal(verifyChain(build(5).slice(0, 4)).ok, true);
});
