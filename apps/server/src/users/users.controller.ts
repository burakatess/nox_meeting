import { Body, ConflictException, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { Pool } from 'pg';
import { AuditService } from '../audit/audit.service';
import { AuthContext, Roles } from '../auth/auth.guard';
import { hashPassword } from '../auth/password';
import { PG_POOL } from '../db/db.module';
import { CreateUserDto } from './users.dto';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool, private readonly audit: AuditService) {}

  @Get()
  async list() {
    const res = await this.pool.query(
      'select id, username, display_name as "displayName", role, status, created_at as "createdAt" from users order by created_at',
    );
    return { users: res.rows };
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: { auth: AuthContext; ip?: string }) {
    const exists = await this.pool.query('select 1 from users where username = $1', [dto.username]);
    if (exists.rowCount) throw new ConflictException('Bu kullanıcı adı kullanılıyor');
    const res = await this.pool.query(
      `insert into users (username, display_name, password_hash, role) values ($1,$2,$3,$4)
       returning id, username, display_name as "displayName", role, status`,
      [dto.username, dto.displayName, await hashPassword(dto.password), dto.role],
    );
    const user = res.rows[0];
    await this.audit.record({
      who: req.auth.username, what: 'user.create', result: 'success', whereIp: req.ip,
      sessionId: req.auth.sessionId, device: req.auth.deviceName,
      objectType: 'user', objectId: user.id, details: { username: user.username, role: user.role },
    });
    return user;
  }
}
