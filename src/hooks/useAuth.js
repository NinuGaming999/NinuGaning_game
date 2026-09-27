import { useEffect, useState } from 'react';
import { getAuth, subscribeAuth } from '../utils/authService';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = subscribeAuth((nextUser) => {
      if (nextUser && !nextUser.emailVerified) {
        getAuth().signOut().finally(() => {
          setUser(null);
          setLoading(false);
        });
        return;
      }
      setUser(nextUser || null);
      setLoading(false);
    }, () => setLoading(false));
    return off;
  }, []);

  return { user, loading };
}
