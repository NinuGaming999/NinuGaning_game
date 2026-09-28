const GAME_FIREBASE_CONFIG = {
  // Existing game/data Firebase project.
  apiKey: import.meta.env.VITE_GAME_FIREBASE_API_KEY || 'AIzaSyBMbVLUSuDwRsrZ91-XC-sl1jofX4Y4Jyk',
  authDomain: import.meta.env.VITE_GAME_FIREBASE_AUTH_DOMAIN || 'arlecchino-artifact-simulator.firebaseapp.com',
  databaseURL: import.meta.env.VITE_GAME_FIREBASE_DATABASE_URL || 'https://arlecchino-artifact-simulator-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_GAME_FIREBASE_PROJECT_ID || 'arlecchino-artifact-simulator',
  storageBucket: import.meta.env.VITE_GAME_FIREBASE_STORAGE_BUCKET || 'arlecchino-artifact-simulator.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_GAME_FIREBASE_MESSAGING_SENDER_ID || '158736907187',
  appId: import.meta.env.VITE_GAME_FIREBASE_APP_ID || '1:158736907187:web:2de2dbf29362c9307fa9c6',
  measurementId: import.meta.env.VITE_GAME_FIREBASE_MEASUREMENT_ID || 'G-YTF5XGNW11',
};

const AUTH_FIREBASE_CONFIG = {
  // Separate authentication Firebase project.
  apiKey: import.meta.env.VITE_AUTH_FIREBASE_API_KEY || 'AIzaSyA8ko8Gs06wvRq2oaG-gKB2RyMOa7UXSQo',
  authDomain: import.meta.env.VITE_AUTH_FIREBASE_AUTH_DOMAIN || 'test-for-login-macanism.firebaseapp.com',
  projectId: import.meta.env.VITE_AUTH_FIREBASE_PROJECT_ID || 'test-for-login-macanism',
  appId: import.meta.env.VITE_AUTH_FIREBASE_APP_ID || '',
};

if (!window.firebase) {
  throw new Error('Firebase SDK was not loaded.');
}

if (!AUTH_FIREBASE_CONFIG.appId) {
  throw new Error(
    'Missing VITE_AUTH_FIREBASE_APP_ID. Copy the App ID from Firebase Console → Project Settings → Your apps → Web app.'
  );
}

const gameApp = window.firebase.apps.find((item) => item.name === '[DEFAULT]')
  || window.firebase.initializeApp(GAME_FIREBASE_CONFIG);

const loginApp = window.firebase.apps.find((item) => item.name === 'loginProject')
  || window.firebase.initializeApp(AUTH_FIREBASE_CONFIG, 'loginProject');

if (!window.firebase.auth) {
  throw new Error('Firebase Auth SDK was not loaded.');
}

export const gameAuth = window.firebase.auth(gameApp);
export const loginAuth = window.firebase.auth(loginApp);

const database = window.firebase.database(gameApp);
const LEADERBOARD_LIMIT = 200;
const LIVE_ROLL_LIMIT = 30;

// Backward-compatible alias. Game data must use the game project's Auth state.
export const auth = gameAuth;

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

  const transactionResult = await userRef.transaction((current) => {
    if (!current) return submittedEntry;

    const oldScore = Number(current.meltDamage) || 0;
    const newScore = Number(entry.meltDamage) || 0;

    if (newScore <= oldScore) return;
    return submittedEntry;
  });

  const currentEntry = transactionResult.snapshot.val() || null;
  const saved = transactionResult.committed;

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
