/**
 * Types for Wedding Photography Client Photo-Selection App
 */

export interface DrivePhoto {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
  iconLink?: string;
  size?: string;
  createdTime?: string;
  imageMediaMetadata?: {
    width?: number;
    height?: number;
    rotation?: number;
  };
  // Paid / Free Photo Download
  isPaid?: boolean;
  price?: number; // Price in BDT (৳), e.g. 50, 100
  downloadDisabled?: boolean; // Admin can disable download for specific photo
}

export interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
}

export type SubmissionStatus = 'completed' | 'in_progress';

export interface ClientSelectionSubmission {
  id: string;
  albumId: string;
  clientName: string;
  clientEmail?: string;
  clientNotes?: string;
  selectedPhotoIds: string[];
  submittedAt: string;
  status?: SubmissionStatus; // 'completed' | 'in_progress'
  clientIpOrDevice?: string;
}

export type PaymentMethod = 'bKash' | 'Nagad' | 'Rocket';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface PhotoPaymentRequest {
  id: string;
  albumId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  photoIds: string[]; // List of photos being purchased
  photoNames?: string[];
  totalAmount: number; // in BDT ৳
  paymentMethod: PaymentMethod;
  senderNumber: string;
  transactionId: string; // TrxID e.g. BKS87391X
  status: PaymentStatus;
  submittedAt: string;
  reviewedAt?: string;
  adminNotes?: string;
}

export interface Album {
  id: string;
  title: string;
  coupleNames: string;
  weddingDate: string;
  clientEmail?: string;
  coverPhotoUrl?: string;
  driveFolderId: string;
  driveFolderName: string;
  slug: string; // shareable link slug or unique code
  selectionLimitEnabled?: boolean; // optional cap feature
  maxSelectionsAllowed?: number; // optional target or limit
  notesForClient?: string;
  createdAt: string;
  updatedAt: string;
  lastNotifiedAt?: string;
  notificationCount?: number;
  // Paid photo download controls
  defaultPhotoPrice?: number; // Default price in BDT (৳) for paid photos in this album
  clientDownloadAllowed?: boolean; // Admin master switch for client downloads (default: true)
  // cached photos for instant preview / fallback if needed
  cachedPhotos?: DrivePhoto[];
}

export interface FaceMatchScore {
  photoId: string;
  photo: DrivePhoto;
  similarity: number; // 0 to 100 percentage
}
