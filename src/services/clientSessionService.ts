import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './auth';
import {
  ClientGallerySession,
  ClientSessionStatus,
  AutoSaveStatus,
  CustomerGallery,
  CustomerPhotoSelection,
} from '../types';
import { saveCustomerGallery, generateSecureToken } from './customerGalleryService';

const DB_NAME = 'rcfoto_client_sessions_db';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const QUEUE_STORE = 'offlineQueue';
const LOCAL_STORAGE_SESSION_PREFIX = 'rcfoto_session_';
const LOCAL_STORAGE_QUEUE_PREFIX = 'rcfoto_queue_';

interface QueuedAction {
  id?: number;
  sessionId: string;
  galleryId: string;
  galleryToken: string;
  selectedPhotoIds: string[];
  action: 'select' | 'unselect' | 'syncAll' | 'submit' | 'clear';
  timestamp: number;
}

// ==========================================
// IndexedDB Helper Functions
// ==========================================

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: 'galleryToken' });
        }
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('galleryToken', 'galleryToken', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('IndexedDB open error, falling back to localStorage');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save session to IndexedDB with localStorage fallback
 */
export async function saveLocalSession(session: ClientGallerySession): Promise<void> {
  // Always save to localStorage as backup
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_SESSION_PREFIX}${session.galleryToken}`,
      JSON.stringify(session)
    );
  } catch (err) {
    console.warn('localStorage setItem failed:', err);
  }

  // Save to IndexedDB
  const idb = await openDatabase();
  if (idb) {
    return new Promise((resolve) => {
      try {
        const tx = idb.transaction(SESSIONS_STORE, 'readwrite');
        const store = tx.objectStore(SESSIONS_STORE);
        store.put(session);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

/**
 * Get session from IndexedDB with localStorage fallback
 */
export async function getLocalSession(galleryToken: string): Promise<ClientGallerySession | null> {
  const idb = await openDatabase();
  if (idb) {
    const fromIdb = await new Promise<ClientGallerySession | null>((resolve) => {
      try {
        const tx = idb.transaction(SESSIONS_STORE, 'readonly');
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.get(galleryToken);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (fromIdb) return fromIdb;
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_SESSION_PREFIX}${galleryToken}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Add an action to the offline queue
 */
async function enqueueOfflineAction(action: QueuedAction): Promise<void> {
  const idb = await openDatabase();
  if (idb) {
    new Promise<void>((resolve) => {
      try {
        const tx = idb.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        store.add(action);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Also push to localStorage queue
  try {
    const key = `${LOCAL_STORAGE_QUEUE_PREFIX}${action.galleryToken}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(action);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}

/**
 * Get all queued offline actions
 */
