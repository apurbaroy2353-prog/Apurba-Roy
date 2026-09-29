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
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './auth';
import {
  CustomerGallery,
  CustomerGalleryPhoto,
  CustomerPhotoSelection,
  CustomerGalleryStatus,
  SelectionHistoryEntry,
  SelectionHistoryAction,
} from '../types';

const LOCAL_STORAGE_GALLERIES_KEY = 'rcfoto_customer_galleries_v1';

// Seed fallback example gallery for initial demo
const INITIAL_SEED_GALLERIES: CustomerGallery[] = [
  {
    id: 'cg_rahim_ayesha',
    customerName: 'Rahim & Ayesha',
    eventName: 'Wedding Photography',
    galleryName: 'Master Photo Selection',
    customerPhone: '+8801776044951',
    customerEmail: 'rahim.ayesha@example.com',
    driveFolderId: 'folder_rahim_wedding_2026',
    driveFolderName: 'Rahim & Ayesha Wedding - Selection Previews',
    secureToken: 'A8kP9mQ72xRt4Lw',
    pinEnabled: false,
    maxSelections: 100,
    selectionDeadline: '2026-10-15',
    allowDownloads: true,
    allowEditing: true,
    status: 'selection_in_progress',
    totalPhotos: 24,
    selectedCount: 5,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastActivity: '2 minutes ago',
    coverPhotoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    notesForCustomer: 'Welcome to your wedding proofing gallery! Please select your top photos for your album. Click any photo to preview in high resolution.',
    selectedPhotoIds: ['p_sample_01', 'p_sample_02', 'p_sample_03', 'p_sample_04', 'p_sample_05'],
    photos: Array.from({ length: 24 }).map((_, i) => {
      const photoId = `p_sample_${String(i + 1).padStart(2, '0')}`;
      const sampleImages = [
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1544078751-58fee2d8a03b?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=800&q=80',
      ];
      const imgUrl = sampleImages[i % sampleImages.length];
      return {
        id: photoId,
        driveFileId: `drive_file_id_${photoId}`,
        name: `IMG_${2000 + i}.JPG`,
        thumbnailUrl: imgUrl,
        previewUrl: imgUrl.replace('&w=800', '&w=1600'),
        mimeType: 'image/jpeg',
        size: `${(12 + (i % 6)).toFixed(1)} MB`,
        createdTime: '2026-09-15T14:30:00Z',
      };
    }),
  },
];

/**
 * Generate a cryptographically secure random token (e.g. 'A8kP9mQ72xRt4Lw')
 */
export function generateSecureToken(length = 15): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => chars[byte % chars.length]).join('');
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate reliable Google Drive Thumbnail URL
 */
export function generateDriveThumbnailUrl(driveFileId: string, rawThumbnail?: string): string {
  if (rawThumbnail && rawThumbnail.startsWith('http')) {
    if (rawThumbnail.includes('=s')) {
      return rawThumbnail.replace(/=s\d+.*$/, '=w800');
    }
    return rawThumbnail;
  }
  return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w800`;
}

/**
 * Generate reliable Google Drive Large Preview URL for Lightbox
 * Avoids broken HTML webViewLinks
 */
export function generateDrivePreviewUrl(driveFileId: string, rawThumbnail?: string): string {
  if (rawThumbnail && rawThumbnail.startsWith('http')) {
    if (rawThumbnail.includes('=s')) {
      return rawThumbnail.replace(/=s\d+.*$/, '=w2048');
    }
    if (rawThumbnail.includes('unsplash.com')) {
      return rawThumbnail.replace('&w=800', '&w=1800');
    }
    return rawThumbnail;
  }
  return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w2048`;
}

/**
 * Generate reliable Google Drive Download URL
 */
export function generateDriveDownloadUrl(driveFileId: string, webContentLink?: string): string {
  if (webContentLink && webContentLink.startsWith('http')) {
    return webContentLink;
  }
  return `https://drive.google.com/uc?export=download&id=${driveFileId}`;
}

/**
 * Compute SHA-256 hash of a PIN string using Web Crypto API
 */
