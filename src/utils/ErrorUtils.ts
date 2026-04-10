/**
 * Replaces technical Firebase/System error codes with professional, 
 * human-readable messages tailored for the RunQuest experience.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = error.code || error.message || '';

  // Auth Errors
  if (code.includes('auth/invalid-email')) return 'Please check your email address format.';
  if (code.includes('auth/user-not-found')) return 'No account found with this email.';
  if (code.includes('auth/wrong-password')) return 'Incorrect password. Please try again.';
  if (code.includes('auth/email-already-in-use')) return 'This email is already registered. Try signing in.';
  if (code.includes('auth/weak-password')) return 'Password should be at least 6 characters.';
  if (code.includes('auth/network-request-failed')) return 'Network error. Please check your internet connection.';
  if (code.includes('auth/too-many-requests')) return 'Too many attempts. Please try again later.';
  if (code.includes('auth/user-disabled')) return 'This account has been disabled.';
  if (code.includes('auth/operation-not-allowed')) return 'Email/Password sign-in is not enabled.';
  
  // Custom Service Errors
  if (code.includes('Logout timed out')) return 'Sign out is taking longer than expected. Please check your connection.';
  if (code.includes('Google Login on mobile requires additional native configuration')) {
    return 'Google Login is currently available on the Web version. Please use Email/Password for the mobile app.';
  }

  // Permission Errors
  if (code.includes('location permission denied')) return 'Location access is required to track your run. Please enable it in settings.';
  if (code.includes('firestore/permission-denied')) return 'You do not have permission to modify this territory.';

  // Default fallback
  const cleanMsg = typeof code === 'string' ? code.replace('Firebase: ', '').replace('Error (', '').replace(').', '') : 'Unknown error';
  return `Something went wrong: ${cleanMsg}`;
};
