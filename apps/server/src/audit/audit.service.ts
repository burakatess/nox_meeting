import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module';
import { AuditFields, AuditRecord, GENESIS_HASH, VerifyResult, computeHash, verifyChain } from './chain';

export interface AuditInput {
  who: string;
  what: string;
  result: 'success' | 'failure';
  whereIp?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  sessionId?: string | null;
  device?: string | null;
  details?: Record<string, unknown>;
}

const COLS = `seq, at, who, what, where_ip, result, object_type, object_id, session_id, device, details, prev_hash, hash`;

function fromRow(r: any): AuditRecord {
  return {
    seq: Number(r.seq),
    at: new Date(r.at).toISOString(),
    who: r.who,
    what: r.what,
    whereIp: r.where_ip,
    result: r.result,
    objectType: r.object_type,
    objectId: r.object_id,
    sessionId: r.session_id,
    device: r.device,
    details: r.details,
    prevHash: r.prev_hash,
    hash: r.hash,
  };
}

@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Hash-chain'li, append-only kayıt. Yazılamazsa hata fırlatır (fail-closed):
   * çağıran işlem audit'siz tamamlanmamalıdır.
   */
  async record(input: AuditInput): Promise<AuditRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(727001)');
      const last = await client.query('select seq, hash from audit_events order by seq desc limit 1');
      const prevHash: string = last.rows[0]?.hash ?? GENESIS_HASH;
      const fields: AuditFields = {
        seq: last.rows[0] ? Number(last.rows[0].seq) + 1 : 1,
        at: new Date().toISOString(),
        who: input.who,
        what: input.what,
        whereIp: input.whereIp ?? null,
        result: input.result,
        objectType: input.objectType ?? null,
        objectId: input.objectId ?? null,
        sessionId: input.sessionId ?? null,
        device: input.device ?? null,
        details: input.details ?? {},
      };
      const hash = computeHash(prevHash, fields);
      await client.query(
        `insert into audit_events (${COLS}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [fields.seq, fields.at, fields.who, fields.what, fields.whereIp, fields.result, fields.objectType,
         fields.objectId, fields.sessionId, fields.device, fields.details, prevHash, hash],
      );
      await client.query('commit');
      return { ...fields, prevHash, hash };
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }

  async list(limit: number, beforeSeq?: number): Promise<AuditRecord[]> {
    const res = beforeSeq
      ? await this.pool.query(`select ${COLS} from audit_events where seq < $1 order by seq desc limit $2`, [beforeSeq, limit])
      : await this.pool.query(`select ${COLS} from audit_events order by seq desc limit $1`, [limit]);
    return res.rows.map(fromRow);
  }

  async verify(): Promise<VerifyResult> {
    const res = await this.pool.query(`select ${COLS} from audit_events order by seq asc`);
    return verifyChain(res.rows.map(fromRow));
  }
}
