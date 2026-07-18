import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AuthState } from '../backend/useAuth';

/** Sign-in dialog: Google or an email magic link. Original Melbourne styling. */
export function AuthModal({ auth, onClose }: { auth: AuthState; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) return;
    setBusy(true);
    try {
      await auth.signInEmail(email.trim());
      setSent(true);
    } catch {
      /* keep the form open */
    } finally {
      setBusy(false);
    }
  };

  // Portal to body: the config card's backdrop-filter would otherwise become
  // the containing block for position:fixed and trap the overlay inside it.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="modal-eyebrow">DING! MELBOURNE</p>
        <h2 id="auth-modal-title">Sign in</h2>
        <p className="modal-sub">Save your records and profile to the leaderboard.</p>

        <button type="button" className="auth-google auth-google-lg" onClick={() => void auth.signIn()}>
          <span className="auth-g" aria-hidden="true">G</span>
          Continue with Google
        </button>

        <div className="modal-divider"><span>or</span></div>

        {sent ? (
          <p className="auth-sent">Check <strong>{email}</strong> for a sign-in link.</p>
        ) : (
          <form className="auth-email-form" onSubmit={sendLink}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
            <button type="submit" className="start-button" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}

        <p className="modal-fineprint">
          Signing in is optional. By continuing you agree to the project Terms and Privacy notice.
        </p>
      </div>
    </div>,
    document.body,
  );
}
