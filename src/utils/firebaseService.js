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

if (!window.firebase) {
  throw new Error('Firebase SDK was not loaded.');
}

const app = window.firebase.apps.length
  ? window.firebase.app()
  : window.firebase.initializeApp(FIREBASE_CONFIG);

const database = window.firebase.database(app);
const LEADERBOARD_LIMIT = 200;
const LIVE_ROLL_LIMIT = 30;

// One deterministic Firebase key per username. Encoding makes the key safe for
// Firebase even when a name contains spaces, slashes, dots, brackets, etc.
// Normalization is case-insensitive, so "Ninu" and "ninu" are the same user.
export function getUserIdFromName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  return encodeURIComponent(normalized).replace(/\./g, '%2E');
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
  // Only fetch the highest 200 scores. The listener remains realtime.
  const ref = database
    .ref('leaderboard')
    .orderByChild('meltDamage')
    .limitToLast(LEADERBOARD_LIMIT);
  const handler = (snapshot) => onData(normalizeSnapshot(snapshot));
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

export function subscribeToLiveRolls(onData, onError) {
  const ref = database
    .ref('liveRolls')
    .orderByChild('timestamp')
    .limitToLast(LIVE_ROLL_LIMIT);
  const handler = (snapshot) => onData(normalizeSnapshot(snapshot));
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

export async function saveRoll(entry) {
  const userId = getUserIdFromName(entry.playerName);
  if (!userId) throw new Error('A valid player name is required.');

  const userRef = database.ref(`leaderboard/${userId}`);
  const submittedEntry = {
    ...entry,
    id: userId,
    userId,
  };

  // Transaction guarantees that concurrent rolls from the same username cannot
  // overwrite a better score. The stored leaderboard record changes only when
  // the new Melt Damage is strictly higher. Equal scores keep the existing best.
  const transactionResult = await userRef.transaction((current) => {
    if (!current) return submittedEntry;

    const oldScore = Number(current.meltDamage) || 0;
    const newScore = Number(entry.meltDamage) || 0;

    if (newScore <= oldScore) return;
    return submittedEntry;
  });

  const currentEntry = transactionResult.snapshot.val() || null;
  const saved = transactionResult.committed;

  // Every actual roll can still appear in the observer feed, even when it does
  // not beat the player's leaderboard high score.
  const liveKey = database.ref('liveRolls').push().key;
  await database.ref(`liveRolls/${liveKey}`).set({
    id: liveKey,
    userId,
    playerName: entry.playerName,
    timestamp: entry.timestamp,
    meltDamage: entry.meltDamage,
    rarity: entry.rarity,
  });

  return {
    saved,
    userId,
    leaderboardEntry: currentEntry,
  };
}

export function getDatabase() {
  return database;
}
