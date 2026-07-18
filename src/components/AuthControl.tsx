import { useState } from 'react';
import type { AuthState } from '../backend/useAuth';
import { AccountPanel } from './AccountPanel';
import { AuthModal } from './AuthModal';

/** Compact sign-in chip; opens the sign-in modal or the account panel.
 * Renders nothing when the backend is off. */
export function AuthControl({ auth }: { auth: AuthState }) {
  const [open, setOpen] = useState<'none' | 'auth' | 'account'>('none');
  if (!auth.enabled || auth.loading) return null;

  const initial = (auth.displayName ?? auth.fullName ?? auth.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="auth-control">
      {auth.signedIn ? (
        <button type="button" className="auth-chip" onClick={() => setOpen('account')}>
          <span className="auth-chip-avatar" aria-hidden="true">
            {auth.avatarUrl ? <img src={auth.avatarUrl} alt="" /> : initial}
          </span>
          <span className="auth-chip-name">{auth.displayName ?? auth.fullName ?? 'My account'}</span>
        </button>
      ) : (
        <>
          <span className="auth-blurb">
            <span aria-hidden="true">🏆</span> Sign in to post scores to the leaderboard
          </span>
          <button type="button" className="auth-google" onClick={() => setOpen('auth')}>
            <span className="auth-g" aria-hidden="true">G</span>
            Sign in
          </button>
        </>
      )}

      {open === 'auth' && <AuthModal auth={auth} onClose={() => setOpen('none')} />}
      {open === 'account' && <AccountPanel auth={auth} onClose={() => setOpen('none')} />}
    </div>
  );
}
