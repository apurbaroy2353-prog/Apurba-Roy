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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './auth';
import {
  CustomerGallery,
  CustomerGalleryPhoto,
  CustomerPhotoSelection,
  CustomerGalleryStatus,
} from '../types';

const LOCAL_STORAGE_GALLERIES_KEY = 'rcfoto_customer_galleries_v1';

// Seed example gallery matching prompt requirements (Rahim & Ayesha Wedding)
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
    totalPhotos: 1245,
    selectedCount: 32,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastActivity: '2 minutes ago',
    coverPhotoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    notesForCustomer: 'Welcome to your wedding proofing gallery! Please select your top 100 photos for your handcrafted wedding album. Click any photo to preview in high resolution.',
    selectedPhotoIds: [
      'p_sample_01', 'p_sample_02', 'p_sample_03', 'p_sample_04', 'p_sample_05',
      'p_sample_06', 'p_sample_07', 'p_sample_08', 'p_sample_09', 'p_sample_10',
      'p_sample_11', 'p_sample_12', 'p_sample_13', 'p_sample_14', 'p_sample_15',
      'p_sample_16', 'p_sample_17', 'p_sample_18', 'p_sample_19', 'p_sample_20',
      'p_sample_21', 'p_sample_22', 'p_sample_23', 'p_sample_24', 'p_sample_25',
      'p_sample_26', 'p_sample_27', 'p_sample_28', 'p_sample_29', 'p_sample_30',
      'p_sample_31', 'p_sample_32',
    ],
    photos: Array.from({ length: 48 }).map((_, i) => {
      const numStr = String(i + 1).padStart(4, '0');
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
  {
    id: 'cg_tanvir_samira',
    customerName: 'Tanvir & Samira',
    eventName: 'Engagement Ceremony',
    galleryName: 'Selected Highlights',
    customerPhone: '+8801812345678',
    customerEmail: 'samira.tanvir@example.com',
    driveFolderId: 'folder_tanvir_engagement_2026',
    driveFolderName: 'Tanvir & Samira Engagement - Preview',
    secureToken: 'K9pX2mQ8vL4t7Wz',
    pinEnabled: true,
    // SHA-256 hash for PIN "1234"
    pinHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    maxSelections: 50,
    selectionDeadline: '2026-11-01',
    allowDownloads: false,
    allowEditing: false,
    status: 'submitted',
    totalPhotos: 420,
    selectedCount: 45,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    submittedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    lastActivity: '1 day ago',
    coverPhotoUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
    notesForCustomer: 'Private engagement gallery protected by PIN. Thank you for choosing RC Foto!',
    selectedPhotoIds: Array.from({ length: 45 }).map((_, i) => `p_tanvir_${i + 1}`),
    photos: Array.from({ length: 30 }).map((_, i) => {
      const photoId = `p_tanvir_${i + 1}`;
      return {
        id: photoId,
        driveFileId: `drive_file_id_${photoId}`,
        name: `DSC_${5000 + i}.JPG`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=80',
        mimeType: 'image/jpeg',
        size: '14.2 MB',
        createdTime: '2026-09-10T12:00:00Z',
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
 * Compute SHA-256 hash of a string using Web Crypto API
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
  // Simple deterministic fallback if crypto.subtle is unavailable
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
 * Get all Customer Galleries (from Firestore with LocalStorage fallback)
 */
export async function getCustomerGalleries(ownerUid?: string): Promise<CustomerGallery[]> {
  try {
    const collRef = collection(db, 'customerGalleries');
    const snapshot = await getDocs(collRef);
    if (!snapshot.empty) {
      const remoteGalleries: CustomerGallery[] = [];
      snapshot.forEach((docSnap) => {
        remoteGalleries.push({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CustomerGallery, 'id'>),
        });
      });

      // Filter by ownerUid if provided and galleries have ownerUid
      const filtered = ownerUid
        ? remoteGalleries.filter((g) => !g.ownerUid || g.ownerUid === ownerUid)
        : remoteGalleries;

      // Merge and cache locally
      saveLocalCustomerGalleries(filtered.length > 0 ? filtered : remoteGalleries);
      return filtered.length > 0 ? filtered : remoteGalleries;
    }
  } catch (err) {
    console.warn('Firestore getCustomerGalleries failed, using local cache:', err);
  }
  return getLocalCustomerGalleries();
}

/**
 * Get Customer Gallery by its secure token (used by the customer without login)
 */
export async function getCustomerGalleryByToken(token: string): Promise<CustomerGallery | null> {
  if (!token) return null;
  const cleanToken = token.trim();

  // Try Firestore first
  try {
    const collRef = collection(db, 'customerGalleries');
    const q = query(collRef, where('secureToken', '==', cleanToken));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data() as Omit<CustomerGallery, 'id'>;
      return { id: docSnap.id, ...data };
    }
  } catch (err) {
    console.warn('Firestore getCustomerGalleryByToken failed, checking local cache:', err);
  }

  // Fallback to local storage
  const locals = getLocalCustomerGalleries();
  const match = locals.find((g) => g.secureToken === cleanToken || g.id === cleanToken);
  return match || null;
}

/**
 * Save or Update a Customer Gallery (photographer action)
 */
export async function saveCustomerGallery(gallery: CustomerGallery): Promise<void> {
  // Update local storage immediately for fast UI
  const locals = getLocalCustomerGalleries();
  const existingIdx = locals.findIndex((g) => g.id === gallery.id);
  let updatedLocals: CustomerGallery[];
  if (existingIdx >= 0) {
    updatedLocals = [...locals];
    updatedLocals[existingIdx] = { ...gallery, updatedAt: new Date().toISOString() };
  } else {
    updatedLocals = [gallery, ...locals];
  }
  saveLocalCustomerGalleries(updatedLocals);

  // Sync to Firestore
  try {
    const docRef = doc(db, 'customerGalleries', gallery.id);
    await setDoc(docRef, {
      ...gallery,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore saveCustomerGallery failed (cached locally):', err);
  }
}

/**
 * Customer updates photo selections (unauthenticated or direct token access)
 */
export async function updateCustomerSelections(
  token: string,
  selectedPhotoIds: string[],
  submitted = false,
  customerNotes?: string
): Promise<{ success: boolean; gallery?: CustomerGallery; error?: string }> {
  try {
    let gallery = await getCustomerGalleryByToken(token);
    if (!gallery) {
      return { success: false, error: 'Gallery not found' };
    }

    // Check expiration
    if (gallery.selectionDeadline) {
      const deadlineDate = new Date(gallery.selectionDeadline);
      // End of deadline day
      deadlineDate.setHours(23, 59, 59, 999);
      if (Date.now() > deadlineDate.getTime()) {
        return { success: false, error: 'This gallery has expired. Please contact your photographer.' };
      }
    }

    // Check status
    if (gallery.status === 'disabled') {
      return { success: false, error: 'This gallery is currently unavailable.' };
    }

    if (gallery.status === 'locked' || (gallery.status === 'submitted' && !gallery.allowEditing)) {
      return { success: false, error: 'Your photo selection has already been submitted and locked.' };
    }

    // Check limit
    if (gallery.maxSelections > 0 && selectedPhotoIds.length > gallery.maxSelections) {
      return {
        success: false,
        error: `You can select a maximum of ${gallery.maxSelections} photos.`,
      };
    }

    const nowIso = new Date().toISOString();
    const newStatus: CustomerGalleryStatus = submitted
      ? 'submitted'
      : selectedPhotoIds.length > 0
      ? 'selection_in_progress'
      : gallery.status === 'submitted'
      ? 'submitted'
      : 'active';

    // Map photo selections
    const selections: CustomerPhotoSelection[] = selectedPhotoIds.map((pid, idx) => {
      const matchedPhoto = gallery?.photos?.find((p) => p.id === pid);
      return {
        photoId: pid,
        driveFileId: matchedPhoto?.driveFileId || pid,
        fileName: matchedPhoto?.name || `Photo_${idx + 1}`,
        thumbnailUrl: matchedPhoto?.thumbnailUrl,
        selectedAt: nowIso,
        selectionOrder: idx + 1,
      };
    });

    const updatedGallery: CustomerGallery = {
      ...gallery,
      selectedPhotoIds,
      selections,
      selectedCount: selectedPhotoIds.length,
      status: newStatus,
      updatedAt: nowIso,
      submittedAt: submitted ? nowIso : gallery.submittedAt,
      lastActivity: 'Just now',
      notesForCustomer: customerNotes ?? gallery.notesForCustomer,
    };

    // Update locally
    await saveCustomerGallery(updatedGallery);

    return { success: true, gallery: updatedGallery };
  } catch (err: any) {
    console.error('Error updating customer selections:', err);
    return { success: false, error: err.message || 'Failed to save selections' };
  }
}

/**
 * Delete a customer gallery
 */
export async function deleteCustomerGallery(galleryId: string): Promise<void> {
  // Delete from local storage
  const locals = getLocalCustomerGalleries();
  const filtered = locals.filter((g) => g.id !== galleryId);
  saveLocalCustomerGalleries(filtered);

  // Delete from Firestore
  try {
    const docRef = doc(db, 'customerGalleries', galleryId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore deleteCustomerGallery failed:', err);
  }
}

/**
 * Update gallery status
 */
export async function updateCustomerGalleryStatus(
  galleryId: string,
  status: CustomerGalleryStatus
): Promise<void> {
  const locals = getLocalCustomerGalleries();
  const gallery = locals.find((g) => g.id === galleryId);
  if (!gallery) return;

  const updated: CustomerGallery = {
    ...gallery,
    status,
    updatedAt: new Date().toISOString(),
  };
  await saveCustomerGallery(updated);
}

/**
 * Reset selections for a gallery
 */
export async function resetCustomerSelections(galleryId: string): Promise<void> {
  const locals = getLocalCustomerGalleries();
  const gallery = locals.find((g) => g.id === galleryId);
  if (!gallery) return;

  const updated: CustomerGallery = {
    ...gallery,
    selectedPhotoIds: [],
    selections: [],
    selectedCount: 0,
    status: 'active',
    submittedAt: undefined,
    updatedAt: new Date().toISOString(),
    lastActivity: 'Selections reset by photographer',
  };
  await saveCustomerGallery(updated);
}

/**
 * Real-time listener for customer galleries in Admin dashboard
 */
export function subscribeToCustomerGalleries(
  callback: (galleries: CustomerGallery[]) => void
): () => void {
  try {
    const collRef = collection(db, 'customerGalleries');
    const unsubscribe = onSnapshot(
      collRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CustomerGallery[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<CustomerGallery, 'id'>) });
          });
          // Sort newest first
          list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
          saveLocalCustomerGalleries(list);
          callback(list);
        } else {
          callback(getLocalCustomerGalleries());
        }
      },
      (err) => {
        console.warn('Firestore customerGalleries subscription fallback to local:', err);
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
  const filenames = (gallery.selections || [])
    .map((s, idx) => s.fileName || `Photo_${idx + 1}`)
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
 * Export selected photos to CSV (selection_order,file_name,file_id)
 */
export function exportSelectedPhotosToCsv(gallery: CustomerGallery): void {
  const headers = 'selection_order,file_name,file_id\n';
  const rows = (gallery.selections || [])
    .map((s, idx) => `${s.selectionOrder || idx + 1},"${(s.fileName || '').replace(/"/g, '""')}","${s.driveFileId || s.photoId}"`)
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
    const text = (gallery.selections || [])
      .map((s) => s.fileName)
      .filter(Boolean)
      .join('\n');
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
