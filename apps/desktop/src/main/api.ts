import type { IpcResult } from '../shared/types';
import type { Store } from './store';

/** Sunucu API istemcisi. Yalnızca main süreci kullanır; renderer token'ı hiç görmez. */
export class Api {
  constructor(private readonly store: Store) {}

  async request<T>(method: string, path: string, body?: unknown, auth = true): Promise<IpcResult<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.store.getToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch(new URL(`/api/v1${path}`, this.store.serverUrl), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401 && auth) this.store.setToken(null);
      if (!res.ok) {
        let message = res.statusText;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (j.message) message = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        } catch {
          /* gövde JSON değil */
        }
        return { ok: false, error: { status: res.status, message } };
      }
      const text = await res.text();
      return { ok: true, data: (text ? JSON.parse(text) : null) as T };
    } catch (e) {
      return { ok: false, error: { status: 0, message: `Sunucuya ulaşılamadı (${this.store.serverUrl})` } };
    }
  }
}
