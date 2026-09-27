import { useEffect, useState } from 'react';
import { subscribeAuth } from '../utils/authService';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const off = subscribeAuth((nextUser) => { setUser(nextUser || null); setLoading(false); }, () => setLoading(false));
    return off;
  }, []);
  return { user, loading };
}
