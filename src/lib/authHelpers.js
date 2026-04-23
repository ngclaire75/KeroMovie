import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc,
  query, collection, where, getDocs,
} from 'firebase/firestore';
import { auth, db, googleProvider, appleProvider } from './firebase';

const USERS = 'users';

// ── Save profile to Firestore ────────────────────────────────
async function saveProfile(user, extra = {}) {
  await setDoc(doc(db, USERS, user.uid), {
    uid:       user.uid,
    email:     user.email,
    firstName: extra.firstName || user.displayName?.split(' ')[0] || '',
    lastName:  extra.lastName  || user.displayName?.split(' ').slice(1).join(' ') || '',
    username:  extra.username  || user.email?.split('@')[0] || '',
    photoURL:  user.photoURL   || '',
    provider:  extra.provider  || 'email',
    createdAt: new Date().toISOString(),
  }, { merge: true });
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
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // Username uniqueness check — skip gracefully if rules deny it
  try {
    const uq = query(collection(db, USERS), where('username', '==', username));
    const us = await getDocs(uq);
    if (!us.empty) {
      await cred.user.delete();
      throw new Error('Username already taken. Please choose another.');
    }
  } catch (checkErr) {
    if (checkErr.message === 'Username already taken. Please choose another.') throw checkErr;
    // Any other error (permission-denied, network) — skip uniqueness check
  }

  // Save profile — if this fails, still sign out but surface the error
  try {
    await saveProfile(cred.user, { firstName, lastName, username, provider: 'email' });
  } catch (profileErr) {
    await auth.signOut();
    throw new Error('Account created but profile could not be saved. Please contact support. (' + (profileErr.code || profileErr.message) + ')');
  }

  await auth.signOut();
}

// ── Sign In ──────────────────────────────────────────────────
export async function signIn({ email, password }) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    // Firebase v9+ consolidates wrong-email and wrong-password into auth/invalid-credential
    if (
      err.code === 'auth/user-not-found'    ||
      err.code === 'auth/wrong-password'    ||
      err.code === 'auth/invalid-email'     ||
      err.code === 'auth/invalid-credential'
    ) throw new Error('INVALID_CREDENTIALS');
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
    // auth/user-not-found (older SDK) or auth/invalid-credential (newer SDK)
    if (
      err.code === 'auth/user-not-found'     ||
      err.code === 'auth/invalid-email'      ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/unauthorized-continue-uri'
    ) {
      // Try again without the continue URL if domain isn't whitelisted
      if (err.code === 'auth/unauthorized-continue-uri') {
        try { await sendPasswordResetEmail(auth, email); return; } catch {}
      }
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


// ── Update Username ──────────────────────────────────────────
export async function updateUsername(uid, newUsername) {
  const uq   = query(collection(db, USERS), where('username', '==', newUsername));
  const snap = await getDocs(uq);
  if (!snap.empty) throw new Error('Username already taken. Please choose another.');
  await updateDoc(doc(db, USERS, uid), { username: newUsername });
}

// ── Update Password (requires current password) ──────────────
export async function updateUserPassword(currentPassword, newPassword) {
  const user       = auth.currentUser;
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

// ── Update Email (requires current password) ─────────────────
export async function updateUserEmail(currentPassword, newEmail) {
  const user       = auth.currentUser;
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updateEmail(user, newEmail);
  await updateDoc(doc(db, USERS, user.uid), { email: newEmail });
}
