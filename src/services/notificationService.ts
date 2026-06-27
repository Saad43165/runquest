import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ─── Configuration ────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }) as Notifications.NotificationBehavior,
});

/**
 * Service to manage system-level notifications for RunQuest.
 */
export const NotificationService = {
  /**
   * Request permissions from the user.
   */
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('NotificationService: Must use physical device for push notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    // Configure Android channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      
      // Channel for the silent, persistent "live tracking pill"
      await Notifications.setNotificationChannelAsync('runquest-live-run', {
        name: 'Live Run Tracking',
        importance: Notifications.AndroidImportance.LOW, // low importance = no sound/vibration but visible
        sound: null, // explicit no sound
        enableVibrate: false, // explicit no vibrate
        showBadge: false, // don't increment app badge for tracker loop
      });
    }

    return true;
  },

  /**
   * Send a local notification immediately.
   */
  async notify(title: string, body: string, data: any = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Send now
    });
  },

  /**
   * Schedule a notification for some time in the future.
   */
  async schedule(title: string, body: string, seconds: number) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
  },

  /**
   * Cancel all scheduled notifications.
   */
  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
};
