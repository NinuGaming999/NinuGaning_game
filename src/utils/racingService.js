import { getUserIdFromName } from './firebaseService';

const db = window.firebase.database();
const MAX_RACING_LEADERBOARD = 200;

export function subscribeToRacingLeaderboard(onData, onError) {
  const ref = db.ref('racingLeaderboard').orderByChild('score').limitToLast(MAX_RACING_LEADERBOARD);
  const handler = (snapshot) => {
    const value = snapshot.val() || {};
    const entries = Object.entries(value)
      .map(([key, entry]) => ({ ...entry, id: entry?.id || key, userId: entry?.userId || key }))
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    onData(entries);
  };
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

export async function saveRacingScore({ playerName, score, distance, nearMisses, overtakes, collisions }) {
  const userId = getUserIdFromName(playerName);
  if (!userId) throw new Error('A valid player name is required.');

  const userRef = db.ref(`racingLeaderboard/${userId}`);
  const entry = {
    id: userId,
    userId,
    playerName: String(playerName).trim(),
    score: Math.max(0, Math.round(Number(score) || 0)),
    distance: Math.max(0, Math.round(Number(distance) || 0)),
    nearMisses: Math.max(0, Math.round(Number(nearMisses) || 0)),
    overtakes: Math.max(0, Math.round(Number(overtakes) || 0)),
    collisions: Math.max(0, Math.round(Number(collisions) || 0)),
    timestamp: Date.now(),
  };

  const transaction = await userRef.transaction((current) => {
    if (!current) return entry;
    return entry.score > (Number(current.score) || 0) ? entry : undefined;
  });

  return transaction.snapshot.val() || null;
}

export function queuePlayer(userId, playerName) {
  return db.ref(`racingQueue/${userId}`).set({ userId, playerName, createdAt: window.firebase.database.ServerValue.TIMESTAMP });
}

export function leaveQueue(userId) {
  return db.ref(`racingQueue/${userId}`).remove();
}

export function subscribeToQueue(onData, onError) {
  const ref = db.ref('racingQueue').orderByChild('createdAt');
  const handler = (snapshot) => {
    const value = snapshot.val() || {};
    onData(Object.values(value));
  };
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

function makeMatchId(a, b) {
  return [a, b].sort().join('__');
}

function seededNumber(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export async function createOrJoinDeterministicMatch(a, b, aName, bName) {
  const [firstId, secondId] = [a, b].sort();
  const matchId = makeMatchId(firstId, secondId);
  const ref = db.ref(`racingMatches/${matchId}`);
  const seed = seededNumber(matchId);

  await ref.transaction((current) => {
    if (current) return;
    return {
      id: matchId,
      seed,
      status: 'waiting',
      createdAt: Date.now(),
      players: {
        [firstId]: { userId: firstId, playerName: firstId === a ? aName : bName },
        [secondId]: { userId: secondId, playerName: secondId === a ? aName : bName },
      },
      states: {},
      startAt: 0,
      finish: null,
    };
  });

  // Seed both participant slots as ready. This makes matchmaking deterministic:
  // either browser can create the room and the room can immediately start its
  // synchronized countdown without waiting for a React render cycle.
  await db.ref(`racingMatches/${matchId}/states`).update({
    [firstId]: { userId: firstId, ready: true, distance: 0, lane: 0, speed: 0, finished: false },
    [secondId]: { userId: secondId, ready: true, distance: 0, lane: 0, speed: 0, finished: false },
  });

  await startMatchIfReady(matchId);
  return matchId;
}

export function subscribeToMatch(matchId, onData, onError) {
  const ref = db.ref(`racingMatches/${matchId}`);
  const handler = (snapshot) => onData(snapshot.val());
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

export function publishPlayerState(matchId, userId, state) {
  return db.ref(`racingMatches/${matchId}/states/${userId}`).set({
    ...state,
    userId,
    lastSeen: window.firebase.database.ServerValue.TIMESTAMP,
  });
}

export async function startMatchIfReady(matchId) {
  const ref = db.ref(`racingMatches/${matchId}`);
  const now = Date.now();
  const tx = await ref.transaction((current) => {
    if (!current || current.status !== 'waiting') return;
    const states = current.states || {};
    const playerIds = Object.keys(current.players || {});
    const bothReady = playerIds.length === 2 && playerIds.every((id) => states[id]?.ready);
    if (!bothReady) return;
    return { ...current, status: 'racing', startAt: now + 3500 };
  });
  return tx.snapshot.val();
}

export function finishMatch(matchId, winnerId, winnerScore) {
  return db.ref(`racingMatches/${matchId}/finish`).transaction((current) => {
    if (current) return;
    return { winnerId, winnerScore, finishedAt: Date.now() };
  });
}

export { getUserIdFromName };
