import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence,
  GoogleAuthProvider
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey:            "AIzaSyB6PY7eXSH7Vj3j4v4X0H4kDdAI8hes46Y",
  authDomain:        "runquest-app-75bc8.firebaseapp.com",
  projectId:         "runquest-app-75bc8",
  storageBucket:     "runquest-app-75bc8.firebasestorage.app",
  messagingSenderId: "585105623148",
  appId:             "1:585105623148:web:2000bf97ca5adba40a7049",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize auth natively without breaking Metro bundler for HTML/React Native
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
