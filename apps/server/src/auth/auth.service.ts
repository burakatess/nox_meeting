import { Inject, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { AuditService } from '../audit/audit.service';
import { config } from '../config';
import { PG_POOL } from '../db/db.module';
import { AuthContext } from './auth.guard';
import { hashPassword, verifyPassword } from './password';

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: { id: string; username: string; displayName: string; role: string };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger('Auth');
  private dummyHash!: string;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await hashPassword(randomBytes(16).toString('hex'));
    await this.bootstrapAdmin();
  }

  /** İlk kurulumda kullanıcı yoksa bir admin oluşturur; parola verilmediyse üretip bir kez loglar. */
  private async bootstrapAdmin() {
    const count = await this.pool.query('select count(*)::int as n from users');
    if (count.rows[0].n > 0) return;
    const supplied = config.bootstrapAdminPassword;
    const password = supplied ?? randomBytes(18).toString('base64url');
    const username = config.bootstrapAdminUser.toLowerCase();
    const res = await this.pool.query(
      `insert into users (username, display_name, password_hash, role) values ($1, $2, $3, 'admin') returning id`,
      [username, 'Sistem Yöneticisi', await hashPassword(password)],
    );
    await this.audit.record({
      who: 'system', what: 'bootstrap.admin_created', result: 'success',
      objectType: 'user', objectId: res.rows[0].id, details: { username },
    });
    if (supplied) {
      this.log.warn(`İlk admin oluşturuldu: kullanıcı="${username}" (parola NOX_BOOTSTRAP_ADMIN_PASSWORD'den).`);
    } else {
      this.log.warn(`İlk admin oluşturuldu: kullanıcı="${username}" parola="${password}" — yalnızca bir kez gösterilir, hemen değiştirin.`);
    }
  }

  async login(username: string, password: string, deviceName: string, ip: string | undefined): Promise<LoginResult> {
    const uname = username.trim().toLowerCase();
    const res = await this.pool.query('select * from users where username = $1', [uname]);
    const user = res.rows[0];
    const device = deviceName || 'unknown';

    const fail = async (reason: string): Promise<never> => {
      await this.audit.record({
        who: uname, what: 'auth.login', result: 'failure', whereIp: ip, device,
        objectType: 'user', objectId: user?.id ?? null, details: { reason },
      });
      throw new UnauthorizedException('Kullanıcı adı veya parola hatalı');
    };

    if (!user) {
      await verifyPassword(password, this.dummyHash); // zamanlama farkını azalt
      return fail('unknown_user');
    }
    if (user.status !== 'active') return fail('disabled');
    if (user.locked_until && new Date(user.locked_until) > new Date()) return fail('locked');

    if (!(await verifyPassword(password, user.password_hash))) {
      const upd = await this.pool.query(
        `update users set failed_logins = failed_logins + 1,
           locked_until = case when failed_logins + 1 >= $2 then now() + make_interval(secs => $3) else locked_until end
         where id = $1 returning failed_logins`,
        [user.id, config.maxFailedLogins, config.lockoutSeconds],
      );
      return fail(upd.rows[0].failed_logins >= config.maxFailedLogins ? 'bad_password_locked' : 'bad_password');
    }

    await this.pool.query('update users set failed_logins = 0, locked_until = null where id = $1', [user.id]);
    const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000);
    const s = await this.pool.query(
      'insert into sessions (user_id, device_name, ip, expires_at) values ($1,$2,$3,$4) returning id',
      [user.id, device, ip ?? null, expiresAt],
    );
    const sessionId: string = s.rows[0].id;
    const token = await this.jwt.signAsync({ sub: user.id, sid: sessionId, role: user.role }, { expiresIn: config.sessionTtlSeconds });
    await this.audit.record({
      who: user.username, what: 'auth.login', result: 'success', whereIp: ip, device, sessionId,
      objectType: 'user', objectId: user.id,
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role },
    };
  }

  async logout(auth: AuthContext, ip: string | undefined) {
    await this.pool.query('update sessions set revoked_at = now() where id = $1 and revoked_at is null', [auth.sessionId]);
    await this.audit.record({
      who: auth.username, what: 'auth.logout', result: 'success', whereIp: ip,
      sessionId: auth.sessionId, device: auth.deviceName,
    });
  }

  async me(auth: AuthContext) {
    const res = await this.pool.query('select id, username, display_name, role from users where id = $1', [auth.userId]);
    const u = res.rows[0];
    return { id: u.id, username: u.username, displayName: u.display_name, role: u.role };
  }
}
