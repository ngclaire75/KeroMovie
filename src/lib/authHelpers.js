import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc,
  query, collection, where, getDocs,
} from 'firebase/firestore';
import { auth, db, googleProvider, appleProvider } from './firebase';

const USERS = 'users';

// ── Save profile to Firestore ────────────────────────────────
async function saveProfile(user, extra = {}) {
  const ref  = doc(db, USERS, user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:       user.uid,
      email:     user.email,
      firstName: extra.firstName || user.displayName?.split(' ')[0] || '',
      lastName:  extra.lastName  || user.displayName?.split(' ').slice(1).join(' ') || '',
      username:  extra.username  || user.email?.split('@')[0] || '',
      photoURL:  user.photoURL   || '',
      provider:  extra.provider  || 'email',
      createdAt: new Date().toISOString(),
    });
  }
}

// ── Check redirect result on page load ──────────────────────
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    await saveProfile(result.user, {
      provider: result.providerId?.includes('apple') ? 'apple' : 'google',
    });
    return result.user;
  } catch (err) {
    if (err.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorised in Firebase. Add it under Authentication → Settings → Authorized domains.');
    }
    if (err.message?.toLowerCase().includes('illegal') || err.message?.toLowerCase().includes('iframe')) {
      throw new Error('Redirection not found.');
    }
    throw err;
  }
}

// ── Sign Up ──────────────────────────────────────────────────
export async function signUp({ firstName, lastName, username, email, password }) {
  // Check username taken
  const uq = query(collection(db, USERS), where('username', '==', username));
  const us = await getDocs(uq);
  if (!us.empty) throw new Error('Username already taken. Please choose another.');

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await saveProfile(cred.user, { firstName, lastName, username, provider: 'email' });
  await sendEmailVerification(cred.user, { url: `${window.location.origin}/login` });
  await auth.signOut();
}

// ── Sign In ──────────────────────────────────────────────────
export async function signIn({ email, password }) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      await auth.signOut();
      throw new Error('NOT_VERIFIED');
    }
    return cred.user;
  } catch (err) {
    if (err.message === 'NOT_VERIFIED') throw err;
    if (
      err.code === 'auth/user-not-found'   ||
      err.code === 'auth/invalid-email'    ||
      err.code === 'auth/invalid-credential'
    ) throw new Error('NO_ACCOUNT');
    if (err.code === 'auth/wrong-password') throw new Error('WRONG_PASSWORD');
    throw err;
  }
}

function normaliseOAuthError(err) {
  if (err.code === 'auth/unauthorized-domain') {
    throw new Error('This domain is not authorised in Firebase. Add it under Authentication → Settings → Authorized domains.');
  }
  const msg = err.message?.toLowerCase() ?? '';
  if (msg.includes('illegal') || msg.includes('iframe')) {
    throw new Error('Redirection not found.');
  }
  throw err;
}

// ── Google Sign In ───────────────────────────────────────────
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await saveProfile(result.user, { provider: 'google' });
    return result.user;
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    normaliseOAuthError(err);
  }
}

// ── Apple Sign In ────────────────────────────────────────────
export async function signInWithApple() {
  try {
    const result = await signInWithPopup(auth, appleProvider);
    await saveProfile(result.user, { provider: 'apple' });
    return result.user;
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, appleProvider);
      return null;
    }
    normaliseOAuthError(err);
  }
}

// ── Forgot Password ──────────────────────────────────────────
export async function forgotPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: `${window.location.origin}/login`,
    });
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
      throw new Error('NO_ACCOUNT');
    }
    throw err;
  }
}

// ── Forgot Username ──────────────────────────────────────────
export async function forgotUsername(email) {
  const q    = query(collection(db, USERS), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('NO_ACCOUNT');
  return snap.docs[0].data().username;
}

// ── Get Profile ──────────────────────────────────────────────
export async function getProfile(uid) {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? snap.data() : null;
}

// ── Resend Verification ──────────────────────────────────────
export async function resendVerification(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user, { url: `${window.location.origin}/login` });
  await auth.signOut();
}
