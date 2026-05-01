import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, OAuthProvider,
  browserLocalPersistence, browserSessionPersistence, inMemoryPersistence,
  setPersistence,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// iOS Safari restricts IndexedDB/localStorage — fall back gracefully
setPersistence(auth, browserLocalPersistence).catch(() =>
  setPersistence(auth, browserSessionPersistence).catch(() =>
    setPersistence(auth, inMemoryPersistence).catch(() => {})
  )
);

// Force long polling (HTTP) — WebSocket connections are unreliable on Vercel CDN
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const googleProvider = new GoogleAuthProvider();
export const appleProvider  = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
