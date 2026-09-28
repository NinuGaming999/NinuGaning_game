import { useCallback, useEffect, useState } from 'react';
import {
  completeRedirectSignIn,
  onAuthChange,
  readUsername,
  refreshCurrentUser,
} from '../utils/authService';

const SIGNED_OUT = { loading: false, user: null, verified: false, username: '' };

// Single source of truth for "who is playing": Firebase user + claimed username.
export function useAuth() {
  const [state, setState] = useState({ ...SIGNED_OUT, loading: true });

  const load = useCallback(async (user) => {
    if (!user) {
      setState(SIGNED_OUT);
      return;
    }
    let username = '';
    try {
      username = await readUsername(user.uid);
    } catch {
      username = '';
    }
    setState({ loading: false, user, verified: !!user.emailVerified, username });
  }, []);

  useEffect(() => {
    completeRedirectSignIn();
    return onAuthChange((user) => { load(user); });
  }, [load]);

  const refresh = useCallback(async () => {
    const user = await refreshCurrentUser();
    await load(user);
  }, [load]);

  return { ...state, refresh };
}
