import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getUserIdFromName,
  saveRoll,
  subscribeToLeaderboard,
  subscribeToLiveRolls,
} from '../utils/firebaseService';

const MAX_LEADERBOARD = 200;
const MAX_LIVE_ROLLS = 30;

// Display only the new username-keyed schema. This prevents old random-ID
// JSONBin-era records from creating duplicate rows after the migration.
function dedupeUsers(entries) {
  const bestByUser = new Map();

  for (const entry of entries) {
    if (!entry?.playerName || !entry?.userId) continue;

    const userId = entry.userId;
    const existing = bestByUser.get(userId);
    if (!existing || (Number(entry.meltDamage) || 0) > (Number(existing.meltDamage) || 0)) {
      bestByUser.set(userId, entry);
    }
  }

  return Array.from(bestByUser.values())
    .sort((a, b) => (Number(b.meltDamage) || 0) - (Number(a.meltDamage) || 0))
    .slice(0, MAX_LEADERBOARD);
}

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
      const cleaned = dedupeUsers(entries);
      dataRef.current = { ...dataRef.current, leaderboard: cleaned };
      setLeaderboard(cleaned);
      leaderboardReady = true;
      if (leaderboardReady && liveReady) setLoading(false);
      setError(null);
    };

    const onLiveRolls = (entries) => {
      const sorted = entries
        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
        .slice(0, MAX_LIVE_ROLLS);
      dataRef.current = { ...dataRef.current, liveRolls: sorted };
      setLiveRolls(sorted);
      liveReady = true;
      if (leaderboardReady && liveReady) setLoading(false);
      setError(null);
    };

    const onError = (err) => {
      console.error('Firebase leaderboard subscription failed:', err);
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
    const userId = getUserIdFromName(entry.playerName);
    const current = dataRef.current;
    const existing = current.leaderboard.find((item) => item.userId === userId);

    // Optimistic update uses the deterministic user ID, so repeated rolls for
    // the same name replace one row rather than creating duplicates.
    const shouldReplace =
      !existing || (Number(entry.meltDamage) || 0) > (Number(existing.meltDamage) || 0);

    const newLeaderboard = shouldReplace
      ? dedupeUsers([
          ...current.leaderboard.filter((item) => item.userId !== userId),
          { ...entry, id: userId, userId },
        ])
      : current.leaderboard;

    const optimisticLive = {
      id: entry.id,
      userId,
      playerName: entry.playerName,
      timestamp: entry.timestamp,
      meltDamage: entry.meltDamage,
      rarity: entry.rarity,
    };

    const newLiveRolls = [optimisticLive, ...current.liveRolls]
      .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
      .slice(0, MAX_LIVE_ROLLS);

    dataRef.current = { leaderboard: newLeaderboard, liveRolls: newLiveRolls };
    setLeaderboard(newLeaderboard);
    setLiveRolls(newLiveRolls);

    try {
      const result = await saveRoll(entry);

      // Firebase is authoritative. If the submitted score was not the user's
      // best, restore the existing high score returned by the transaction.
      if (result?.leaderboardEntry) {
        const authoritative = result.leaderboardEntry;
        const reconciled = dedupeUsers([
          ...dataRef.current.leaderboard.filter((item) => item.userId !== userId),
          authoritative,
        ]);
        dataRef.current = { ...dataRef.current, leaderboard: reconciled };
        setLeaderboard(reconciled);
      }

      setError(null);
    } catch (err) {
      console.error('Firebase leaderboard write failed:', err);
      setError('Leaderboard temporarily unavailable. Please try again.');
    }
  }, []);

  return { leaderboard, liveRolls, loading, error, submitRoll, refetch: () => {} };
}
