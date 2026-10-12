import {
  CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import { AuditService } from '../audit/audit.service';
import { PG_POOL } from '../db/db.module';

export type Role = 'admin' | 'auditor' | 'member';

export interface AuthContext {
  userId: string;
  username: string;
  role: Role;
  sessionId: string;
  deviceName: string;
}

const PUBLIC_KEY = 'nox:public';
const ROLES_KEY = 'nox:roles';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Varsayılan olarak her endpoint kimlik doğrulama ister; @Public() ile açılır. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException();

    let sid: string;
    try {
      sid = (await this.jwt.verifyAsync<{ sid: string }>(token)).sid;
    } catch {
      throw new UnauthorizedException();
    }

    const res = await this.pool.query(
      `select s.id as sid, s.device_name, s.expires_at, s.revoked_at,
              u.id as uid, u.username, u.role, u.status
         from sessions s join users u on u.id = s.user_id where s.id = $1`,
      [sid],
    );
    const row = res.rows[0];
    if (!row || row.revoked_at || row.status !== 'active' || new Date(row.expires_at) <= new Date()) {
      throw new UnauthorizedException();
    }

    const auth: AuthContext = {
      userId: row.uid, username: row.username, role: row.role, sessionId: row.sid, deviceName: row.device_name,
    };
    req.auth = auth;

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (required && !required.includes(auth.role)) {
      await this.audit.record({
        who: auth.username, what: 'authz.denied', result: 'failure', whereIp: req.ip,
        sessionId: auth.sessionId, device: auth.deviceName,
        details: { method: req.method, path: req.originalUrl, required },
      });
      throw new ForbiddenException();
    }
    return true;
  }
}
