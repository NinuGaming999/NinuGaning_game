import { getCurrentUser } from '../../utils/authService';
import { computeAvailablePoints } from '../engine/points.js';

const db = window.firebase.database();
const functions = window.firebase.app().functions('asia-southeast1');

export function subscribeToArcadePoints(playerName, onData) {
  const user = getCurrentUser();
  if (!user) { onData(0); return () => {}; }
  const userId = user.uid;
  const racingRef = db.ref(`racingLeaderboard/${userId}/score`);
  const meltRef = db.ref(`leaderboard/${userId}/meltDamage`);
  const spentRef = db.ref(`cardCurrency/${userId}/spent`);
  const state = { racingScore: 0, meltDamage: 0, spent: 0 };
  const recompute = () => onData(computeAvailablePoints(state));
  const h1 = (s) => { state.racingScore = s.val() || 0; recompute(); };
  const h2 = (s) => { state.meltDamage = s.val() || 0; recompute(); };
  const h3 = (s) => { state.spent = s.val() || 0; recompute(); };
  racingRef.on('value', h1); meltRef.on('value', h2); spentRef.on('value', h3);
  return () => { racingRef.off('value', h1); meltRef.off('value', h2); spentRef.off('value', h3); };
}

export async function openElementalsPack() {
  const user = getCurrentUser();
  if (!user || !user.emailVerified) throw new Error('A verified account is required.');
  const callable = functions.httpsCallable('openElementalsPack');
  const response = await callable({});
  return response.data;
}

export function subscribeToCollection(playerName, onData) {
  const user = getCurrentUser();
  if (!user) { onData({}); return () => {}; }
  const ref = db.ref(`cardCollection/${user.uid}`);
  const handler = (snapshot) => onData(snapshot.val() || {});
  ref.on('value', handler);
  return () => ref.off('value', handler);
}