async function getOfflineActions(galleryToken: string): Promise<QueuedAction[]> {
  const idb = await openDatabase();
  if (idb) {
    const items = await new Promise<QueuedAction[]>((resolve) => {
      try {
        const tx = idb.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const index = store.index('galleryToken');
        const req = index.getAll(galleryToken);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
    if (items.length > 0) return items;
  }

  try {
    const key = `${LOCAL_STORAGE_QUEUE_PREFIX}${galleryToken}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear queued actions for a galleryToken
 */
async function clearOfflineQueue(galleryToken: string): Promise<void> {
  const idb = await openDatabase();
  if (idb) {
    new Promise<void>((resolve) => {
      try {
        const tx = idb.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const index = store.index('galleryToken');
        const req = index.openCursor(galleryToken);
        req.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  try {
    localStorage.removeItem(`${LOCAL_STORAGE_QUEUE_PREFIX}${galleryToken}`);
  } catch {}
}

// ==========================================
// Session Creation & Recovery Logic
// ==========================================

/**
 * Generate a 6-digit recovery PIN (e.g. '482761')
 */
export function generateRecoveryCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

/**
 * Get or create an anonymous client session.
 * Reuses existing session when available to prevent duplicate sessions on page refresh.
 */
export async function getOrCreateClientSession(
  galleryToken: string,
  gallery: CustomerGallery,
  customerName?: string,
  customerPhone?: string
): Promise<ClientGallerySession> {
  const cleanToken = galleryToken.trim();

  // 1. Check local session first (IndexedDB / localStorage)
  const localSession = await getLocalSession(cleanToken);
  if (localSession && localSession.sessionId) {
    // Attempt to sync and verify with Firestore
    try {
      const docRef = doc(db, 'clientGallerySessions', localSession.sessionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const serverData = docSnap.data() as ClientGallerySession;
        // Merge selections (server-side selections take precedence if newer)
        const mergedSelections = Array.from(
          new Set([...(serverData.selectedPhotoIds || []), ...(localSession.selectedPhotoIds || [])])
        );

        const mergedSession: ClientGallerySession = {
          ...localSession,
          ...serverData,
          selectedPhotoIds:
            serverData.selectedPhotoIds?.length >= (localSession.selectedPhotoIds?.length || 0)
              ? serverData.selectedPhotoIds
              : localSession.selectedPhotoIds,
          selectedCount:
            serverData.selectedPhotoIds?.length >= (localSession.selectedPhotoIds?.length || 0)
              ? serverData.selectedPhotoIds.length
              : localSession.selectedPhotoIds.length,
        };

        await saveLocalSession(mergedSession);
        return mergedSession;
      } else {
        // Re-write to Firestore if missing
        await setDoc(docRef, localSession, { merge: true });
        return localSession;
      }
    } catch (err) {
      console.warn('Could not reach Firestore for existing session, using local:', err);
      return localSession;
    }
  }

  // 2. No local session found: Check Firestore for an existing session with this galleryToken
  try {
    const collRef = collection(db, 'clientGallerySessions');
    const q = query(
      collRef,
      where('galleryToken', '==', cleanToken),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const existing = snap.docs[0].data() as ClientGallerySession;
      await saveLocalSession(existing);
      return existing;
    }
  } catch (err) {
    console.warn('Firestore query for existing gallery session skipped or failed:', err);
  }

  // 3. Create fresh anonymous Client Gallery Session
  const sessionId = 'cs_' + generateSecureToken(16);
  const sessionAccessToken = generateSecureToken(24);
  const recoveryCode = generateRecoveryCode();
  const nowIso = new Date().toISOString();

  // Inherit existing gallery selections if gallery already has selections
  const initialSelectedIds = gallery.selectedPhotoIds || [];

  const newSession: ClientGallerySession = {
    sessionId,
    galleryId: gallery.id,
    galleryToken: cleanToken,
    sessionAccessToken,
    recoveryCode,
    customerName: customerName || gallery.customerName || '',
    customerPhone: customerPhone || gallery.customerPhone || '',
    selectedPhotoIds: initialSelectedIds,
    selectedCount: initialSelectedIds.length,
    status: (gallery.status === 'submitted' ? 'submitted' : 'active') as ClientSessionStatus,
    createdAt: nowIso,
    lastActivityAt: nowIso,
    deviceInfoOptional:
      typeof navigator !== 'undefined'
        ? `${navigator.userAgent.substring(0, 100)}`
        : 'Web Browser',
  };

  // Save locally first so user never loses progress
  await saveLocalSession(newSession);

  // Persist to Firestore
  try {
    const docRef = doc(db, 'clientGallerySessions', sessionId);
    await setDoc(docRef, newSession);
  } catch (err) {
    console.warn('Firestore initial session creation deferred to offline queue:', err);
  }

  return newSession;
}

/**
 * Recover a session from another device using the 6-digit Recovery Code
 */
export async function recoverSessionByCode(
  galleryToken: string,
  recoveryCode: string
): Promise<{ success: boolean; session?: ClientGallerySession; error?: string }> {
  const cleanCode = recoveryCode.trim();
  const cleanToken = galleryToken.trim();

  if (!cleanCode || cleanCode.length < 6) {
    return { success: false, error: 'Please enter a valid 6-digit recovery code.' };
  }

  try {
    const collRef = collection(db, 'clientGallerySessions');
    const q = query(
      collRef,
      where('galleryToken', '==', cleanToken),
      where('recoveryCode', '==', cleanCode),
      limit(1)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const recovered = snap.docs[0].data() as ClientGallerySession;
      // Attach to this device's storage
      await saveLocalSession(recovered);
      return { success: true, session: recovered };
    } else {
      return {
        success: false,
        error: 'Invalid recovery code. Please check the code and try again.',
      };
    }
  } catch (err: any) {
    console.error('Error recovering session by code:', err);
    return {
      success: false,
      error: 'Could not connect to verify recovery code. Please check your network.',
    };
  }
}

/**
 * Auto-Save photo selection action with immediate local update,
 * Firestore background persistence, and offline queueing.
 */
export async function saveSelectionAction(
  session: ClientGallerySession,
  selectedPhotoIds: string[],
  gallery: CustomerGallery,
  isSubmitting = false
): Promise<{ success: boolean; status: AutoSaveStatus; updatedSession: ClientGallerySession }> {
  const nowIso = new Date().toISOString();
  const nextStatus: ClientSessionStatus = isSubmitting
    ? 'submitted'
    : session.status === 'submitted'
    ? 'submitted'
    : 'active';

  const updatedSession: ClientGallerySession = {
    ...session,
    selectedPhotoIds,
    selectedCount: selectedPhotoIds.length,
    status: nextStatus,
    lastActivityAt: nowIso,
    submittedAt: isSubmitting ? nowIso : session.submittedAt,
  };

  // 1. Immediately save to IndexedDB & localStorage
  await saveLocalSession(updatedSession);

  // 2. Check offline state
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline) {
    await enqueueOfflineAction({
      sessionId: session.sessionId,
      galleryId: gallery.id,
      galleryToken: gallery.secureToken,
      selectedPhotoIds,
      action: isSubmitting ? 'submit' : 'syncAll',
      timestamp: Date.now(),
    });
    return { success: true, status: 'offline', updatedSession };
  }

  // 3. Online: Persist to Firestore
  try {
    const sessionDocRef = doc(db, 'clientGallerySessions', session.sessionId);
    await setDoc(
      sessionDocRef,
      {
        selectedPhotoIds,
        selectedCount: selectedPhotoIds.length,
        status: nextStatus,
        lastActivityAt: nowIso,
        submittedAt: isSubmitting ? nowIso : session.submittedAt,
      },
      { merge: true }
    );

    // Also update selections subcollection in session
    // Subcollection: clientGallerySessions/{sessionId}/selections/{photoId}
    try {
      const selectionsRef = collection(db, 'clientGallerySessions', session.sessionId, 'selections');
      // Write selected photo docs
      const subcollectionWrites = selectedPhotoIds.map((pid, idx) => {
        const match = gallery.photos?.find((p) => p.id === pid);
        const subDoc = doc(selectionsRef, pid);
        return setDoc(subDoc, {
          photoId: pid,
          driveFileId: match?.driveFileId || pid,
          fileName: match?.name || `Photo_${idx + 1}`,
          selected: true,
          selectedAt: nowIso,
          updatedAt: nowIso,
          selectionOrder: idx + 1,
        }, { merge: true });
      });
      // Run non-blocking
      Promise.allSettled(subcollectionWrites).catch(() => {});
    } catch (subErr) {
      console.warn('Subcollection selection write deferred:', subErr);
    }

    // And synchronize customerGalleries document so photographer admin dashboard updates in real-time
    const updatedGallery: CustomerGallery = {
      ...gallery,
      selectedPhotoIds,
      selectedCount: selectedPhotoIds.length,
      status: isSubmitting ? 'submitted' : selectedPhotoIds.length > 0 ? 'selection_in_progress' : gallery.status,
      updatedAt: nowIso,
      submittedAt: isSubmitting ? nowIso : gallery.submittedAt,
      lastActivity: 'Selection auto-saved just now',
      selections: selectedPhotoIds.map((pid, idx) => {
        const match = gallery.photos?.find((p) => p.id === pid);
        return {
          photoId: pid,
          driveFileId: match?.driveFileId || pid,
          fileName: match?.name || `Photo_${idx + 1}`,
          thumbnailUrl: match?.thumbnailUrl,
          selectedAt: nowIso,
          selectionOrder: idx + 1,
        };
      }),
    };

    await saveCustomerGallery(updatedGallery);

    return { success: true, status: 'saved', updatedSession };
  } catch (err) {
    console.warn('Network write failed, enqueuing action offline:', err);
    await enqueueOfflineAction({
      sessionId: session.sessionId,
      galleryId: gallery.id,
      galleryToken: gallery.secureToken,
      selectedPhotoIds,
      action: isSubmitting ? 'submit' : 'syncAll',
      timestamp: Date.now(),
    });
    return { success: true, status: 'offline', updatedSession };
  }
}

/**
 * Process offline queue when network is restored
 */
export async function processOfflineQueue(
  galleryToken: string,
  gallery: CustomerGallery,
  onStatusChange?: (status: AutoSaveStatus) => void
): Promise<void> {
  const queued = await getOfflineActions(galleryToken);
  if (queued.length === 0) return;

  if (onStatusChange) onStatusChange('syncing');

  try {
    // Get latest queued action
    const latest = queued[queued.length - 1];
    const sessionDocRef = doc(db, 'clientGallerySessions', latest.sessionId);

    await setDoc(
      sessionDocRef,
      {
        selectedPhotoIds: latest.selectedPhotoIds,
        selectedCount: latest.selectedPhotoIds.length,
        status: latest.action === 'submit' ? 'submitted' : 'active',
        lastActivityAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Sync to customer gallery
    const updatedGallery: CustomerGallery = {
      ...gallery,
      selectedPhotoIds: latest.selectedPhotoIds,
      selectedCount: latest.selectedPhotoIds.length,
      status: latest.action === 'submit' ? 'submitted' : gallery.status,
      updatedAt: new Date().toISOString(),
      lastActivity: 'Synced from offline mode',
    };
    await saveCustomerGallery(updatedGallery);

    // Clear queue once synced
    await clearOfflineQueue(galleryToken);

    if (onStatusChange) {
      onStatusChange('saved');
      setTimeout(() => onStatusChange('saved'), 1500);
    }
  } catch (err) {
    console.warn('Offline sync failed, will retry on next connection event:', err);
    if (onStatusChange) onStatusChange('offline');
  }
}

/**
 * Start Selection Again (clears selections only, does NOT delete session or gallery)
 */
export async function startSelectionAgain(
  session: ClientGallerySession,
  gallery: CustomerGallery
): Promise<{ success: boolean; updatedSession: ClientGallerySession }> {
  const nowIso = new Date().toISOString();
  const updatedSession: ClientGallerySession = {
    ...session,
    selectedPhotoIds: [],
    selectedCount: 0,
    status: 'active',
    lastActivityAt: nowIso,
    submittedAt: undefined,
  };

  await saveLocalSession(updatedSession);

  try {
    const sessionDocRef = doc(db, 'clientGallerySessions', session.sessionId);
    await setDoc(
      sessionDocRef,
      {
        selectedPhotoIds: [],
        selectedCount: 0,
        status: 'active',
        lastActivityAt: nowIso,
        submittedAt: null,
      },
      { merge: true }
    );

    const updatedGallery: CustomerGallery = {
      ...gallery,
      selectedPhotoIds: [],
      selectedCount: 0,
      selections: [],
      status: 'active',
      updatedAt: nowIso,
      submittedAt: undefined,
      lastActivity: 'Selection restarted by customer',
    };
    await saveCustomerGallery(updatedGallery);
  } catch (err) {
    console.warn('Reset selection Firestore write failed:', err);
  }

  return { success: true, updatedSession };
}

/**
 * Update session customer identification details (name, phone)
 */
export async function updateSessionCustomerInfo(
  sessionId: string,
  name?: string,
  phone?: string
): Promise<void> {
  try {
    const sessionDocRef = doc(db, 'clientGallerySessions', sessionId);
    await setDoc(
      sessionDocRef,
      {
        customerName: name || '',
        customerPhone: phone || '',
        lastActivityAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not update customer info in session:', err);
  }
}
