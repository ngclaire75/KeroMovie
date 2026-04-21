import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider, appleProvider } from './firebase';

const USERS = 'users';

// ── Save profile to Firestore ────────────────────────────────
async function saveProfile(user, extra = {}) {
  const ref = doc(db, USERS, user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:       user.uid,
      email:     user.email,
      firstName: extra.firstName || user.displayName?.split(' ')[0] || '',
      lastName:  extra.lastName  || user.displayName?.split(' ').slice(1).join(' ') || '',
      username:  extra.username  || user.email.split('@')[0],
      photoURL:  user.photoURL   || '',
      provider:  extra.provider  || 'email',
      createdAt: new Date().toISOString(),
    });
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
  await sendEmailVerification(cred.user, {
    url: `${window.location.origin}/login`,
  });
  await auth.signOut();
  return cred.user;
}

// ── Sign In ──────────────────────────────────────────────────
export async function signIn({ email, password }) {
  const methods = await fetchSignInMethodsForEmail(auth, email);
  if (methods.length === 0) throw new Error('NO_ACCOUNT');

  const cred = await signInWithEmailAndPassword(auth, email, password);

  if (!cred.user.emailVerified) {
    await auth.signOut();
    throw new Error('NOT_VERIFIED');
  }
  return cred.user;
}

// ── Google Sign In ───────────────────────────────────────────
export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await saveProfile(cred.user, { provider: 'google' });
  return cred.user;
}

// ── Apple Sign In ────────────────────────────────────────────
export async function signInWithApple() {
  const cred = await signInWithPopup(auth, appleProvider);
  const firstName = cred.user.displayName?.split(' ')[0] || '';
  const lastName  = cred.user.displayName?.split(' ').slice(1).join(' ') || '';
  await saveProfile(cred.user, { firstName, lastName, provider: 'apple' });
  return cred.user;
}

// ── Forgot Password ──────────────────────────────────────────
export async function forgotPassword(email) {
  const methods = await fetchSignInMethodsForEmail(auth, email);
  if (methods.length === 0) throw new Error('NO_ACCOUNT');
  await sendPasswordResetEmail(auth, email, {
    url: `${window.location.origin}/login`,
  });
}

// ── Forgot Username ──────────────────────────────────────────
export async function forgotUsername(email) {
  const q = query(collection(db, USERS), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('NO_ACCOUNT');
  const profile = snap.docs[0].data();
  return profile.username;
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
