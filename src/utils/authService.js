import { auth, getDatabase, getUserIdFromName } from './firebaseService';

const db = getDatabase();

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 8;

// ---------- friendly errors ----------

const ERROR_TEXT = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/weak-password': `Password must be at least ${PASSWORD_MIN} characters.`,
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/unauthorized-domain': 'This website address is not authorized in Firebase (Authentication → Settings → Authorized domains).',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase (Authentication → Sign-in method).',
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

// ---------- session ----------

export function onAuthChange(callback) {
  return auth.onAuthStateChanged(callback);
}

export async function signUpWithEmail(email, password) {
  if (String(password).length < PASSWORD_MIN) {
    throw userError(`Password must be at least ${PASSWORD_MIN} characters.`);
  }

  const cred = await auth.createUserWithEmailAndPassword(String(email).trim(), password);
  await cred.user.sendEmailVerification();
  return cred.user;
}

export function signInWithEmail(email, password) {
  return auth.signInWithEmailAndPassword(String(email).trim(), password);
}

export function sendResetEmail(email) {
  return auth.sendPasswordResetEmail(String(email).trim());
}

export function resendVerification() {
  if (!auth.currentUser) throw userError('You are signed out.');
  return auth.currentUser.sendEmailVerification();
}

// Re-reads the account and refreshes the ID token so the database rules see
// email_verified = true right after the player clicks the verification link.
export async function refreshCurrentUser() {
  const user = auth.currentUser;
  if (!user) return null;

  await user.reload();
  await user.getIdToken(true);
  return auth.currentUser;
}

export function signOutUser() {
  return auth.signOut();
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

// Claims a username for this account. The first account to claim a name owns
// it forever; database rules stop other accounts from writing that name's records.
export async function claimUsername(user, raw) {
  const problem = validateUsername(raw);
  if (problem) throw userError(problem);

  const name = normalizeUsername(raw);
  const key = getUserIdFromName(name);
  const claimRef = db.ref(`usernames/${key}`);

  const existing = (await claimRef.once('value')).val();
  if (existing && existing !== user.uid) {
    throw userError('That username is already taken.');
  }

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

    if (!profile.usernameKey) {
      await db.ref(`users/${user.uid}/usernameKey`).set(key);
    }

    if (!profile.username) {
      await db.ref(`users/${user.uid}/username`).set(name);
    }
  } catch (error) {
    if (error?.userMessage) throw error;
    throw userError('Could not save your username. Please try again.');
  }

  return name;
}
