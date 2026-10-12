import { Controller, Get, Inject, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { Public } from '../auth/auth.guard';
import { PG_POOL } from '../db/db.module';

@Controller('health')
class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Public()
  @Get()
  async health() {
    let db = false;
    try {
      await this.pool.query('select 1');
      db = true;
    } catch {
      /* db=false */
    }
    return { status: db ? 'ok' : 'degraded', service: 'nox-server', version: '0.0.1', db, time: new Date().toISOString() };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
