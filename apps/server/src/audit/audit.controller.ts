import { Controller, Get, Query, Req } from '@nestjs/common';
import { AuthContext, Roles } from '../auth/auth.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@Roles('admin', 'auditor')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  async events(@Query('limit') limit?: string, @Query('beforeSeq') beforeSeq?: string) {
    const l = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const b = beforeSeq ? Number(beforeSeq) : undefined;
    return { events: await this.audit.list(l, Number.isFinite(b) ? b : undefined) };
  }

  @Get('verify')
  async verify(@Req() req: { auth: AuthContext; ip?: string }) {
    const result = await this.audit.verify();
    await this.audit.record({
      who: req.auth.username,
      what: 'audit.verify',
      result: result.ok ? 'success' : 'failure',
      whereIp: req.ip,
      sessionId: req.auth.sessionId,
      details: { checked: result.checked, brokenAtSeq: result.brokenAtSeq ?? null },
    });
    return result;
  }
}