export async function hashPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`rcfoto_salt_${normalized}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'simple_' + Math.abs(hash).toString(16);
}

/**
 * Verify entered PIN against stored hash
 */
export async function verifyPin(inputPin: string, storedHash?: string): Promise<boolean> {
  if (!storedHash) return true;
  const computed = await hashPin(inputPin);
  return computed.toLowerCase() === storedHash.toLowerCase();
}

/**
 * Get cached local customer galleries
 */
export function getLocalCustomerGalleries(): CustomerGallery[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GALLERIES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_GALLERIES_KEY, JSON.stringify(INITIAL_SEED_GALLERIES));
      return INITIAL_SEED_GALLERIES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Error reading local customer galleries:', err);
    return INITIAL_SEED_GALLERIES;
  }
}

/**
 * Save customer galleries to localStorage
 */
export function saveLocalCustomerGalleries(galleries: CustomerGallery[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_GALLERIES_KEY, JSON.stringify(galleries));
  } catch (err) {
    console.warn('Error saving local customer galleries:', err);
  }
}

/**
 * Get all Customer Galleries / Projects (from Firestore with LocalStorage fallback)
 */
export async function getCustomerGalleries(ownerUid?: string): Promise<CustomerGallery[]> {
  try {
    const collRef = collection(db, 'projects');
    const snapshot = await getDocs(collRef);
    if (!snapshot.empty) {
      const list: CustomerGallery[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          ownerUid: data.adminUid,
          customerName: data.clientName || 'Client',
          customerEmail: data.clientEmail,
          customerPhone: data.clientPhone,
          eventName: data.eventName || 'Event',
          galleryName: data.galleryName || 'Gallery',
          driveFolderId: data.driveFolderId || '',
          driveFolderName: data.driveFolderName || '',
          secureToken: data.secureToken || d.id,
          pinEnabled: !!data.pinEnabled,
          maxSelections: data.maxSelections || 100,
          selectionDeadline: data.selectionDeadline || '',
          allowDownloads: data.allowDownloads !== false,
          allowEditing: data.allowEditing !== false,
          status: (data.status || 'draft') as CustomerGalleryStatus,
          totalPhotos: data.totalPhotos || 0,
          selectedCount: data.selectedCount || 0,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          submittedAt: data.submittedAt || undefined,
          coverPhotoUrl: data.coverPhotoUrl,
          notesForCustomer: data.notesForCustomer,
        });
      });
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      );
      saveLocalCustomerGalleries(list);
      return list;
    }
  } catch (err) {
    console.warn('Firestore getCustomerGalleries failed, using local cache:', err);
  }
  return getLocalCustomerGalleries();
}

/**
 * Save or Update a Project in Firestore (and customerGalleries for backwards compatibility)
 */
export async function saveCustomerGallery(gallery: CustomerGallery): Promise<void> {
  const nowIso = new Date().toISOString();
  const updatedGallery: CustomerGallery = {
    ...gallery,
    updatedAt: nowIso,
  };

  // Update local storage cache
  const locals = getLocalCustomerGalleries();
  const existingIdx = locals.findIndex((g) => g.id === gallery.id);
  let updatedLocals: CustomerGallery[];
  if (existingIdx >= 0) {
    updatedLocals = [...locals];
    updatedLocals[existingIdx] = updatedGallery;
  } else {
    updatedLocals = [updatedGallery, ...locals];
  }
  saveLocalCustomerGalleries(updatedLocals);

  // Write to Firestore: projects/{projectId} and customerGalleries/{galleryId}
  try {
    const adminUid = gallery.ownerUid || auth.currentUser?.uid || 'admin';
    const projectDocRef = doc(db, 'projects', gallery.id);
    const galleryDocRef = doc(db, 'customerGalleries', gallery.id);

    const projectData = {
      adminUid,
      clientName: gallery.customerName,
      clientEmail: gallery.customerEmail || '',
      clientPhone: gallery.customerPhone || '',
      galleryName: gallery.galleryName,
      eventName: gallery.eventName,
      status: gallery.status,
      createdAt: gallery.createdAt || nowIso,
      updatedAt: nowIso,
      submittedAt: gallery.submittedAt || null,
      totalPhotos: gallery.photos?.length || gallery.totalPhotos || 0,
      selectedCount: gallery.selectedPhotoIds?.length || gallery.selectedCount || 0,
      driveFolderId: gallery.driveFolderId,
      driveFolderName: gallery.driveFolderName,
      secureToken: gallery.secureToken,
      maxSelections: gallery.maxSelections,
      selectionDeadline: gallery.selectionDeadline || '',
      allowDownloads: gallery.allowDownloads !== false,
      allowEditing: gallery.allowEditing !== false,
      pinEnabled: !!gallery.pinEnabled,
      pinHash: gallery.pinHash || '',
      coverPhotoUrl: gallery.coverPhotoUrl || (gallery.photos?.[0]?.thumbnailUrl) || '',
      notesForCustomer: gallery.notesForCustomer || '',
    };

    // Parallel writes with merge
    await Promise.all([
      setDoc(projectDocRef, projectData, { merge: true }),
      setDoc(galleryDocRef, { ...updatedGallery, ownerUid: adminUid }, { merge: true }),
    ]);

    // Save photos into projects/{projectId}/photos/{photoId} subcollection if photos provided
    if (gallery.photos && gallery.photos.length > 0) {
      const photosBatch = writeBatch(db);
      gallery.photos.slice(0, 300).forEach((photo) => {
        const photoDocRef = doc(db, 'projects', gallery.id, 'photos', photo.id);
        photosBatch.set(
          photoDocRef,
          {
            fileName: photo.name,
            driveFileId: photo.driveFileId || photo.id,
            thumbnailUrl: photo.thumbnailUrl,
            previewUrl: photo.previewUrl,
            downloadUrl: generateDriveDownloadUrl(photo.driveFileId || photo.id),
            createdAt: photo.createdTime || nowIso,
            size: photo.size || '',
          },
          { merge: true }
        );
      });
      await photosBatch.commit().catch((err) => {
        console.warn('Batch write for project photos subcollection notice:', err);
      });
    }
  } catch (err) {
    console.warn('Firestore save project failed (cached locally):', err);
  }
}

/**
 * Fetch a Project or Gallery from Firestore (with photos and existing selections)
 * Accepts either projectId, galleryId, or secureToken.
 */
export async function getCustomerGalleryByToken(identifier: string): Promise<CustomerGallery | null> {
  if (!identifier) return null;
  const cleanId = identifier.trim();

  let foundData: any = null;
  let resolvedId = cleanId;

  // 1. Try directly fetching projects/{cleanId}
  try {
    const projSnap = await getDoc(doc(db, 'projects', cleanId));
    if (projSnap.exists()) {
      foundData = projSnap.data();
      resolvedId = projSnap.id;
    }
  } catch (err) {
    console.warn('Project doc direct fetch notice:', err);
  }

  // 2. Try directly fetching customerGalleries/{cleanId}
  if (!foundData) {
    try {
      const galSnap = await getDoc(doc(db, 'customerGalleries', cleanId));
      if (galSnap.exists()) {
        foundData = galSnap.data();
        resolvedId = galSnap.id;
      }
    } catch (err) {
      console.warn('Gallery doc direct fetch notice:', err);
    }
  }

  // 3. Search by secureToken in projects collection
  if (!foundData) {
    try {
      const qProj = query(collection(db, 'projects'), where('secureToken', '==', cleanId));
      const snapProj = await getDocs(qProj);
      if (!snapProj.empty) {
        foundData = snapProj.docs[0].data();
        resolvedId = snapProj.docs[0].id;
      }
    } catch (err) {
      console.warn('Project query by token notice:', err);
    }
  }

  // 4. Search by secureToken in customerGalleries collection
  if (!foundData) {
    try {
      const qGal = query(collection(db, 'customerGalleries'), where('secureToken', '==', cleanId));
      const snapGal = await getDocs(qGal);
      if (!snapGal.empty) {
        foundData = snapGal.docs[0].data();
        resolvedId = snapGal.docs[0].id;
      }
    } catch (err) {
      console.warn('Gallery query by token notice:', err);
    }
  }

  // 5. If found in Firestore, load photos and selections subcollections
  if (foundData) {
    let photos: CustomerGalleryPhoto[] = foundData.photos || [];

    // Try loading photos from subcollection if empty
    if (!photos || photos.length === 0) {
      try {
        const photosSnap = await getDocs(collection(db, 'projects', resolvedId, 'photos'));
        if (!photosSnap.empty) {
          photos = photosSnap.docs.map((d) => {
            const p = d.data();
            return {
              id: d.id,
              driveFileId: p.driveFileId || d.id,
              name: p.fileName || d.id,
              thumbnailUrl: p.thumbnailUrl,
              previewUrl: p.previewUrl,
              createdTime: p.createdAt,
              size: p.size,
            };
          });
        }
      } catch (err) {
        console.warn('Could not load photos subcollection:', err);
      }
    }

    // Load selections from subcollection projects/{resolvedId}/selections
    let selectedPhotoIds: string[] = foundData.selectedPhotoIds || [];
    try {
      const selectionsSnap = await getDocs(collection(db, 'projects', resolvedId, 'selections'));
      if (!selectionsSnap.empty) {
        selectedPhotoIds = selectionsSnap.docs.map((d) => d.id);
      }
    } catch (err) {
      console.warn('Selections subcollection load notice:', err);
    }

    const unifiedGallery: CustomerGallery = {
      id: resolvedId,
      ownerUid: foundData.adminUid || foundData.ownerUid,
      customerName: foundData.clientName || foundData.customerName || 'Client',
      customerEmail: foundData.clientEmail || foundData.customerEmail,
      customerPhone: foundData.clientPhone || foundData.customerPhone,
      eventName: foundData.eventName || 'Event',
      galleryName: foundData.galleryName || 'Photo Selection',
      driveFolderId: foundData.driveFolderId || '',
      driveFolderName: foundData.driveFolderName || '',
      secureToken: foundData.secureToken || resolvedId,
      pinEnabled: !!foundData.pinEnabled,
      pinHash: foundData.pinHash,
      maxSelections: foundData.maxSelections || 100,
      selectionDeadline: foundData.selectionDeadline || '',
      allowDownloads: foundData.allowDownloads !== false,
      allowEditing: foundData.allowEditing !== false,
      status: (foundData.status || 'draft') as CustomerGalleryStatus,
      totalPhotos: photos.length || foundData.totalPhotos || 0,
      selectedCount: selectedPhotoIds.length,
      createdAt: foundData.createdAt || new Date().toISOString(),
      updatedAt: foundData.updatedAt || new Date().toISOString(),
      submittedAt: foundData.submittedAt || undefined,
      photos,
      selectedPhotoIds,
      coverPhotoUrl: foundData.coverPhotoUrl || photos[0]?.thumbnailUrl,
      notesForCustomer: foundData.notesForCustomer || '',
    };

    return unifiedGallery;
  }

  // 6. Fallback to localStorage cache
  const locals = getLocalCustomerGalleries();
  const match = locals.find((g) => g.secureToken === cleanId || g.id === cleanId);
  return match || null;
}

/**
 * Real-time listener for client selections on a project/gallery
 */
export function subscribeToProjectSelections(
  projectId: string,
  callback: (selectedIds: string[]) => void
): () => void {
  try {
    const selectionsRef = collection(db, 'projects', projectId, 'selections');
    const unsubscribe = onSnapshot(
      selectionsRef,
      (snapshot) => {
        const ids = snapshot.docs.map((d) => d.id);
        callback(ids);
      },
      (err) => {
        console.warn('Real-time selections subscription notice:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Cannot establish project selections listener:', err);
    return () => {};
  }
}

/**
 * Batch update photo selections for a project (used by debounced queue)
 */
export async function batchUpdateProjectSelections(
  projectId: string,
  changes: Map<string, boolean>,
  allPhotos: CustomerGalleryPhoto[],
  currentTotalSelected: number
): Promise<void> {
  if (changes.size === 0) return;

  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);
  const currentUid = auth.currentUser?.uid || 'anonymous_client';

  changes.forEach((isSelected, photoId) => {
    const projSelRef = doc(db, 'projects', projectId, 'selections', photoId);
    const galSelRef = doc(db, 'customerGalleries', projectId, 'selections', photoId);

    if (isSelected) {
      const photo = allPhotos.find((p) => p.id === photoId);
      const data = {
        photoId,
        fileName: photo?.name || photoId,
        driveFileId: photo?.driveFileId || photoId,
        selectedBy: currentUid,
        selectedAt: nowIso,
      };
      batch.set(projSelRef, data, { merge: true });
      batch.set(galSelRef, data, { merge: true });
    } else {
      batch.delete(projSelRef);
      batch.delete(galSelRef);
    }
  });

  // Update parent project & gallery selected count and status
  const projRef = doc(db, 'projects', projectId);
  const galRef = doc(db, 'customerGalleries', projectId);
  const statusUpdate = currentTotalSelected > 0 ? 'selection_in_progress' : 'draft';

  batch.update(projRef, {
    selectedCount: currentTotalSelected,
    status: statusUpdate,
    updatedAt: nowIso,
  });

  batch.set(
    galRef,
    {
      selectedCount: currentTotalSelected,
      status: statusUpdate,
      updatedAt: nowIso,
      lastActivity: 'Selection auto-saved',
    },
    { merge: true }
  );

  await batch.commit();
}

/**
 * Clear All Selections & Start Again:
 * Deletes all selection documents in Firestore, sets selectedCount to 0, returns status to 'draft'.
 * Keeps project and photos active!
 */
export async function clearAllProjectSelections(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const nowIso = new Date().toISOString();

    // 1. Fetch all docs in projects/{projectId}/selections
    const projSelRef = collection(db, 'projects', projectId, 'selections');
    const galSelRef = collection(db, 'customerGalleries', projectId, 'selections');

    const [projSnap, galSnap] = await Promise.all([
      getDocs(projSelRef).catch(() => null),
      getDocs(galSelRef).catch(() => null),
    ]);

    const batch = writeBatch(db);

    if (projSnap) {
      projSnap.forEach((d) => batch.delete(d.ref));
    }
    if (galSnap) {
      galSnap.forEach((d) => batch.delete(d.ref));
    }

    // Reset status to draft, selectedCount to 0, clear submittedAt
    const projDoc = doc(db, 'projects', projectId);
    const galDoc = doc(db, 'customerGalleries', projectId);

    batch.set(
      projDoc,
      {
        selectedCount: 0,
        status: 'draft',
        submittedAt: null,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    batch.set(
      galDoc,
      {
        selectedCount: 0,
        selectedPhotoIds: [],
        selections: [],
        status: 'draft',
        submittedAt: null,
        updatedAt: nowIso,
        lastActivity: 'Selections cleared by client',
      },
      { merge: true }
    );

    await batch.commit();

    // Also update local cache
    const locals = getLocalCustomerGalleries();
    const idx = locals.findIndex((g) => g.id === projectId);
    if (idx >= 0) {
      locals[idx] = {
        ...locals[idx],
        selectedCount: 0,
        selectedPhotoIds: [],
        selections: [],
        status: 'draft',
        submittedAt: undefined,
        updatedAt: nowIso,
      };
      saveLocalCustomerGalleries(locals);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error clearing selections:', err);
    return { success: false, error: err.message || 'Failed to clear selections' };
  }
}

/**
 * Edit Current Selection:
 * Returns status to 'draft' while keeping all existing selections intact.
 */
export async function editCurrentSelection(projectId: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const projRef = doc(db, 'projects', projectId);
    const galRef = doc(db, 'customerGalleries', projectId);

    await Promise.all([
      setDoc(projRef, { status: 'draft', updatedAt: nowIso }, { merge: true }),
      setDoc(galRef, { status: 'active', updatedAt: nowIso }, { merge: true }),
    ]);

    const locals = getLocalCustomerGalleries();
    const idx = locals.findIndex((g) => g.id === projectId);
    if (idx >= 0) {
      locals[idx].status = 'active';
      locals[idx].updatedAt = nowIso;
      saveLocalCustomerGalleries(locals);
    }
    return true;
  } catch (err) {
    console.warn('Error changing status back to draft for editing:', err);
    return false;
  }
}

/**
 * Submit Final Selection:
 * Sets status to 'submitted', writes submittedAt = now, sets notes for photographer.
 */
export async function submitProjectSelection(
  projectId: string,
  selectedPhotoIds: string[],
  customerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    const projRef = doc(db, 'projects', projectId);
    const galRef = doc(db, 'customerGalleries', projectId);

    // Timeout guard so the UI never hangs indefinitely
    const commitPromise = Promise.all([
      setDoc(
        projRef,
        {
          status: 'submitted',
          submittedAt: nowIso,
          updatedAt: nowIso,
          selectedCount: selectedPhotoIds.length,
          clientNotes: customerNotes || '',
        },
        { merge: true }
      ),
      setDoc(
        galRef,
        {
          status: 'submitted',
          submittedAt: nowIso,
          updatedAt: nowIso,
          selectedCount: selectedPhotoIds.length,
          selectedPhotoIds,
          notesForCustomer: customerNotes || '',
          lastActivity: 'Selection submitted by client',
        },
        { merge: true }
      ),
    ]);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Submission write timeout')), 6000)
    );

    await Promise.race([commitPromise, timeoutPromise]).catch((e) => {
      console.warn('Online commit note (will sync locally):', e);
    });

    // Update local cache
    const locals = getLocalCustomerGalleries();
    const idx = locals.findIndex((g) => g.id === projectId);
    if (idx >= 0) {
      locals[idx] = {
        ...locals[idx],
        status: 'submitted',
        submittedAt: nowIso,
        selectedCount: selectedPhotoIds.length,
        selectedPhotoIds,
        updatedAt: nowIso,
      };
      saveLocalCustomerGalleries(locals);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error submitting selection:', err);
    return { success: false, error: err.message || 'Submission failed' };
  }
}

/**
 * Customer updates photo selections (legacy method wrapper)
 */
export async function updateCustomerSelections(
  token: string,
  selectedPhotoIds: string[],
  submitted = false,
  customerNotes?: string
): Promise<{ success: boolean; gallery?: CustomerGallery; error?: string }> {
  try {
    const gallery = await getCustomerGalleryByToken(token);
    if (!gallery) {
      return { success: false, error: 'Gallery not found' };
    }

    if (submitted) {
      await submitProjectSelection(gallery.id, selectedPhotoIds, customerNotes);
      gallery.status = 'submitted';
      gallery.submittedAt = new Date().toISOString();
    } else {
      const changes = new Map<string, boolean>();
      selectedPhotoIds.forEach((pid) => changes.set(pid, true));
      await batchUpdateProjectSelections(gallery.id, changes, gallery.photos || [], selectedPhotoIds.length);
      gallery.status = selectedPhotoIds.length > 0 ? 'selection_in_progress' : 'draft';
    }

    gallery.selectedPhotoIds = selectedPhotoIds;
    gallery.selectedCount = selectedPhotoIds.length;
    return { success: true, gallery };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Update failed' };
  }
}

/**
 * Delete a customer gallery / project
 */
export async function deleteCustomerGallery(galleryId: string): Promise<void> {
  const locals = getLocalCustomerGalleries();
  const filtered = locals.filter((g) => g.id !== galleryId);
  saveLocalCustomerGalleries(filtered);

  try {
    await Promise.all([
      deleteDoc(doc(db, 'projects', galleryId)).catch(() => {}),
      deleteDoc(doc(db, 'customerGalleries', galleryId)).catch(() => {}),
    ]);
  } catch (err) {
    console.warn('Firestore delete failed:', err);
  }
}

/**
 * Update gallery status
 */
export async function updateCustomerGalleryStatus(
  galleryId: string,
  status: CustomerGalleryStatus
): Promise<void> {
  const nowIso = new Date().toISOString();
  const locals = getLocalCustomerGalleries();
  const idx = locals.findIndex((g) => g.id === galleryId);
  if (idx >= 0) {
    locals[idx].status = status;
    locals[idx].updatedAt = nowIso;
    saveLocalCustomerGalleries(locals);
  }

  try {
    await Promise.all([
      setDoc(doc(db, 'projects', galleryId), { status, updatedAt: nowIso }, { merge: true }),
      setDoc(doc(db, 'customerGalleries', galleryId), { status, updatedAt: nowIso }, { merge: true }),
    ]);
  } catch (err) {
    console.warn('Status update Firestore note:', err);
  }
}

/**
 * Reset selections for a gallery
 */
export async function resetCustomerSelections(galleryId: string): Promise<void> {
  await clearAllProjectSelections(galleryId);
}

/**
 * Real-time listener for customer galleries in Admin dashboard
 * Combines projects and customerGalleries collections
 */
export function subscribeToCustomerGalleries(
  callback: (galleries: CustomerGallery[]) => void
): () => void {
  try {
    const collRef = collection(db, 'projects');
    const unsubscribe = onSnapshot(
      collRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CustomerGallery[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              ownerUid: data.adminUid,
              customerName: data.clientName || 'Client',
              customerEmail: data.clientEmail,
              customerPhone: data.clientPhone,
              eventName: data.eventName || 'Event',
              galleryName: data.galleryName || 'Gallery',
              driveFolderId: data.driveFolderId || '',
              driveFolderName: data.driveFolderName || '',
              secureToken: data.secureToken || d.id,
              pinEnabled: !!data.pinEnabled,
              maxSelections: data.maxSelections || 100,
              selectionDeadline: data.selectionDeadline || '',
              allowDownloads: data.allowDownloads !== false,
              allowEditing: data.allowEditing !== false,
              status: (data.status || 'draft') as CustomerGalleryStatus,
              totalPhotos: data.totalPhotos || 0,
              selectedCount: data.selectedCount || 0,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
              submittedAt: data.submittedAt || undefined,
              coverPhotoUrl: data.coverPhotoUrl,
              notesForCustomer: data.notesForCustomer,
            });
          });

          list.sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime()
          );

          saveLocalCustomerGalleries(list);
          callback(list);
        } else {
          // Fallback to customerGalleries if projects collection empty
          const fallbackRef = collection(db, 'customerGalleries');
          getDocs(fallbackRef)
            .then((snap) => {
              if (!snap.empty) {
                const legacyList: CustomerGallery[] = [];
                snap.forEach((d) => legacyList.push({ id: d.id, ...(d.data() as any) }));
                callback(legacyList);
              } else {
                callback(getLocalCustomerGalleries());
              }
            })
            .catch(() => callback(getLocalCustomerGalleries()));
        }
      },
      (err) => {
        console.warn('Firestore projects subscription fallback to local:', err);
        callback(getLocalCustomerGalleries());
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Cannot establish customerGalleries listener:', err);
    callback(getLocalCustomerGalleries());
    return () => {};
  }
}

/**
 * Format relative time (e.g. 'Just now', '2 minutes ago', '1 day ago')
 */
export function getRelativeTimeFormatted(dateStr?: string): string {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

/**
 * Export selected photo filenames to TXT
 */
export function exportSelectedFilenamesToTxt(gallery: CustomerGallery): void {
  const filenames = (gallery.selectedPhotoIds || [])
    .map((pid, idx) => {
      const match = gallery.photos?.find((p) => p.id === pid);
      return match?.name || `Photo_${idx + 1}`;
    })
    .join('\n');

  const blob = new Blob([filenames], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${gallery.customerName.replace(/[^a-zA-Z0-9]/g, '_')}_selected_filenames.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export selected photos to CSV
 */
export function exportSelectedPhotosToCsv(gallery: CustomerGallery): void {
  const headers = 'selection_order,file_name,file_id\n';
  const rows = (gallery.selectedPhotoIds || [])
    .map((pid, idx) => {
      const match = gallery.photos?.find((p) => p.id === pid);
      return `${idx + 1},"${(match?.name || `Photo_${idx + 1}`).replace(/"/g, '""')}","${match?.driveFileId || pid}"`;
    })
    .join('\n');

  const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${gallery.customerName.replace(/[^a-zA-Z0-9]/g, '_')}_selections.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy all selected filenames to clipboard
 */
