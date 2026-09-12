import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBinData, saveBinData } from '../utils/jsonbinService';

const FETCH_INTERVAL = Number(import.meta.env.VITE_FETCH_INTERVAL) || 2000;
const MAX_LEADERBOARD_STORED = 200;
const MAX_LIVE_ROLLS_STORED = 30;

/**
 * Polls JSONbin every FETCH_INTERVAL ms for the current leaderboard +
 * live-roll feed, and exposes submitRoll() to push a new roll to everyone.
 */
export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [liveRolls, setLiveRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dataRef = useRef({ leaderboard: [], liveRolls: [] });

  const load = useCallback(async () => {
    try {
      const data = await fetchBinData();
      const lb = data?.leaderboard || [];
      const lr = data?.liveRolls || [];
      dataRef.current = { leaderboard: lb, liveRolls: lr };
      setLeaderboard(lb);
      setLiveRolls(lr);
      setError(null);
    } catch (err) {
      setError('Leaderboard temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, FETCH_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  const submitRoll = useCallback(async (entry) => {
    const current = dataRef.current;

    const newLeaderboard = [entry, ...current.leaderboard]
      .sort((a, b) => b.meltDamage - a.meltDamage)
      .slice(0, MAX_LEADERBOARD_STORED);

    const newLiveRolls = [
      {
        playerName: entry.playerName,
        timestamp: entry.timestamp,
        meltDamage: entry.meltDamage,
        rarity: entry.rarity,
      },
      ...current.liveRolls,
    ].slice(0, MAX_LIVE_ROLLS_STORED);

    const newData = { leaderboard: newLeaderboard, liveRolls: newLiveRolls };

    // Optimistic local update so the roller sees their own result instantly.
    dataRef.current = newData;
    setLeaderboard(newLeaderboard);
    setLiveRolls(newLiveRolls);

    try {
      await saveBinData(newData);
      setError(null);
    } catch (err) {
      setError('Leaderboard temporarily unavailable. Your roll was saved locally.');
    }
  }, []);

  return { leaderboard, liveRolls, loading, error, submitRoll, refetch: load };
}
