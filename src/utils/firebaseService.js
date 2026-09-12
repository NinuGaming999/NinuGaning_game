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

function normalizeSnapshot(snapshot) {
  const value = snapshot.val() || {};
  return Object.entries(value).map(([key, entry]) => ({
    ...entry,
    id: entry?.id || key,
  }));
}

export function subscribeToLeaderboard(onData, onError) {
  const ref = database.ref('leaderboard').limitToLast(LEADERBOARD_LIMIT);
  const handler = (snapshot) => onData(normalizeSnapshot(snapshot));
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

export function subscribeToLiveRolls(onData, onError) {
  const ref = database.ref('liveRolls').limitToLast(LIVE_ROLL_LIMIT);
  const handler = (snapshot) => onData(normalizeSnapshot(snapshot));
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}

export async function saveRoll(entry) {
  const key = entry.id || database.ref('leaderboard').push().key;
  const leaderboardEntry = { ...entry, id: key };
  const liveEntry = {
    id: key,
    playerName: entry.playerName,
    timestamp: entry.timestamp,
    meltDamage: entry.meltDamage,
    rarity: entry.rarity,
  };

  // Push to separate paths in one atomic multi-location update. Unlike the old
  // JSONBin read-modify-write flow, simultaneous users cannot overwrite each other.
  await database.ref().update({
    [`leaderboard/${key}`]: leaderboardEntry,
    [`liveRolls/${key}`]: liveEntry,
  });
}

export function getDatabase() {
  return database;
}
