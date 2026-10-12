import { useCallback, useEffect, useState } from 'react';
import type { AuditEvent, Health, User, VerifyResult } from '../../shared/types';

const ROLE_LABEL: Record<User['role'], string> = { admin: 'Yönetici', auditor: 'Denetçi', member: 'Üye' };

export function Home({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [info, setInfo] = useState<{ serverUrl: string; platform: string; version: string } | null>(null);
  const canAudit = user.role === 'admin' || user.role === 'auditor';

  const loadEvents = useCallback(async () => {
    const res = await window.nox.audit.events();
    if (res.ok) setEvents(res.data);
    else if (res.error.status === 401) onLoggedOut();
  }, [onLoggedOut]);

  useEffect(() => {
    window.nox.config.get().then(setInfo);
    window.nox.server.health().then((r) => (r.ok ? setHealth(r.data) : setHealthErr(r.error.message)));
    if (canAudit) loadEvents();
  }, [canAudit, loadEvents]);

  async function runVerify() {
    const res = await window.nox.audit.verify();
    if (res.ok) setVerify(res.data);
    loadEvents();
  }

  async function logout() {
    await window.nox.auth.logout();
    onLoggedOut();
  }

  return (
    <div className="app">
      <header>
        <strong className="brand">Nox</strong>
        <span className={`pill ${health?.status === 'ok' ? 'ok' : 'bad'}`}>
          {health ? (health.status === 'ok' ? 'Sunucu bağlı' : 'Sunucu sorunlu') : healthErr ?? '…'}
        </span>
        <span className="spacer" />
        <span>{user.displayName}</span>
        <span className="pill">{ROLE_LABEL[user.role]}</span>
        <button className="secondary" onClick={logout}>Çıkış</button>
      </header>

      <main>
        <section className="card">
          <h2>Durum</h2>
          <dl>
            <dt>Sunucu</dt><dd>{info?.serverUrl}</dd>
            <dt>Sürüm</dt><dd>{health?.version ?? '–'} (istemci {info?.version ?? '–'}, {info?.platform})</dd>
            <dt>Veritabanı</dt><dd>{health ? (health.db ? 'Bağlı' : 'Erişilemiyor') : '–'}</dd>
          </dl>
          <p className="muted">Sohbet, dosya ve toplantı modülleri sonraki aşamalarda (M2–M4) eklenecek.</p>
        </section>

        {canAudit && (
          <section className="card wide">
            <div className="row">
              <h2>Denetim kayıtları</h2>
              <span className="spacer" />
              <button className="secondary" onClick={loadEvents}>Yenile</button>
              <button onClick={runVerify}>Zinciri doğrula</button>
            </div>
            {verify && (
              <div className={verify.ok ? 'notice ok' : 'notice bad'}>
                {verify.ok
                  ? `Zincir sağlam (${verify.checked} kayıt doğrulandı)`
                  : `Zincir BOZUK — seq ${verify.brokenAtSeq}: ${verify.reason}`}
              </div>
            )}
            <table>
              <thead>
                <tr><th>#</th><th>Zaman</th><th>Kim</th><th>Olay</th><th>Sonuç</th><th>Cihaz</th></tr>
              </thead>
              <tbody>
                {events?.map((e) => (
                  <tr key={e.seq}>
                    <td>{e.seq}</td>
                    <td>{new Date(e.at).toLocaleString('tr-TR')}</td>
                    <td>{e.who}</td>
                    <td>{e.what}</td>
                    <td className={e.result === 'success' ? 'okc' : 'badc'}>{e.result}</td>
                    <td>{e.device ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
