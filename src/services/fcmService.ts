import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Register device for push notifications and store FCM token in Firestore.
 * Call this after user logs in.
 */
export async function registerFCMToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '00f7668c-8d8f-4938-a03f-8fd2e544c9ee',
    });
    const token = tokenData.data;

    // Store token in Firestore under user's document
    const uid = auth.currentUser?.uid;
    if (uid && token) {
      await setDoc(
        doc(db, 'usersPrivate', uid),
        {
          fcmTokens: { [Platform.OS]: token },
          lastSeen: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'RunQuest',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#32D74B',
      });
    }

    return token;
  } catch (e) {
    console.warn('FCM token registration failed:', e);
    return null;
  }
}
