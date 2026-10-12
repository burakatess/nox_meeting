import { Global, Inject, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from '../config';
import { migrations } from './migrations';

export const PG_POOL = Symbol('PG_POOL');

async function migrate(pool: Pool) {
  const log = new Logger('Db');
  await pool.query(
    'create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())',
  );
  for (const m of migrations) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(727000)');
      const done = await client.query('select 1 from schema_migrations where id = $1', [m.id]);
      if (done.rowCount === 0) {
        await client.query(m.sql);
        await client.query('insert into schema_migrations (id) values ($1)', [m.id]);
        log.log(`migration uygulandı: ${m.id}`);
      }
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
}

// Pool, migration'lar bittikten sonra sağlanır; bağımlı servisler hazır şemayla başlar.
async function createPool(): Promise<Pool> {
  const pool = new Pool({ connectionString: config.databaseUrl });
  await migrate(pool);
  return pool;
}

@Injectable()
class PoolCloser implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onModuleDestroy() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [{ provide: PG_POOL, useFactory: createPool }, PoolCloser],
  exports: [PG_POOL],
})
export class DbModule {}
