import { useEffect, useState } from 'react';

const OBSERVER_TIMEOUT = Number(import.meta.env.VITE_OBSERVER_TIMEOUT) || 60000;
const MAX_VISIBLE = 10;

/**
 * Derives the "last 60 seconds, max 10" live feed from the raw liveRolls
 * array, re-evaluating every second so old entries drop off automatically.
 */
export function useObserverFeed(liveRolls) {
  const [visibleRolls, setVisibleRolls] = useState([]);

  useEffect(() => {
    function update() {
      const now = Date.now();
      const filtered = liveRolls
        .filter((r) => now - r.timestamp < OBSERVER_TIMEOUT)
        .slice(0, MAX_VISIBLE);
      setVisibleRolls(filtered);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [liveRolls]);

  return visibleRolls;
}
