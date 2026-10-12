import { app, ipcMain } from 'electron';
import { hostname } from 'node:os';
import type { AuditEvent, Health, IpcResult, User, VerifyResult } from '../shared/types';
import { Api } from './api';
import { Store } from './store';

export function registerIpc(store: Store) {
  const api = new Api(store);

  ipcMain.handle('config:get', () => ({
    serverUrl: store.serverUrl,
    platform: process.platform,
    version: app.getVersion(),
  }));

  ipcMain.handle('config:setServerUrl', (_e, raw: unknown): IpcResult<{ serverUrl: string }> => {
    try {
      const u = new URL(String(raw));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
      store.setServerUrl(u.origin);
      return { ok: true, data: { serverUrl: u.origin } };
    } catch {
      return { ok: false, error: { status: 0, message: 'Geçersiz sunucu adresi (http:// veya https:// ile başlamalı)' } };
    }
  });

  ipcMain.handle('auth:login', async (_e, username: string, password: string): Promise<IpcResult<User>> => {
    const res = await api.request<{ token: string; user: User }>(
      'POST', '/auth/login', { username, password, deviceName: hostname() }, false,
    );
    if (!res.ok) return res;
    store.setToken(res.data.token);
    return { ok: true, data: res.data.user };
  });

  ipcMain.handle('auth:restore', async (): Promise<IpcResult<User | null>> => {
    if (!store.getToken()) return { ok: true, data: null };
    const res = await api.request<User>('GET', '/auth/me');
    if (res.ok) return res;
    return res.error.status === 401 ? { ok: true, data: null } : res;
  });

  ipcMain.handle('auth:logout', async (): Promise<IpcResult<null>> => {
    await api.request('POST', '/auth/logout');
    store.setToken(null);
    return { ok: true, data: null };
  });

  ipcMain.handle('server:health', () => api.request<Health>('GET', '/health', undefined, false));

  ipcMain.handle('audit:events', async (): Promise<IpcResult<AuditEvent[]>> => {
    const res = await api.request<{ events: AuditEvent[] }>('GET', '/audit/events?limit=50');
    return res.ok ? { ok: true, data: res.data.events } : res;
  });

  ipcMain.handle('audit:verify', () => api.request<VerifyResult>('GET', '/audit/verify'));
}
