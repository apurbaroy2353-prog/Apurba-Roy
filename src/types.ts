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
  modifiedTime?: string;
  folderId?: string;
  folderName?: string;
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
  modifiedTime?: string;
  parents?: string[];
  photoCount?: number;
  driveId?: string; // For Shared Drives
  sharedWithMe?: boolean;
}

export interface DriveSharedDrive {
  id: string;
  name: string;
}

export interface DriveSyncStats {
  lastSynced: string;
  newPhotos: number;
  updatedPhotos: number;
  missingPhotos: number;
  totalPhotos: number;
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

export type PaymentMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Stripe' | 'SSLCommerz';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export type PaymentGatewayProvider = 'stripe' | 'sslcommerz';

export interface StripeGatewayConfig {
  enabled: boolean;
  mode: 'test' | 'live';
  publishableKey: string;
  secretKey: string;
  webhookSecret?: string;
  currency: 'usd' | 'bdt' | 'eur' | 'gbp';
  statementDescriptor?: string;
}

export interface SSLCommerzGatewayConfig {
  enabled: boolean;
  mode: 'sandbox' | 'live';
  storeId: string;
  storePassword: string;
  ipnUrl?: string;
  currency: 'BDT';
}

export interface PaymentGatewaySettings {
  activeGateway: 'manual' | 'stripe' | 'sslcommerz' | 'all';
  allowManualFallback: boolean;
  stripe: StripeGatewayConfig;
  sslcommerz: SSLCommerzGatewayConfig;
  updatedAt?: string;
  lastTestedAt?: string;
}

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
  // Google Drive Connection & Sync Details
  driveAccount?: string; // Connected Google Drive email
  lastSyncedAt?: string;
  includeSubfolders?: boolean; // Default true: scan child folders
  syncStats?: DriveSyncStats;
  // Final Delivery Folder Support
  finalDeliveryFolderId?: string;
  finalDeliveryFolderName?: string;
  finalDeliveryPhotos?: DrivePhoto[];
  finalDeliveryLastSyncedAt?: string;
  // Created 'CLIENT SELECTED' folder ID in Drive
  clientSelectedFolderId?: string;
}

export interface FaceMatchScore {
  photoId: string;
  photo: DrivePhoto;
  similarity: number; // 0 to 100 percentage
}

export interface ClientProfileData {
  albumId: string;
  partner1Name?: string;
  partner2Name?: string;
  coupleNames?: string;
  email?: string;
  phone?: string;
  weddingDate?: string;
  venue?: string;
  city?: string;
  deliveryAddress?: string;
  packageType?: string;
  clientNotes?: string;
  updatedAt?: string;
}

export type ClientActivityType =
  | 'view_gallery'
  | 'select_photo'
  | 'unselect_photo'
  | 'submit_selection'
  | 'make_payment'
  | 'download_photo'
  | 'face_search';

export interface ClientActivityLogEntry {
  id: string;
  albumId: string;
  activityType: ClientActivityType;
  title: string;
  description: string;
  timestamp: string;
  clientName?: string;
  metadata?: {
    photoId?: string;
    photoName?: string;
    selectionCount?: number;
    amount?: number;
    paymentMethod?: string;
    transactionId?: string;
    device?: string;
    status?: string;
    notes?: string;
  };
}

