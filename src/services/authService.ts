import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  signInWithCredential as FirebaseAuthSignInWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { Platform, NativeModules } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const isGoogleSigninAvailable = !!NativeModules.RNGoogleSignin;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  bio: string;
  avatarColor: string;
  photoURL?: string;
  createdAt: any;
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

  const profile: UserProfile = {
    uid: cred.user.uid,
    email,
    displayName,
    username,
    bio,
    avatarColor: avatarColor(cred.user.uid),
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', cred.user.uid), profile);
  return cred.user;
}

export async function loginUser(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Call this once at app startup (in App.tsx useEffect)
 */
export function configureGoogleSignin() {
  if (Platform.OS !== 'web' && isGoogleSigninAvailable) {
    GoogleSignin.configure({
      webClientId: '585105623148-f7d6p3ls17fmiti7iktcvl4ft25p3s9j.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }
}

export async function loginWithGoogle() {
  if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    await syncGoogleUserProfile(cred.user);
    return cred.user;
  } else {
    // Native (Android/iOS)
    if (!isGoogleSigninAvailable) {
      throw new Error('Google Sign-In is unavailable in this environment (Expo Go). Please use a standalone build or development client.');
    }
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();

      const idToken = (userInfo as any).data?.idToken || (userInfo as any).idToken;
      if (!idToken) throw new Error('No Google ID Token found');

      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await FirebaseAuthSignInWithCredential(auth, credential);

      await syncGoogleUserProfile(cred.user);
      return cred.user;
    } catch (error: any) {
      console.error('Native Google Login Error:', error);
      // DEVELOPER_ERROR (code 10) means SHA-1 not registered in Firebase
      if (error.code === '10' || error.code === 10 || String(error.message).includes('DEVELOPER_ERROR')) {
        throw new Error(
          'Google Sign-In is not configured for this build. Please use email & password to log in.'
        );
      }
      throw error;
    }
  }
}

async function syncGoogleUserProfile(user: User) {
  const existing = await getUserProfile(user.uid);
  if (!existing) {
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Google User',
      username: (user.email?.split('@')[0] || 'user') + Math.floor(Math.random() * 1000),
      bio: '',
      avatarColor: avatarColor(user.uid),
      photoURL: user.photoURL || undefined,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', user.uid), profile);
  }
}

export async function reloadUser() {
  if (auth.currentUser) {
    await auth.currentUser.reload();
  }
  return auth.currentUser;
}

export async function logoutUser() {
  console.log('logoutUser: Starting sign-out process...');
  try {
    // Add a timeout to prevent hanging indefinitely
    const logoutPromise = signOut(auth);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Logout timed out')), 6000)
    );

    await Promise.race([logoutPromise, timeoutPromise]);
    console.log('logoutUser: Sign-out successful.');
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
  const response = await fetch(uri);
  const blob = await response.blob();
  const fileRef = ref(storage, `avatars/${uid}`);
  
  await uploadBytes(fileRef, blob);
  const downloadURL = await getDownloadURL(fileRef);
  
  // Update both Auth and Firestore
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: downloadURL });
  }
  await updateUserProfile(uid, { photoURL: downloadURL });
  
  return downloadURL;
}
