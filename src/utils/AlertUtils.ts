import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  style?: 'default' | 'destructive' | 'cancel';
}

/**
 * A platform-aware confirmation utility.
 * On Native: Uses Alert.alert.
 * On Web: Uses window.confirm.
 */
export const confirmAction = ({
  title,
  message,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  style = 'default',
}: ConfirmOptions) => {
  if (Platform.OS === 'web') {
    // Web: Standard browser confirm dialog
    const confirmed = (globalThis as any).confirm?.(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    }
  } else {
    // Native: Professional React Native Alert
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel' },
      { 
        text: confirmText, 
        style: style === 'destructive' ? 'destructive' : 'default', 
        onPress: onConfirm 
      },
    ]);
  }
};
