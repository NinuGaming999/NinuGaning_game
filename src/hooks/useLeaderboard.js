import { useCallback, useEffect, useRef, useState } from 'react';
import {
  saveRoll,
  subscribeToLeaderboard,
  subscribeToLiveRolls,
} from '../utils/firebaseService';

/**
 * Firebase Realtime Database-backed leaderboard.
 *
 * Unlike the old JSONBin implementation, this never performs a read-modify-write
 * of the entire leaderboard and never polls. Firebase pushes changes to every
 * connected client and atomic multi-location writes prevent concurrent rolls
 * from overwriting one another.
 */
export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [liveRolls, setLiveRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dataRef = useRef({ leaderboard: [], liveRolls: [] });

  useEffect(() => {
    let leaderboardReady = false;
    let liveReady = false;

    const onLeaderboard = (entries) => {
      const sorted = entries
        .sort((a, b) => (b.meltDamage || 0) - (a.meltDamage || 0));
      dataRef.current = { ...dataRef.current, leaderboard: sorted };
      setLeaderboard(sorted);
      leaderboardReady = true;
      if (leaderboardReady && liveReady) setLoading(false);
      setError(null);
    };

    const onLiveRolls = (entries) => {
      const sorted = entries
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      dataRef.current = { ...dataRef.current, liveRolls: sorted };
      setLiveRolls(sorted);
      liveReady = true;
      if (leaderboardReady && liveReady) setLoading(false);
      setError(null);
    };

    const onError = () => {
      setLoading(false);
      setError('Leaderboard temporarily unavailable.');
    };

    const unsubscribeLeaderboard = subscribeToLeaderboard(onLeaderboard, onError);
    const unsubscribeLiveRolls = subscribeToLiveRolls(onLiveRolls, onError);

    return () => {
      unsubscribeLeaderboard();
      unsubscribeLiveRolls();
    };
  }, []);

  const submitRoll = useCallback(async (entry) => {
    // Optimistic update keeps the UI instant while Firebase performs the write.
    const current = dataRef.current;
    const newLeaderboard = [entry, ...current.leaderboard]
      .sort((a, b) => b.meltDamage - a.meltDamage)
      .slice(0, 200);
    const newLiveRolls = [
      {
        id: entry.id,
        playerName: entry.playerName,
        timestamp: entry.timestamp,
        meltDamage: entry.meltDamage,
        rarity: entry.rarity,
      },
      ...current.liveRolls,
    ].slice(0, 30);

    dataRef.current = { leaderboard: newLeaderboard, liveRolls: newLiveRolls };
    setLeaderboard(newLeaderboard);
    setLiveRolls(newLiveRolls);

    try {
      await saveRoll(entry);
      setError(null);
    } catch (err) {
      console.error('Firebase leaderboard write failed:', err);
      setError('Leaderboard temporarily unavailable. Please try again.');
    }
  }, []);

  return { leaderboard, liveRolls, loading, error, submitRoll, refetch: () => {} };
}