export async function copySelectedFilenamesToClipboard(gallery: CustomerGallery): Promise<boolean> {
  try {
    const text = (gallery.selectedPhotoIds || [])
      .map((pid) => {
        const match = gallery.photos?.find((p) => p.id === pid);
        return match?.name || pid;
      })
      .join('\n');
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Request high-resolution ZIP archive for a project / customer gallery
 * Updates Firestore project status and notifies Admin
 */
export async function requestProjectZip(
  projectId: string,
  requestData: {
    clientEmail?: string;
    clientPhone?: string;
    notes?: string;
    selectedCount: number;
    selectedPhotoIds: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  const updatePayload = {
    zipRequested: true,
    zipRequestedAt: nowIso,
    zipRequestStatus: 'pending',
    zipRequestNotes: requestData.notes || '',
    zipRequestEmail: requestData.clientEmail || '',
    zipRequestPhone: requestData.clientPhone || '',
    zipRequestedCount: requestData.selectedCount,
    updatedAt: nowIso,
    lastActivity: 'Requested High-Res ZIP',
  };

  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      ...updatePayload,
      updatedAtServer: serverTimestamp(),
    });

    try {
      const legacyRef = doc(db, 'customerGalleries', projectId);
      await updateDoc(legacyRef, updatePayload);
    } catch {}
  } catch (err: any) {
    console.warn('requestProjectZip Firestore notice, updating local storage cache:', err);
  }

  // Update local storage cache
  const localGalleries = getLocalCustomerGalleries();
  const idx = localGalleries.findIndex((g) => g.id === projectId || g.secureToken === projectId);
  if (idx !== -1) {
    localGalleries[idx] = {
      ...localGalleries[idx],
      ...updatePayload,
      zipRequestStatus: 'pending' as const,
    };
    saveLocalCustomerGalleries(localGalleries);
  }

  return { success: true };
}

