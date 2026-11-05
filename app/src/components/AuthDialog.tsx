import { useState } from 'react';
import { useAuth } from '../lib/auth';

interface Props {
  reason?: string;
  onClose: () => void;
}

export function AuthDialog({ reason, onClose }: Props) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="detail-header">
          <h2>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {reason && <p className="muted small">{reason}</p>}
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Anmelden</button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Registrieren</button>
        </div>
        {mode === 'register' && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" required maxLength={50} />
          </label>
        )}
        <label>
          E-Mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 8 : undefined}
            required
          />
          {mode === 'register' && <span className="muted small">Mindestens 8 Zeichen</span>}
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </button>
        <p className="muted small">
          Mit Konto werden deine Runden, Schlagweiten und Favoriten gesichert und auf allen Geräten synchronisiert.
        </p>
      </form>
    </div>
  );
}
