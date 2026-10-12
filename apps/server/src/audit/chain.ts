import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

export interface AuditFields {
  seq: number;
  at: string; // ISO-8601, ms hassasiyetinde
  who: string;
  what: string;
  whereIp: string | null;
  result: string;
  objectType: string | null;
  objectId: string | null;
  sessionId: string | null;
  device: string | null;
  details: Record<string, unknown>;
}

export interface AuditRecord extends AuditFields {
  prevHash: string;
  hash: string;
}

/** Anahtarları sıralı, deterministik JSON. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export function computeHash(prevHash: string, fields: AuditFields): string {
  return createHash('sha256').update(`${prevHash}\n${canonicalize(fields)}`).digest('hex');
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  brokenAtSeq?: number;
  reason?: string;
}

/** Kayıtlar seq'e göre artan sırada olmalı. Silme, ekleme ve değiştirmeyi yakalar. */
export function verifyChain(records: AuditRecord[], startPrevHash = GENESIS_HASH, startSeq = 1): VerifyResult {
  let prev = startPrevHash;
  let expectedSeq = startSeq;
  let checked = 0;
  for (const r of records) {
    if (r.seq !== expectedSeq) return { ok: false, checked, brokenAtSeq: expectedSeq, reason: 'seq boşluğu (silinmiş kayıt?)' };
    if (r.prevHash !== prev) return { ok: false, checked, brokenAtSeq: r.seq, reason: 'prev_hash uyuşmuyor' };
    const { prevHash: _p, hash: _h, ...fields } = r;
    if (computeHash(prev, fields) !== r.hash) return { ok: false, checked, brokenAtSeq: r.seq, reason: 'hash uyuşmuyor (içerik değişmiş)' };
    prev = r.hash;
    expectedSeq++;
    checked++;
  }
  return { ok: true, checked };
}
