import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Single Firebase App instance
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Desired Google Drive scopes (readonly for full drive browsing & search, file for creating non-destructive CLIENT SELECTED folder)
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

// Persistent storage keys for Google Drive access token
const STORAGE_KEY_TOKEN = 'rcfoto_gdrive_access_token_v2';
const STORAGE_KEY_EXPIRES = 'rcfoto_gdrive_token_expires_at_v2';
const STORAGE_KEY_USER_EMAIL = 'rcfoto_gdrive_user_email_v2';

export const createGoogleProvider = (forceAccountSelect = false) => {
  const p = new GoogleAuthProvider();
  SCOPES.forEach((scope) => p.addScope(scope));
  p.setCustomParameters({
    access_type: 'offline',
    // Only prompt account selection if explicitly requested (e.g. switching accounts)
    // Avoid prompting 'select_account' every time, which breaks session continuity!
    ...(forceAccountSelect ? { prompt: 'select_account' } : {}),
  });
  return p;
};

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

/**
 * Retrieve saved token from localStorage if not expired
 */
export const getSavedAccessToken = (): { token: string; expiresAt: number } | null => {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const expiresAtStr = localStorage.getItem(STORAGE_KEY_EXPIRES);
    if (!token || !expiresAtStr) return null;

    const expiresAt = parseInt(expiresAtStr, 10);
    // Buffer of 2 minutes to prevent using token on the brink of expiration
    if (Date.now() > expiresAt - 120000) {
      return null;
    }
    return { token, expiresAt };
  } catch {
    return null;
  }
};

/**
 * Persist access token to localStorage and in-memory cache
 */
export const persistAccessToken = (token: string, expiresInSeconds = 3500, email?: string | null) => {
  cachedAccessToken = token;
  tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_EXPIRES, String(tokenExpiresAt));
    if (email) {
      localStorage.setItem(STORAGE_KEY_USER_EMAIL, email);
    }
  } catch (err) {
    console.warn('Could not persist access token to localStorage:', err);
  }
};

/**
 * Clear saved access token from memory and localStorage
 */
export const clearSavedAccessToken = () => {
  cachedAccessToken = null;
  tokenExpiresAt = null;
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_EXPIRES);
    localStorage.removeItem(STORAGE_KEY_USER_EMAIL);
  } catch {}
};

export const isTokenExpired = (): boolean => {
  if (cachedAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 120000) {
    return false;
  }
  const saved = getSavedAccessToken();
  if (saved) {
    cachedAccessToken = saved.token;
    tokenExpiresAt = saved.expiresAt;
    return false;
  }
  return true;
};

export interface PhotographerDriveConnection {
  uid: string;
  email: string | null;
  displayName: string | null;
  driveConnected: boolean;
  lastConnectedAt: string;
  scopes: string[];
}

export const savePhotographerDriveConnection = async (user: User): Promise<void> => {
  try {
    const userDocRef = doc(db, 'photographerProfiles', user.uid);
    await setDoc(
      userDocRef,
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        driveConnected: true,
        lastConnectedAt: new Date().toISOString(),
        scopes: SCOPES,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not save photographer drive connection profile to Firestore:', err);
  }
};

export const getPhotographerDriveConnection = async (
  uid: string
): Promise<PhotographerDriveConnection | null> => {
  try {
    const userDocRef = doc(db, 'photographerProfiles', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as PhotographerDriveConnection;
    }
  } catch (err) {
    console.warn('Could not fetch photographer drive profile from Firestore:', err);
  }
  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Pre-hydrate token from localStorage on initial startup
  const saved = getSavedAccessToken();
  if (saved) {
    cachedAccessToken = saved.token;
    tokenExpiresAt = saved.expiresAt;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // User is authenticated with Firebase
      const activeToken = getAccessToken();
      if (activeToken) {
        if (onAuthSuccess) onAuthSuccess(user, activeToken);
      } else {
        // User is logged in to Firebase, but Google Drive token has expired or requires renewal
        // Keep the user authenticated so they don't get kicked out!
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      clearSavedAccessToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (
  forceAccountSelect = false
): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider(forceAccountSelect);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get Google Drive access token from Google');
    }

    // Persist token in localStorage with ~1 hour validity
    persistAccessToken(credential.accessToken, 3500, result.user.email);

    // Save photographer connection profile
    await savePhotographerDriveConnection(result.user);

    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  if (cachedAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 120000) {
    return cachedAccessToken;
  }
  const saved = getSavedAccessToken();
  if (saved) {
    cachedAccessToken = saved.token;
    tokenExpiresAt = saved.expiresAt;
    return saved.token;
  }
  return null;
};

export const setAccessToken = (token: string | null) => {
  if (token) {
    persistAccessToken(token, 3500);
  } else {
    clearSavedAccessToken();
  }
};

export const logout = async () => {
  await signOut(auth);
  clearSavedAccessToken();
};
