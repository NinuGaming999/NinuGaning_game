const auth = window.firebase.auth();
const db = window.firebase.database();

auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

export function getAuth() { return auth; }
export function getCurrentUser() { return auth.currentUser; }
export function getCurrentUserId() { return auth.currentUser?.uid || ''; }
export function getCurrentDisplayName() { return String(auth.currentUser?.displayName || '').trim(); }
export function subscribeAuth(onUser, onError) { return auth.onAuthStateChanged(onUser, onError); }

export async function registerAccount({ email, password, displayName }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(displayName || '').trim().replace(/[\n\r]/g, '').slice(0, 30);
  if (!cleanName || cleanName.length < 2) throw new Error('Display name must be at least 2 characters.');
  if (!cleanEmail) throw new Error('Email is required.');
  if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters.');

  const result = await auth.createUserWithEmailAndPassword(cleanEmail, password);
  const user = result.user;
  await user.updateProfile({ displayName: cleanName });
  await db.ref(`profiles/${user.uid}`).set({
    uid: user.uid,
    displayName: cleanName,
    email: cleanEmail,
    createdAt: window.firebase.database.ServerValue.TIMESTAMP,
  });
  await user.sendEmailVerification();
  await auth.signOut();
  return { verificationSent: true };
}

export async function signInAccount({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const result = await auth.signInWithEmailAndPassword(cleanEmail, password);
  await result.user.reload();
  if (!auth.currentUser?.emailVerified) {
    try { await auth.currentUser?.sendEmailVerification(); } catch {}
    await auth.signOut();
    const error = new Error('Please verify your email before signing in. A new verification email was sent.');
    error.code = 'auth/email-not-verified';
    throw error;
  }
  return auth.currentUser;
}

export async function resendVerification() {
  if (!auth.currentUser) throw new Error('No signed-in account.');
  await auth.currentUser.sendEmailVerification();
}

export async function signOutAccount() {
  await auth.signOut();
}

export async function sendPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  await auth.sendPasswordResetEmail(cleanEmail);
}

export async function reloadCurrentUser() {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  return auth.currentUser;
}
