import type { AuthState } from '../backend/useAuth';

/** Slim optional-sign-in banner. Renders nothing when the backend is off. */
export function AuthControl({ auth }: { auth: AuthState }) {
  if (!auth.enabled || auth.loading) return null;

  if (!auth.signedIn) {
    return (
      <div className="auth-control">
        <span className="auth-blurb">
          <span aria-hidden="true">🏆</span> Sign in to post scores to the leaderboard
        </span>
        <button type="button" className="auth-google" onClick={() => void auth.signIn()}>
          <span className="auth-g" aria-hidden="true">G</span>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="auth-control">
      <span className="auth-blurb">
        Signed in{auth.displayName ? ` as ` : ''}
        {auth.displayName && <strong>{auth.displayName}</strong>}
      </span>
      <button type="button" className="auth-signout" onClick={() => void auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}
