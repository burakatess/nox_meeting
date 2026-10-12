import { FormEvent, useEffect, useState } from 'react';
import type { User } from '../../shared/types';

export function Login({ onLoggedIn }: { onLoggedIn: (u: User) => void }) {
  const [serverUrl, setServerUrl] = useState('');
  const [editingServer, setEditingServer] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.nox.config.get().then((c) => setServerUrl(c.serverUrl));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (editingServer) {
      const r = await window.nox.config.setServerUrl(serverUrl);
      if (!r.ok) {
        setError(r.error.message);
        setBusy(false);
        return;
      }
      setServerUrl(r.data.serverUrl);
      setEditingServer(false);
    }
    const res = await window.nox.auth.login(username, password);
    setBusy(false);
    if (res.ok) onLoggedIn(res.data);
    else setError(res.error.message);
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>Nox</h1>
        <p className="muted">Güvenli kurumsal iletişim</p>

        <label>
          Sunucu
          <input
            value={serverUrl}
            readOnly={!editingServer}
            onChange={(e) => setServerUrl(e.target.value)}
            className={editingServer ? '' : 'readonly'}
          />
        </label>
        {!editingServer && (
          <button type="button" className="link" onClick={() => setEditingServer(true)}>
            Sunucu adresini değiştir
          </button>
        )}

        <label>
          Kullanıcı adı
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label>
          Parola
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>

        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy || !username || !password}>
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  );
}
