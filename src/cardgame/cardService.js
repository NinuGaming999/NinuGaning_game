import { getDatabase, getUserIdFromName } from '../utils/firebaseService';

const db = getDatabase();

export function subscribeToArcadePoints(playerName, onData) {
  const userId = getUserIdFromName(playerName);
  if (!userId) {
    onData(0);
    return () => {};
  }

  const racingRef = db.ref(`racingLeaderboard/${userId}/score`);
  const artifactRef = db.ref(`leaderboard/${userId}/meltDamage`);
  const spentRef = db.ref(`cardCurrency/${userId}/spent`);
  const state = { racing: 0, artifact: 0, spent: 0 };

  const update = () => {
    const earned = Math.floor(state.racing / 100) + Math.floor(state.artifact / 500);
    onData(Math.max(0, earned - state.spent));
  };
  const h1 = (snap) => { state.racing = Number(snap.val()) || 0; update(); };
  const h2 = (snap) => { state.artifact = Number(snap.val()) || 0; update(); };
  const h3 = (snap) => { state.spent = Number(snap.val()) || 0; update(); };

  racingRef.on('value', h1);
  artifactRef.on('value', h2);
  spentRef.on('value', h3);

  return () => {
    racingRef.off('value', h1);
    artifactRef.off('value', h2);
    spentRef.off('value', h3);
  };
}

export async function spendArcadePoints(playerName, cost) {
  const userId = getUserIdFromName(playerName);
  if (!userId || !Number.isFinite(cost) || cost <= 0) return false;

  const racingSnap = await db.ref(`racingLeaderboard/${userId}/score`).once('value');
  const artifactSnap = await db.ref(`leaderboard/${userId}/meltDamage`).once('value');
  const racing = Number(racingSnap.val()) || 0;
  const artifact = Number(artifactSnap.val()) || 0;
  const earned = Math.floor(racing / 100) + Math.floor(artifact / 500);
  const spentRef = db.ref(`cardCurrency/${userId}/spent`);

  const result = await spentRef.transaction((current) => {
    const spent = Number(current) || 0;
    if (spent + cost > earned) return undefined;
    return spent + cost;
  });

  return result.committed;
}

export function subscribeToCollection(playerName, onData) {
  const userId = getUserIdFromName(playerName);
  if (!userId) {
    onData({});
    return () => {};
  }

  const ref = db.ref(`cardCollection/${userId}`);
  const handler = (snapshot) => onData(snapshot.val() || {});
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function addCardsToCollection(playerName, cards) {
  const userId = getUserIdFromName(playerName);
  if (!userId) return;

  const now = Date.now();
  for (const card of cards) {
    const ref = db.ref(`cardCollection/${userId}/${card.id}`);
    await ref.transaction((current) => ({
      count: (Number(current?.count) || 0) + 1,
      firstObtainedAt: Number(current?.firstObtainedAt) || now,
    }));
  }
}
