import type { AuthResponse, UserDto } from '@credit-follow/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  ApiError,
  clearSession,
  getRefreshToken,
  refreshSession,
  setSessionEndedHandler,
  storeSession,
} from '@/api/client';
import { api } from '@/api/endpoints';
import { tokenStorage } from './tokenStorage';
import { getFacebookCredentials, getGoogleIdToken, signOutFromProviders } from './socialSignIn';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'offline';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /** Resolves to false when the user cancelled the provider dialog. */
  signInWithGoogle: () => Promise<boolean>;
  signInWithFacebook: () => Promise<boolean>;
  signInDev: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setUser: (user: UserDto) => void;
  /** Retry restoring the session after a network failure. */
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUserState] = useState<UserDto | null>(null);
  const [attempt, setAttempt] = useState(0);

  const handleSignedOut = useCallback(() => {
    setUserState(null);
    setStatus('signedOut');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setSessionEndedHandler(handleSignedOut);
    return () => setSessionEndedHandler(null);
  }, [handleSignedOut]);

  // Restore the session from the stored refresh token on startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await tokenStorage.get().catch(() => null);
      if (!stored) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        const auth = await refreshSession();
        if (cancelled) return;
        setUserState(auth.user);
        setStatus('signedIn');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === 'NETWORK_ERROR') setStatus('offline');
        else setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const completeSignIn = useCallback(async (auth: AuthResponse) => {
    await storeSession(auth);
    setUserState(auth.user);
    setStatus('signedIn');
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const idToken = await getGoogleIdToken();
    if (!idToken) return false;
    await completeSignIn(await api.auth.google(idToken));
    return true;
  }, [completeSignIn]);

  const signInWithFacebook = useCallback(async () => {
    const credentials = await getFacebookCredentials();
    if (!credentials) return false;
    await completeSignIn(await api.auth.facebook(credentials));
    return true;
  }, [completeSignIn]);

  const signInDev = useCallback(
    async (displayName: string) => completeSignIn(await api.auth.dev(displayName)),
    [completeSignIn],
  );

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) await api.auth.logout(refreshToken).catch(() => undefined);
    await clearSession();
    await signOutFromProviders();
    handleSignedOut();
  }, [handleSignedOut]);

  const deleteAccount = useCallback(async () => {
    await api.me.delete();
    await clearSession();
    await signOutFromProviders();
    handleSignedOut();
  }, [handleSignedOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInWithGoogle,
      signInWithFacebook,
      signInDev,
      signOut,
      deleteAccount,
      setUser: setUserState,
      retry: () => {
        setStatus('loading');
        setAttempt((n) => n + 1);
      },
    }),
    [status, user, signInWithGoogle, signInWithFacebook, signInDev, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** For screens that only render when signed in. */
export function useCurrentUser(): UserDto {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user;
}
