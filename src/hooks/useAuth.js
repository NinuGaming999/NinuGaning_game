import { useCallback, useEffect, useState } from 'react';
import {
  completeRedirectSignIn,
  exchangeForGameSession,
  onAuthChange,
  readUsername,
  refreshCurrentUser,
} from '../utils/authService';
import { gameAuth } from '../utils/firebaseService';

const SIGNED_OUT = {
  loading: false,
  user: null,
  verified: false,
  username: '',
  error: null,
};

export function useAuth() {
  const [state, setState] = useState({ ...SIGNED_OUT, loading: true });

  const load = useCallback(async (user) => {
    if (!user) {
      await gameAuth.signOut().catch(() => {});
      setState(SIGNED_OUT);
      return;
    }

    if (!user.emailVerified) {
      await gameAuth.signOut().catch(() => {});
      setState({
        loading: false,
        user,
        verified: false,
        username: '',
        error: null,
      });
      return;
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      user,
      verified: true,
      error: null,
    }));

    try {
      await exchangeForGameSession();

      let username = '';
      try {
        username = await readUsername(user.uid);
      } catch {
        username = '';
      }

      setState({
        loading: false,
        user: gameAuth.currentUser || user,
        verified: true,
        username,
        error: null,
      });
    } catch (error) {
      console.error('Firebase cross-project authentication bridge failed:', error);
      await gameAuth.signOut().catch(() => {});
      setState({
        loading: false,
        user,
        verified: true,
        username: '',
        error: 'Login is configured, but the secure game-session bridge could not be completed. Check the Vercel AUTH bridge environment variables.',
      });
    }
  }, []);

  useEffect(() => {
    completeRedirectSignIn();
    return onAuthChange((user) => {
      load(user);
    });
  }, [load]);

  const refresh = useCallback(async () => {
    const user = await refreshCurrentUser();
    await load(user);
  }, [load]);

  return { ...state, refresh };
}