/**
 * Admin fulfills high-resolution ZIP archive by setting the download link or marking completed
 */
export async function fulfillProjectZip(
  projectId: string,
  zipDownloadUrl: string,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  const updatePayload = {
    zipDownloadUrl,
    zipRequestStatus: 'ready' as const,
    zipFulfilledAt: nowIso,
    zipAdminNotes: adminNotes || '',
    updatedAt: nowIso,
    lastActivity: 'High-Res ZIP Delivered',
  };

  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      ...updatePayload,
      updatedAtServer: serverTimestamp(),
    });

    try {
      const legacyRef = doc(db, 'customerGalleries', projectId);
      await updateDoc(legacyRef, updatePayload);
    } catch {}
  } catch (err: any) {
    console.warn('fulfillProjectZip Firestore notice:', err);
  }

  // Update local storage cache
  const localGalleries = getLocalCustomerGalleries();
  const idx = localGalleries.findIndex((g) => g.id === projectId || g.secureToken === projectId);
  if (idx !== -1) {
    localGalleries[idx] = {
      ...localGalleries[idx],
      ...updatePayload,
    };
    saveLocalCustomerGalleries(localGalleries);
  }

  return { success: true };
}

/**
 * Record a historical selection state snapshot in the selection_history subcollection
 */
export async function recordSelectionHistoryEntry(
  projectId: string,
  entry: Omit<SelectionHistoryEntry, 'id' | 'projectId'>
): Promise<SelectionHistoryEntry> {
  const historyColRef = collection(db, 'projects', projectId, 'selection_history');
  const newDocRef = doc(historyColRef);
  const nowIso = entry.timestamp || new Date().toISOString();

  const historyData: SelectionHistoryEntry = {
    ...entry,
    id: newDocRef.id,
    projectId,
    timestamp: nowIso,
  };

  try {
    await setDoc(newDocRef, {
      ...historyData,
      createdAtServer: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Selection history Firestore write notice (offline fallback):', err);
  }

  // Also maintain local storage history cache for instant offline access and fast undo/redo
  try {
    const key = `rcfoto_history_${projectId}`;
    const raw = localStorage.getItem(key);
    const list: SelectionHistoryEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(historyData);
    if (list.length > 50) list.length = 50;
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}

  return historyData;
}

/**
 * Subscribe in real-time to the selection_history subcollection for a project
 */
export function subscribeToSelectionHistory(
  projectId: string,
  callback: (entries: SelectionHistoryEntry[]) => void
): () => void {
  // Load local cache first for instant render
  try {
    const key = `rcfoto_history_${projectId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      callback(JSON.parse(raw));
    }
  } catch {}

  try {
    const historyColRef = collection(db, 'projects', projectId, 'selection_history');
    const q = query(historyColRef, orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: SelectionHistoryEntry[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              projectId,
              action: (data.action as SelectionHistoryAction) || 'select',
              description: data.description || '',
              selectedPhotoIds: data.selectedPhotoIds || [],
              selectedCount: data.selectedCount || 0,
              affectedPhotoId: data.affectedPhotoId,
              affectedPhotoName: data.affectedPhotoName,
              timestamp: data.timestamp || new Date().toISOString(),
              sessionId: data.sessionId,
              clientName: data.clientName,
            });
          });
          callback(list);
          try {
            localStorage.setItem(`rcfoto_history_${projectId}`, JSON.stringify(list));
          } catch {}
        }
      },
      (err) => {
        console.warn('Selection history subscription notice:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Could not subscribe to selection history:', err);
    return () => {};
  }
}

/**
 * Restore an exact historical selection state snapshot
 */
export async function restoreSelectionSnapshot(
  projectId: string,
  targetPhotoIds: string[],
  galleryPhotos: CustomerGalleryPhoto[],
  actionReason: string = 'Restored snapshot'
): Promise<boolean> {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const selectionsCol = collection(db, 'projects', projectId, 'selections');

    // 1. Fetch current selection items in Firestore to compute diff
    const currentSnap = await getDocs(selectionsCol);
    const currentIds = new Set<string>();
    currentSnap.forEach((d) => currentIds.add(d.id));

    const targetSet = new Set(targetPhotoIds);
    const batch = writeBatch(db);

    // Delete items no longer in target snapshot
    currentSnap.forEach((d) => {
      if (!targetSet.has(d.id)) {
        batch.delete(d.ref);
      }
    });

    // Add items that are in target snapshot but not currently in selections
    targetPhotoIds.forEach((pid, idx) => {
      if (!currentIds.has(pid)) {
        const photo = galleryPhotos.find((p) => p.id === pid);
        const selDocRef = doc(selectionsCol, pid);
        batch.set(selDocRef, {
          photoId: pid,
          driveFileId: photo?.driveFileId || pid,
          fileName: photo?.name || `photo_${pid}`,
          thumbnailUrl: photo?.thumbnailUrl || '',
          selectedAt: new Date().toISOString(),
          selectionOrder: idx + 1,
        });
      }
    });

    // Update main project doc
    batch.update(projectRef, {
      selectedCount: targetPhotoIds.length,
      selectedPhotoIds: targetPhotoIds,
      updatedAt: new Date().toISOString(),
      updatedAtServer: serverTimestamp(),
      lastActivity: actionReason,
    });

    await batch.commit();

    // Record snapshot restore in history subcollection
    await recordSelectionHistoryEntry(projectId, {
      action: 'restore_snapshot',
      description: `${actionReason} (${targetPhotoIds.length} photos)`,
      selectedPhotoIds: targetPhotoIds,
      selectedCount: targetPhotoIds.length,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.warn('restoreSelectionSnapshot fallback notice:', err);
    // Still record in history locally
    await recordSelectionHistoryEntry(projectId, {
      action: 'restore_snapshot',
      description: `${actionReason} (${targetPhotoIds.length} photos)`,
      selectedPhotoIds: targetPhotoIds,
      selectedCount: targetPhotoIds.length,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
}

