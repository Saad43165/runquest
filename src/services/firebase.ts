import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-ignore
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            || "AIzaSyB6PY7eXSH7Vj3j4v4X0H4kDdAI8hes46Y",
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        || "runquest-app-75bc8.firebaseapp.com",
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         || "runquest-app-75bc8",
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     || "runquest-app-75bc8.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "585105623148",
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             || "1:585105623148:web:2000bf97ca5adba40a7049",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use persistent auth for React Native safely, fallback if already initialized or persistence functions are missing
let auth: any;
try {
  if (getReactNativePersistence) {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } else {
    auth = getAuth(app);
  }
} catch (e) {
  auth = getAuth(app);
}

// Safe Firestore init — use long-polling to avoid WebChannel stream errors in React Native
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, { experimentalForceLongPolling: true });
} catch {
  db = getFirestore(app);
}

const storage = getStorage(app);

export { auth, db, storage };
export default app;
