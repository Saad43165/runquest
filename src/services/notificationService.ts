import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import { ToastService } from './ToastService';

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
   * Send a notification — shows an in-app toast if app is active,
   * or a system tray notification if app is in background.
   */
  async notify(title: string, body: string, data: any = {}) {
    // Determine toast type from emoji/keywords in title
    const t = title.toLowerCase();
    const type =
      t.includes('⚔️') || t.includes('conquered') || t.includes('invaded') ? 'conquest' :
      t.includes('🏆') || t.includes('claimed') || t.includes('expanded') ? 'success' :
      t.includes('achievement') || t.includes('medal') ? 'achievement' :
      t.includes('⚠') || t.includes('paused') || t.includes('warning') ? 'warning' :
      t.includes('✓') || t.includes('lap') || t.includes('complete') ? 'success' :
      'info';

    // Strip emoji from title for the toast (they're implied by the color/icon)
    const cleanTitle = title.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}⚔️🏆🥇🥈🥉⚠️✓⏸🏃]/gu, '').trim();

    // In-app toast when foregrounded
    if (AppState.currentState === 'active') {
      ToastService.show({ title: cleanTitle || title, message: body, type: type as any });
      return; // Don't double-notify with a system alert
    }

    // System notification when app is backgrounded
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null,
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
