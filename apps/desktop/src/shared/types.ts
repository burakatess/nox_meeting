export interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'auditor' | 'member';
}

export interface AuditEvent {
  seq: number;
  at: string;
  who: string;
  what: string;
  whereIp: string | null;
  result: string;
  device: string | null;
  details: Record<string, unknown>;
  hash: string;
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  brokenAtSeq?: number;
  reason?: string;
}

export interface Health {
  status: string;
  version: string;
  db: boolean;
  time: string;
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { status: number; message: string } };

export interface NoxApi {
  config: {
    get(): Promise<{ serverUrl: string; platform: string; version: string }>;
    setServerUrl(url: string): Promise<IpcResult<{ serverUrl: string }>>;
  };
  auth: {
    login(username: string, password: string): Promise<IpcResult<User>>;
    restore(): Promise<IpcResult<User | null>>;
    logout(): Promise<IpcResult<null>>;
  };
  server: { health(): Promise<IpcResult<Health>> };
  audit: {
    events(): Promise<IpcResult<AuditEvent[]>>;
    verify(): Promise<IpcResult<VerifyResult>>;
  };
}
