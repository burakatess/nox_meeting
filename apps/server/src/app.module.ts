import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

@Module({ imports: [DbModule, AuditModule, AuthModule, UsersModule, HealthModule] })
export class AppModule {}
