import { app, safeStorage } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Persisted {
  serverUrl?: string;
  tokenEnc?: string;
}

const DEFAULT_SERVER_URL = process.env.NOX_SERVER_URL ?? 'http://localhost:4000';

/** Küçük yapılandırma deposu. Token, OS anahtar deposuyla (Windows'ta DPAPI) şifrelenerek saklanır. */
export class Store {
  private readonly file = join(app.getPath('userData'), 'nox-config.json');
  private data: Persisted = {};
  private token: string | null = null;

  constructor() {
    try {
      this.data = JSON.parse(readFileSync(this.file, 'utf8'));
    } catch {
      this.data = {};
    }
    if (this.data.tokenEnc && safeStorage.isEncryptionAvailable()) {
      try {
        this.token = safeStorage.decryptString(Buffer.from(this.data.tokenEnc, 'base64'));
      } catch {
        this.token = null;
      }
    }
  }

  get serverUrl(): string {
    return this.data.serverUrl ?? DEFAULT_SERVER_URL;
  }

  setServerUrl(url: string) {
    this.data.serverUrl = url;
    this.setToken(null); // başka sunucunun token'ı geçerli sayılmaz
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token && safeStorage.isEncryptionAvailable()) {
      this.data.tokenEnc = safeStorage.encryptString(token).toString('base64');
    } else {
      delete this.data.tokenEnc; // şifreleme yoksa token diske yazılmaz
    }
    this.save();
  }

  private save() {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), { mode: 0o600 });
  }
}
