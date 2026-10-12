import { useEffect, useState } from 'react';
import type { User } from '../../shared/types';
import { Home } from './Home';
import { Login } from './Login';

export function App() {
  const [state, setState] = useState<'loading' | 'login' | 'home'>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    window.nox.auth.restore().then((res) => {
      if (res.ok && res.data) {
        setUser(res.data);
        setState('home');
      } else {
        setState('login');
      }
    });
  }, []);

  if (state === 'loading') return <div className="center muted">Yükleniyor…</div>;
  if (state === 'login' || !user) {
    return (
      <Login
        onLoggedIn={(u) => {
          setUser(u);
          setState('home');
        }}
      />
    );
  }
  return (
    <Home
      user={user}
      onLoggedOut={() => {
        setUser(null);
        setState('login');
      }}
    />
  );
}
