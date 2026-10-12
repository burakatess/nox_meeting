const isProd = process.env.NODE_ENV === 'production';

function jwtSecret(): string {
  const s = process.env.NOX_JWT_SECRET;
  if (s) return s;
  if (isProd) throw new Error('NOX_JWT_SECRET zorunlu (production)');
  return 'dev-only-secret-do-not-use-in-production';
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://nox:nox@localhost:5433/nox',
  jwtSecret: jwtSecret(),
  sessionTtlSeconds: Number(process.env.NOX_SESSION_TTL_SECONDS ?? 8 * 3600),
  maxFailedLogins: 5,
  lockoutSeconds: 300,
  bootstrapAdminUser: process.env.NOX_BOOTSTRAP_ADMIN_USER ?? 'admin',
  bootstrapAdminPassword: process.env.NOX_BOOTSTRAP_ADMIN_PASSWORD,
};
