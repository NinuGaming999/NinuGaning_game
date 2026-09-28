import {
  gameAuth,
  loginAuth,
  getDatabase,
  getUserIdFromName,
} from './firebaseService';

const db = getDatabase();

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 8;

const googleProvider = new window.firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const AUTH_BRIDGE_URL = import.meta.env.VITE_AUTH_BRIDGE_URL || '/api/auth/exchange';

// ---------- friendly errors ----------

const ERROR_TEXT = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in, or use Google.',
  'auth/weak-password': `Password must be at least ${PASSWORD_MIN} characters.`,
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in window was closed before finishing.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'The sign-in popup was blocked.',
  'auth/account-exists-with-different-credential': 'This email is already registered with another sign-in method.',
  'auth/unauthorized-domain': 'This website address is not authorized in the Authentication project.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in the Authentication project.',
  'auth/game-bridge-failed': 'Login succeeded, but the secure game-session bridge is not configured correctly yet.',
};

export function friendlyError(error) {
  if (error?.userMessage) return error.userMessage;
  return ERROR_TEXT[error?.code] || error?.message || 'Something went wrong. Please try again.';
}

function userError(message) {
  const e = new Error(message);
  e.userMessage = message;
  return e;
}

// ---------- cross-project session bridge ----------

export async function exchangeForGameSession() {
  const sourceUser = loginAuth.currentUser;
  if (!sourceUser) return null;

  const idToken = await sourceUser.getIdToken(true);

  let response;
  try {
    response = await fetch(AUTH_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ idToken }),
    });
  } catch {
    const error = new Error('Authentication bridge request failed.');
    error.code = 'auth/game-bridge-failed';
    throw error;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Keep the generic bridge error below.
  }

  if (!response.ok || !payload?.customToken) {
    const error = new Error(payload?.error || 'Authentication bridge rejected the session.');
    error.code = 'auth/game-bridge-failed';
    throw error;
  }

  const credential = await gameAuth.signInWithCustomToken(payload.customToken);
  return credential.user;
}

// ---------- session ----------

export function onAuthChange(callback) {
  // Source of truth for login/verification is the dedicated Auth project.
  return loginAuth.onAuthStateChanged(callback);
}

export async function signInWithGoogle() {
  try {
    return await loginAuth.signInWithPopup(googleProvider);
  } catch (error) {
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      return loginAuth.signInWithRedirect(googleProvider);
    }
    throw error;
  }
}

export function completeRedirectSignIn() {
  return loginAuth.getRedirectResult().catch(() => null);
}

export async function signUpWithEmail(email, password) {
  if (String(password).length < PASSWORD_MIN) {
    throw userError(`Password must be at least ${PASSWORD_MIN} characters.`);
  }

  const cred = await loginAuth.createUserWithEmailAndPassword(
    String(email).trim(),
    password
  );

  await cred.user.sendEmailVerification();
  return cred.user;
}

export function signInWithEmail(email, password) {
  return loginAuth.signInWithEmailAndPassword(String(email).trim(), password);
}

export function sendResetEmail(email) {
  return loginAuth.sendPasswordResetEmail(String(email).trim());
}

export function resendVerification() {
  if (!loginAuth.currentUser) throw userError('You are signed out.');
  return loginAuth.currentUser.sendEmailVerification();
}

export async function refreshCurrentUser() {
  const user = loginAuth.currentUser;
  if (!user) return null;

  await user.reload();
  if (loginAuth.currentUser?.emailVerified) {
    await exchangeForGameSession();
  }
  return loginAuth.currentUser;
}

export async function signOutUser() {
  await Promise.allSettled([
    loginAuth.signOut(),
    gameAuth.signOut(),
  ]);
}

// ---------- usernames ----------

export function normalizeUsername(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

export function validateUsername(raw) {
  const name = normalizeUsername(raw);
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters.`;
  }
  if (!/^[\p{L}\p{N} _-]+$/u.test(name)) {
    return 'Use letters, numbers, spaces, - or _ only.';
  }
  return '';
}

export async function readUsername(uid) {
  const snap = await db.ref(`users/${uid}/username`).once('value');
  return snap.val() || '';
}

export async function isUsernameFree(raw) {
  const key = getUserIdFromName(normalizeUsername(raw));
  const snap = await db.ref(`usernames/${key}`).once('value');
  return !snap.exists();
}

export async function claimUsername(user, raw) {
  const problem = validateUsername(raw);
  if (problem) throw userError(problem);

  const name = normalizeUsername(raw);
  const key = getUserIdFromName(name);
  const claimRef = db.ref(`usernames/${key}`);

  const existing = (await claimRef.once('value')).val();
  if (existing && existing !== user.uid) throw userError('That username is already taken.');

  if (!existing) {
    try {
      await claimRef.set(user.uid);
    } catch {
      throw userError('Could not claim that username. It may have just been taken, or your email is not verified yet.');
    }
  }

  try {
    const profile = (await db.ref(`users/${user.uid}`).once('value')).val() || {};
    if (profile.usernameKey && profile.usernameKey !== key) {
      throw userError('This account already has a username.');
    }
    if (!profile.usernameKey) await db.ref(`users/${user.uid}/usernameKey`).set(key);
    if (!profile.username) await db.ref(`users/${user.uid}/username`).set(name);
  } catch (error) {
    if (error?.userMessage) throw error;
    throw userError('Could not save your username. Please try again.');
  }
  return name;
}
