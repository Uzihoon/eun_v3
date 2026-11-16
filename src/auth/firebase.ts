import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, browserLocalPersistence, setPersistence } from 'firebase/auth';
export const localAuth = import.meta.env.DEV && import.meta.env.MODE === 'emulator' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const config = localAuth ? { apiKey: 'demo-eun-v3', authDomain: 'demo-eun-v3.firebaseapp.com', projectId: 'demo-eun-v3', appId: 'demo-eun-v3' } : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const auth = Object.values(config).every(Boolean) ? getAuth(initializeApp(config)) : null;
if (auth && localAuth) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
export const authReady = auth ? setPersistence(auth, browserLocalPersistence) : Promise.resolve();
export function requireAuth() {
  if (!auth) throw new Error('Sign-in is not available yet. Please try again once EUN is connected.');
  return auth;
}
export function authMessage(error: unknown) {
  const code = (error as { code?: string }).code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.', 'auth/wrong-password': 'The email or password is incorrect.',
    'auth/user-not-found': 'The email or password is incorrect.', 'auth/email-already-in-use': 'An account with this email already exists. Sign in or reset your password.',
    'auth/weak-password': 'Use at least 8 characters for your password.', 'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Could not connect to sign-in. Check your connection and try again.',
    'auth/user-disabled': 'This account is disabled.', 'auth/expired-action-code': 'This link has expired. Request a new one.',
  };
  return messages[code ?? ''] ?? (error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}
