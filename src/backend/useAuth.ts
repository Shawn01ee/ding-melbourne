import { useCallback, useEffect, useState } from 'react';
import {
  backendEnabled,
  deleteMyData,
  getAccount,
  getProfileName,
  onAuthChange,
  saveProfileName,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  type AccountInfo,
} from './leaderboard';

export interface AuthState {
  /** True only when the Supabase env vars are configured. */
  enabled: boolean;
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  provider: string | null;
  avatarUrl: string | null;
  fullName: string | null;
  /** Public leaderboard name, or null until the player picks one. */
  displayName: string | null;
  signIn: () => Promise<void>;
  signInEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

/**
 * Optional auth: when the backend is unconfigured this is inert and the game
 * behaves exactly as before. A single subscription lives at the app root.
 */
export function useAuth(): AuthState {
  const [loading, setLoading] = useState(backendEnabled);
  const [account, setAccount] = useState<AccountInfo | null>(null);
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
        const current = await getAccount();
        if (!active) return;
        setAccount(current);
        setName(current ? await getProfileName() : null);
      } finally {
        if (active) setLoading(false);
      }
      unsub = await onAuthChange(async (next) => {
        if (!active) return;
        setAccount(next);
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
    signedIn: Boolean(account),
    userId: account?.id ?? null,
    email: account?.email ?? null,
    provider: account?.provider ?? null,
    avatarUrl: account?.avatarUrl ?? null,
    fullName: account?.fullName ?? null,
    displayName,
    signIn: signInWithGoogle,
    signInEmail: signInWithEmail,
    signOut,
    setDisplayName,
    deleteAccount: deleteMyData,
  };
}
