import { useCallback, useEffect, useState } from 'react';
import {
  backendEnabled,
  getProfileName,
  getUser,
  onAuthChange,
  saveProfileName,
  signInWithGoogle,
  signOut,
} from './leaderboard';

export interface AuthState {
  /** True only when the Supabase env vars are configured. */
  enabled: boolean;
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  /** Public leaderboard name, or null until the player picks one. */
  displayName: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
}

/**
 * Optional auth: when the backend is unconfigured this is inert and the game
 * behaves exactly as before. A single subscription lives at the app root.
 */
export function useAuth(): AuthState {
  const [loading, setLoading] = useState(backendEnabled);
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [displayName, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!backendEnabled) {
      setLoading(false);
      return;
    }
    let active = true;
    let unsub = () => {};
    void (async () => {
      try {
        const current = await getUser();
        if (!active) return;
        setUser(current ? { id: current.id, email: current.email ?? null } : null);
        setName(current ? await getProfileName() : null);
      } finally {
        if (active) setLoading(false);
      }
      unsub = await onAuthChange(async (next) => {
        if (!active) return;
        setUser(next ? { id: next.id, email: next.email ?? null } : null);
        setName(next ? await getProfileName() : null);
      });
    })();
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    await saveProfileName(name);
    setName(name.trim());
  }, []);

  return {
    enabled: backendEnabled,
    loading,
    signedIn: Boolean(user),
    userId: user?.id ?? null,
    email: user?.email ?? null,
    displayName,
    signIn: signInWithGoogle,
    signOut,
    setDisplayName,
  };
}
