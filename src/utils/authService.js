const auth = window.firebase.auth();
const db = window.firebase.database();

export function getAuth() { return auth; }
export function getCurrentUser() { return auth.currentUser; }
export function getCurrentUserId() { return auth.currentUser?.uid || ''; }
export function getCurrentDisplayName() { return String(auth.currentUser?.displayName || '').trim(); }
export function subscribeAuth(onUser, onError) { return auth.onAuthStateChanged(onUser, onError); }
