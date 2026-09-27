import { getCurrentUser } from './authService';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBMbVLUSuDwRsrZ91-XC-sl1jofX4Y4Jyk',
  authDomain: 'arlecchino-artifact-simulator.firebaseapp.com',
  databaseURL: 'https://arlecchino-artifact-simulator-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'arlecchino-artifact-simulator',
  storageBucket: 'arlecchino-artifact-simulator.firebasestorage.app',
  messagingSenderId: '158736907187',
  appId: '1:158736907187:web:2de2dbf29362c9307fa9c6',
  measurementId: 'G-YTF5XGNW11',
};

if (!window.firebase) throw new Error('Firebase SDK was not loaded.');

const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(FIREBASE_CONFIG);
const database = window.firebase.database(app);
const LEADERBOARD_LIMIT = 200;
const LIVE_ROLL_LIMIT = 30;

export function getCurrentUserId() {
  return getCurrentUser()?.uid || '';
}

export function getUserIdFromName(name) {
  // Kept only for compatibility with older modules. New records use auth.uid.
  return encodeURIComponent(String(name || '').trim().toLowerCase()).replace(/\./g, '%2E');
}

function normalizeSnapshot(snapshot) {
  const value = snapshot.val() || {};
  return Object.entries(value).map(([key, entry]) => ({
    ...entry,
    id: entry?.id || key,
    userId: entry?.userId || key,
  }));
}

export function subscribeToLeaderboard(onData, onError) {
  const ref = database.ref('leaderboard').orderByChild('meltDamage').limitToLast(LEADERBOARD_LIMIT);
  const handler = (snapshot) => onData(normalizeSnapshot(snapshot));
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

export function subscribeToLiveRolls(onData, onError) {
  const ref = database.ref('liveRolls').orderByChild('timestamp').limitToLast(LIVE_ROLL_LIMIT);
  const handler = (snapshot) => onData(normalizeSnapshot(snapshot));
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

export async function saveRoll(entry) {
  const user = getCurrentUser();
  if (!user) throw new Error('You must be signed in.');
  await user.reload();
  if (!user.emailVerified) throw new Error('Please verify your email first.');

  const userId = user.uid;
  const playerName = String(user.displayName || '').trim();
  if (!playerName) throw new Error('Your account has no display name.');

  const userRef = database.ref(`leaderboard/${userId}`);
  const submittedEntry = { ...entry, id: userId, userId, playerName };

  const transactionResult = await userRef.transaction((current) => {
    if (!current) return submittedEntry;
    const oldScore = Number(current.meltDamage) || 0;
    const newScore = Number(entry.meltDamage) || 0;
    return newScore > oldScore ? submittedEntry : undefined;
  });

  const currentEntry = transactionResult.snapshot.val() || null;
  const liveKey = database.ref('liveRolls').push().key;
  await database.ref(`liveRolls/${liveKey}`).set({
    id: liveKey, userId, playerName,
    timestamp: entry.timestamp,
    meltDamage: entry.meltDamage,
    rarity: entry.rarity,
  });

  return { saved: transactionResult.committed, userId, leaderboardEntry: currentEntry };
}

export function getDatabase() {
  return database;
}
