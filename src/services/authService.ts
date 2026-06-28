import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  sendEmailVerification,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Platform } from 'react-native';

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  avatarColor: string;
  photoURL?: string;
  createdAt: any;
  isPremium?: boolean;
}

export type PrivateUserProfile = {
  uid: string;
  email: string;
  // device tokens / timestamps are written by fcmService
  fcmTokens?: Record<string, string>;
  lastSeen?: string;
};

function privateUserDoc(uid: string) {
  return doc(db, 'usersPrivate', uid);
}

// Sanitize user-provided text to strip HTML/dangerous characters
function sanitizeText(input: string, maxLength: number): string {
  return input
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/[<>&"']/g, '')           // strip dangerous chars
    .trim()
    .slice(0, maxLength);
}

// Generate a deterministic avatar color from a string
export function avatarColor(str: string): string {
  const colors = ['#32D74B', '#0A84FF', '#FF9F0A', '#FF453A', '#64D2B2', '#AF52DE', '#FF6B6B', '#FFD60A'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  username: string,
  bio: string,
  imageUri?: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  // If image provided, upload it
  if (imageUri) {
    try {
      await uploadProfileImage(cred.user.uid, imageUri);
    } catch (e) {
      console.error('Error uploading profile image during registration:', e);
      // Don't fail registration if only image upload fails
    }
  }

  // SEND VERIFICATION EMAIL
  await sendEmailVerification(cred.user);

  const safeUsername = sanitizeText(username, 30);
  const safeBio = sanitizeText(bio, 160);

  const profile: UserProfile = {
    uid: cred.user.uid,
    displayName,
    username: safeUsername,
    bio: safeBio,
    avatarColor: avatarColor(cred.user.uid),
    createdAt: serverTimestamp(),
  };

  // Public profile (readable by other users)
  await setDoc(doc(db, 'users', cred.user.uid), profile);
  // Private profile (owner-only; contains sensitive fields like email)
  await setDoc(privateUserDoc(cred.user.uid), { uid: cred.user.uid, email } satisfies PrivateUserProfile, { merge: true });
  return cred.user;
}

export async function loginUser(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function reloadUser() {
  if (auth.currentUser) {
    await auth.currentUser.reload();
  }
  return auth.currentUser;
}

export async function logoutUser() {
  try {
    const logoutPromise = signOut(auth);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Logout timed out')), 6000)
    );
    await Promise.race([logoutPromise, timeoutPromise]);
  } catch (e) {
    console.error('logoutUser: Error signing out:', e);
    throw e;
  }
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUserProfile(uid: string, patch: Partial<UserProfile>) {
  await setDoc(doc(db, 'users', uid), patch, { merge: true });
}

export async function uploadProfileImage(uid: string, uri: string): Promise<string> {
  // Compress and resize to max 300×300 before storing as base64 in Firestore
  // (Firebase Storage requires Blaze plan — we use Firestore instead, free tier)
  let processedUri = uri;
  try {
    const ImageManipulator = require('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 300, height: 300 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
    processedUri = result.uri;
  } catch {
    // Native module not available — use original
  }

  // Convert to base64 data URI for Firestore storage
  const response = await fetch(processedUri);
  const blob = await response.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Store base64 in Firestore user document
  await updateUserProfile(uid, { photoURL: base64 });

  // Update Firebase Auth profile with a placeholder (Auth doesn't accept base64)
  // We use the Firestore value everywhere in the app via profile.photoURL
  if (auth.currentUser) {
    try {
      await updateProfile(auth.currentUser, { photoURL: `data:image/jpeg;base64,profile_${uid}` });
    } catch {}
  }

  return base64;
}
