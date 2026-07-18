import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AuthState } from '../backend/useAuth';

/** "My account" dialog: profile, provider, rename, sign out, delete data. */
export function AccountPanel({ auth, onClose }: { auth: AuthState; onClose: () => void }) {
  const [name, setName] = useState(auth.displayName ?? '');
  const [savedMsg, setSavedMsg] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const initial = (auth.displayName ?? auth.fullName ?? auth.email ?? '?').trim().charAt(0).toUpperCase();
  const providerLabel = auth.provider === 'google' ? 'Google account' : 'Email link';

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (next.length < 2) return;
    await auth.setDisplayName(next);
    setSavedMsg('Saved');
    setTimeout(() => setSavedMsg(''), 1500);
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="modal-eyebrow">My account</p>
        <h2 id="account-title">Driver profile</h2>

        <div className="account-avatar" aria-hidden="true">
          {auth.avatarUrl ? <img src={auth.avatarUrl} alt="" /> : <span>{initial}</span>}
        </div>

        <form className="account-name-form" onSubmit={saveName}>
          <label htmlFor="account-name">Leaderboard name</label>
          <div>
            <input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={24}
              placeholder="e.g. Tram Ace"
              autoComplete="off"
            />
            <button type="submit">{savedMsg || 'Save'}</button>
          </div>
        </form>

        <dl className="account-facts">
          <div><dt>Email</dt><dd>{auth.email ?? '—'}</dd></div>
          <div><dt>Sign-in</dt><dd>{providerLabel}</dd></div>
        </dl>

        <div className="account-actions">
          <button type="button" className="option" onClick={() => void auth.signOut().then(onClose)}>
            Sign out
          </button>
          {confirmingDelete ? (
            <div className="account-danger">
              <p>Delete your profile and all leaderboard records? This can’t be undone.</p>
              <div>
                <button type="button" className="option" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="account-delete"
                  onClick={() => void auth.deleteAccount().then(onClose)}
                >
                  Delete everything
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="account-delete-link" onClick={() => setConfirmingDelete(true)}>
              Delete account data
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
