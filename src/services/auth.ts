import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Single Firebase App instance
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Desired Google Drive scopes (readonly for full drive browsing & search, file for creating non-destructive CLIENT SELECTED folder)
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
// Prompt selection if needed
provider.setCustomParameters({
  prompt: 'select_account',
  access_type: 'online',
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// In-memory cache for the access token
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number | null = null;

export class TokenExpiredError extends Error {
  constructor(message = 'Google Drive access token has expired or is invalid. Please reconnect.') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export const isTokenExpired = (): boolean => {
  if (!cachedAccessToken) return true;
  if (tokenExpiresAt && Date.now() > tokenExpiresAt) return true;
  return false;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token might need re-prompt if page reloads
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get Google Drive access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    tokenExpiresAt = Date.now() + 3500 * 1000;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  tokenExpiresAt = token ? Date.now() + 3500 * 1000 : null;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  tokenExpiresAt = null;
};
