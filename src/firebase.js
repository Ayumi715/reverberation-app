import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'reverberation-60f82.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'reverberation-60f82',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'reverberation-60f82.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '67631437602',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.appId);
export const db = isFirebaseConfigured ? getFirestore(app) : null;
