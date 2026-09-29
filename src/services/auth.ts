import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInAnonymously,
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

export const createGoogleProvider = (forceAccountSelect = false) => {
  const p = new GoogleAuthProvider();
  SCOPES.forEach((scope) => p.addScope(scope));
  p.setCustomParameters({
    access_type: 'offline',
    ...(forceAccountSelect ? { prompt: 'select_account' } : {}),
  });
  return p;
};

// Exported googleProvider for reusable Google Auth
export const googleProvider = createGoogleProvider();

// Persistent storage keys for Google Drive access token
const STORAGE_KEY_TOKEN = 'rcfoto_gdrive_access_token_v2';
const STORAGE_KEY_EXPIRES = 'rcfoto_gdrive_token_expires_at_v2';
const STORAGE_KEY_USER_EMAIL = 'rcfoto_gdrive_user_email_v2';

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
 * Automatically authenticate client anonymously in the background if no Firebase user exists.
 * Does not show any login UI to the client, ensuring seamless Firestore access.
 */
export const ensureAnonymousAuth = async (): Promise<User | null> => {
  try {
    if (auth.currentUser) {
      return auth.currentUser;
    }
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err: any) {
    console.warn('Anonymous client authentication notice:', err?.message || err);
    return auth.currentUser || null;
  }
};

/**
 * Explicit helper to sign in client anonymously upon app mount or gallery access
 */
export const signInClientAnonymously = async (): Promise<User | null> => {
  return ensureAnonymousAuth();
};

/**
 * Check if the currently signed-in user is an anonymous client
 */
export const isAnonymousClient = (): boolean => {
  return !!auth.currentUser && auth.currentUser.isAnonymous;
};

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
  accessToken?: string;
  tokenExpiresAt?: number;
}

/**
 * Persist Photographer Google Drive credentials to Firestore.
 * This enables persistent Drive connections across different browsers and sessions.
 */
export const savePhotographerDriveConnection = async (
  user: User,
  accessToken?: string,
  expiresInSeconds = 3500
): Promise<void> => {
  try {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const userDocRef = doc(db, 'photographerProfiles', user.uid);
    const dataToSave: PhotographerDriveConnection = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      driveConnected: true,
      lastConnectedAt: new Date().toISOString(),
      scopes: SCOPES,
      ...(accessToken ? { accessToken, tokenExpiresAt: expiresAt } : {}),
    };

    await setDoc(userDocRef, dataToSave, { merge: true });
  } catch (err) {
    console.warn('Could not save photographer drive connection profile to Firestore:', err);
  }
};

/**
 * Retrieve photographer Drive connection and restored token from Firestore
 */
export const getPhotographerDriveConnection = async (
  uid: string
): Promise<PhotographerDriveConnection | null> => {
  try {
    const userDocRef = doc(db, 'photographerProfiles', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data() as PhotographerDriveConnection;
      // If Firestore contains a valid non-expired access token, hydrate local state
      if (data.accessToken && data.tokenExpiresAt && Date.now() < data.tokenExpiresAt - 120000) {
        cachedAccessToken = data.accessToken;
        tokenExpiresAt = data.tokenExpiresAt;
        try {
          localStorage.setItem(STORAGE_KEY_TOKEN, data.accessToken);
          localStorage.setItem(STORAGE_KEY_EXPIRES, String(data.tokenExpiresAt));
        } catch {}
      }
      return data;
    }
  } catch (err) {
    console.warn('Could not fetch photographer drive profile from Firestore:', err);
  }
  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user?: User | null) => void
) => {
  // Pre-hydrate token from localStorage on initial startup
  const saved = getSavedAccessToken();
  if (saved) {
    cachedAccessToken = saved.token;
    tokenExpiresAt = saved.expiresAt;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && !user.isAnonymous) {
      // Admin is authenticated with Firebase Google account
      let activeToken = getAccessToken();

      // If active token not in memory/localStorage, attempt restoring from Firestore
      if (!activeToken) {
        const profile = await getPhotographerDriveConnection(user.uid);
        if (profile?.accessToken && profile.tokenExpiresAt && Date.now() < profile.tokenExpiresAt - 120000) {
          activeToken = profile.accessToken;
        }
      }

      if (onAuthSuccess) onAuthSuccess(user, activeToken || '');
    } else if (user && user.isAnonymous) {
      // Client is authenticated anonymously (no admin access, but active Firestore session)
      if (onAuthFailure) onAuthFailure(user);
    } else {
      clearSavedAccessToken();
      // When no user is detected, auto sign-in anonymously so Firestore requests are always authenticated
      try {
        const anonUser = await ensureAnonymousAuth();
        if (onAuthFailure) onAuthFailure(anonUser);
      } catch (err) {
        console.warn('Auto anonymous authentication notice:', err);
        if (onAuthFailure) onAuthFailure(null);
      }
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

    // Persist token in localStorage
    persistAccessToken(credential.accessToken, 3500, result.user.email);

    // Save photographer connection profile & token to Firestore for cross-browser persistence
    await savePhotographerDriveConnection(result.user, credential.accessToken, 3500);

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
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      savePhotographerDriveConnection(auth.currentUser, token, 3500).catch(() => {});
    }
  } else {
    clearSavedAccessToken();
  }
};

export const logout = async () => {
  await signOut(auth);
  clearSavedAccessToken();
  // Automatically re-authenticate anonymously so client sessions & Firestore access remain valid
  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.warn('Post-logout anonymous auth notice:', err);
  }
};
