import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface State { hasError: boolean; error: string }

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
  screenName?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.screenName || 'unknown'}] caught:`, error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning-outline" size={40} color="#FF453A" />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage || 'An unexpected error occurred in this screen.'}
          </Text>
          {this.state.error ? (
            <Text style={{ color: '#FF453A', fontSize: 12, padding: 10, backgroundColor: '#FF453A10', borderRadius: 8, marginTop: 8, marginBottom: 16, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
              {this.state.error}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: '' })}
            accessibilityLabel="Try again"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

/**
 * HOC to wrap any screen with an error boundary.
 * Usage: export default withErrorBoundary(MyScreen, 'MyScreen');
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  screenName?: string,
): React.ComponentType<P> {
  return function WrappedWithBoundary(props: P) {
    return (
      <ErrorBoundary screenName={screenName} fallbackMessage={`${screenName || 'This screen'} encountered an error. Tap to retry.`}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080A0E', alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#FF453A18', borderWidth: 1, borderColor: '#FF453A30', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  message: { color: '#8E8E93', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn: { backgroundColor: '#32D74B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 15 },
});
