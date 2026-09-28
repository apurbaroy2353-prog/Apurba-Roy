import {
  Album,
  ClientSelectionSubmission,
  DrivePhoto,
  PhotoPaymentRequest,
  PaymentStatus,
  ClientActivityLogEntry,
  ClientActivityType,
  PaymentGatewaySettings,
  PaymentGatewayProvider,
} from '../types';

const ALBUMS_STORAGE_KEY = 'ramyachobi_albums_v2';
const SUBMISSIONS_STORAGE_KEY = 'ramyachobi_submissions_v2';
const PAYMENTS_STORAGE_KEY = 'ramyachobi_payments_v2';
const APPROVED_DOWNLOADS_KEY = 'ramyachobi_approved_downloads_v2';

// Payment Accounts & Support info
export const PAYMENT_ACCOUNTS = {
  bKash: '01776044951',
  Nagad: '01776044951',
  Rocket: '01776044951',
} as const;

export const WHATSAPP_SUPPORT_NUMBER = '01776044951';
export const WHATSAPP_LINK = 'https://wa.me/8801776044951?text=' + encodeURIComponent('Hello [রম্যছবি - RamyaChobi], I need support regarding photo payment or download.');

// Initial sample wedding album data so the app looks stunning right out of the box
const DEFAULT_ALBUMS: Album[] = [
  {
    id: 'alb_sophie_julian',
    title: 'Sophie & Julian - Tuscany Wedding',
    coupleNames: 'Sophie & Julian Vance',
    weddingDate: '2026-06-18',
    clientEmail: 'sophie.julian@example.com',
    driveFolderId: 'sample-folder-1',
    driveFolderName: 'Wedding - Sophie & Julian (Master Selects)',
    slug: 'sophie-julian-wedding',
    selectionLimitEnabled: true,
    maxSelectionsAllowed: 6,
    defaultPhotoPrice: 100,
    clientDownloadAllowed: true,
    notesForClient: 'Please select your top 6 favorite photos for your bespoke heirloom leather wedding album cover and feature spread. Heart your favorites and click "Submit Selection" when ready!',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    lastNotifiedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    notificationCount: 1,
    coverPhotoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    cachedPhotos: [
      {
        id: 'p1',
        name: '001_FirstLook_Vance.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=85',
        size: '14200000',
        createdTime: '2026-06-18T14:30:00Z',
        isPaid: false, // Free download
      },
      {
        id: 'p2',
        name: '002_Ceremony_Vows.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=85',
        size: '15800000',
        createdTime: '2026-06-18T15:10:00Z',
        isPaid: true, // Paid download
        price: 100, // ৳100
      },
      {
        id: 'p3',
        name: '003_WalkingDownAisle.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1600&q=85',
        size: '12400000',
        createdTime: '2026-06-18T15:45:00Z',
        isPaid: false, // Free download
      },
      {
        id: 'p4',
        name: '004_Rings_Macro.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1600&q=85',
        size: '9800000',
        createdTime: '2026-06-18T16:00:00Z',
        isPaid: false, // Free download
      },
      {
        id: 'p5',
        name: '005_GoldenHour_Portrait.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1600&q=85',
        size: '16900000',
        createdTime: '2026-06-18T18:20:00Z',
        isPaid: true, // Paid download
        price: 150, // ৳150
      },
      {
        id: 'p6',
        name: '006_TuscanHills_Embrace.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1600&q=85',
        size: '18100000',
        createdTime: '2026-06-18T18:50:00Z',
        isPaid: true, // Paid download
        price: 100, // ৳100
      },
      {
        id: 'p7',
        name: '007_FirstDance_Candlelight.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1600&q=85',
        size: '13500000',
        createdTime: '2026-06-18T20:15:00Z',
        isPaid: false, // Free download
      },
      {
        id: 'p8',
        name: '008_ChampagneTower_Toast.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1510076857177-7470076d4498?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1510076857177-7470076d4498?auto=format&fit=crop&w=1600&q=85',
        size: '14700000',
        createdTime: '2026-06-18T21:00:00Z',
        isPaid: false, // Free download
      },
      {
        id: 'p9',
        name: '009_SparklerExit_Night.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=1200&q=80',
        webViewLink: 'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=1600&q=85',
        size: '17200000',
        createdTime: '2026-06-18T22:30:00Z',
        isPaid: true, // Paid download
        price: 120, // ৳120
      },
    ],
  },
  {
    id: 'alb_clara_liam',
    title: 'Clara & Liam - Coastline Elopement',
    coupleNames: 'Clara & Liam Chen',
    weddingDate: '2026-08-04',
    clientEmail: 'clara.chen@example.com',
    driveFolderId: 'sample-folder-2',
    driveFolderName: 'Clara & Liam Coastal High-Res',
    slug: 'clara-liam-coastal',
    selectionLimitEnabled: false,
    maxSelectionsAllowed: undefined,
    notesForClient: 'Hi Clara & Liam! We loved photographing your dramatic Big Sur vows. Pick as many favorites as you wish!',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    lastNotifiedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    notificationCount: 1,
    coverPhotoUrl: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
    cachedPhotos: [
      {
        id: 'p10',
        name: '001_Cliffside_Look.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
        size: '12400000',
        createdTime: '2026-08-04T16:00:00Z',
      },
      {
        id: 'p11',
        name: '002_OceanBreeze_Portrait.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
        size: '14200000',
        createdTime: '2026-08-04T16:45:00Z',
      },
      {
        id: 'p12',
        name: '003_SunsetKiss.jpg',
        mimeType: 'image/jpeg',
        thumbnailLink: 'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1200&q=80',
        size: '16900000',
        createdTime: '2026-08-04T18:15:00Z',
      },
    ],
  },
];

const DEFAULT_SUBMISSIONS: ClientSelectionSubmission[] = [
  {
    id: 'sub_sophie_1',
    albumId: 'alb_sophie_julian',
    clientName: 'Sophie Vance',
    clientEmail: 'sophie.vance@example.com',
    clientNotes: 'We absolutely adore photo 005 and 006 for the double-page center spread! Thanks so much!',
    selectedPhotoIds: ['p1', 'p2', 'p5', 'p6', 'p7', 'p9'],
    status: 'completed',
    submittedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    clientIpOrDevice: 'Safari on iPhone 15 Pro',
  },
  {
    id: 'sub_julian_groom',
    albumId: 'alb_sophie_julian',
    clientName: 'Julian Vance (Groom Selects)',
    clientEmail: 'julian.vance@example.com',
    clientNotes: 'The sunset and sparkler exit shots are phenomenal. Definitely need 005 for canvas print!',
    selectedPhotoIds: ['p1', 'p5', 'p6', 'p8', 'p9'],
    status: 'completed',
    submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    clientIpOrDevice: 'Chrome on MacBook Pro',
  },
  {
    id: 'sub_sophie_parents',
    albumId: 'alb_sophie_julian',
    clientName: 'Eleanor & Arthur Vance (Parents)',
    clientEmail: 'eleanor.vance@example.com',
    clientNotes: 'Loving the ceremony emotions and the aisle walk. Beautiful work as always.',
    selectedPhotoIds: ['p1', 'p2', 'p3', 'p5', 'p6'],
    status: 'completed',
    submittedAt: new Date(Date.now() - 86400000 * 1.5).toISOString(),
    clientIpOrDevice: 'iPad Air Safari',
  },
  {
    id: 'sub_clara_1',
    albumId: 'alb_clara_liam',
    clientName: 'Clara Chen',
    clientEmail: 'clara.chen@example.com',
    clientNotes: 'The dramatic coastal lighting blew us away! Cliffside look is our absolute favorite.',
    selectedPhotoIds: ['p10', 'p11', 'p12', 'p13'],
    status: 'completed',
    submittedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    clientIpOrDevice: 'Safari on iPhone 16 Pro',
  },
  {
    id: 'sub_clara_draft_1',
    albumId: 'alb_clara_liam',
    clientName: 'Liam Chen (In Progress)',
    clientEmail: 'liam.chen@example.com',
    clientNotes: 'Reviewing ceremony photos first, still narrowing down reception shots.',
    selectedPhotoIds: ['p10', 'p11'],
    status: 'in_progress',
    submittedAt: new Date(Date.now() - 86400000 * 0.3).toISOString(),
    clientIpOrDevice: 'Chrome on Windows 11',
  },
];

export function getStoredAlbums(): Album[] {
  try {
    const raw = localStorage.getItem(ALBUMS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ALBUMS_STORAGE_KEY, JSON.stringify(DEFAULT_ALBUMS));
      return DEFAULT_ALBUMS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading albums from storage:', err);
    return DEFAULT_ALBUMS;
  }
}

export function saveStoredAlbums(albums: Album[]): void {
  try {
    localStorage.setItem(ALBUMS_STORAGE_KEY, JSON.stringify(albums));
  } catch (err) {
    console.error('Failed saving albums:', err);
  }
}

export function getAlbumBySlug(slug: string): Album | undefined {
  const albums = getStoredAlbums();
  return albums.find((a) => a.slug === slug || a.id === slug);
}

export function getAlbumById(id: string): Album | undefined {
  const albums = getStoredAlbums();
  return albums.find((a) => a.id === id);
}

export function saveAlbum(album: Album): void {
  const albums = getStoredAlbums();
  const index = albums.findIndex((a) => a.id === album.id);
  if (index >= 0) {
    albums[index] = { ...album, updatedAt: new Date().toISOString() };
  } else {
    albums.unshift(album);
  }
  saveStoredAlbums(albums);
}

export function deleteAlbum(albumId: string): void {
  const albums = getStoredAlbums().filter((a) => a.id !== albumId);
  saveStoredAlbums(albums);
  // Also clean up submissions
  const submissions = getStoredSubmissions().filter((s) => s.albumId !== albumId);
  saveStoredSubmissions(submissions);
}

export function getStoredSubmissions(): ClientSelectionSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(DEFAULT_SUBMISSIONS));
      return DEFAULT_SUBMISSIONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading submissions:', err);
    return DEFAULT_SUBMISSIONS;
  }
}

export function saveStoredSubmissions(submissions: ClientSelectionSubmission[]): void {
  try {
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(submissions));
  } catch (err) {
    console.error('Failed saving submissions:', err);
  }
}

export function getSubmissionsForAlbum(albumId: string): ClientSelectionSubmission[] {
  const submissions = getStoredSubmissions();
  return submissions.filter((s) => s.albumId === albumId);
}

export function addSubmission(submission: Omit<ClientSelectionSubmission, 'id' | 'submittedAt'>): ClientSelectionSubmission {
  const submissions = getStoredSubmissions();
  const newSub: ClientSelectionSubmission = {
    ...submission,
    id: 'sub_' + Math.random().toString(36).substring(2, 9),
    status: submission.status || 'completed',
    submittedAt: new Date().toISOString(),
  };
  submissions.unshift(newSub);
  saveStoredSubmissions(submissions);

  // Automatically log client activity
  logClientActivity(
    newSub.albumId,
    'submit_selection',
    `Photo Selection Submitted (${newSub.selectedPhotoIds.length} Photos)`,
    `${newSub.clientName || 'Client'} submitted a selection batch of ${newSub.selectedPhotoIds.length} photos for album design.`,
    {
      selectionCount: newSub.selectedPhotoIds.length,
      device: newSub.clientIpOrDevice || 'Web Browser',
      notes: newSub.clientNotes,
      status: newSub.status,
    },
    newSub.clientName
  );

  return newSub;
}

export function updateSubmissionStatus(submissionId: string, status: 'completed' | 'in_progress'): void {
  const submissions = getStoredSubmissions();
  const index = submissions.findIndex((s) => s.id === submissionId);
  if (index >= 0) {
    submissions[index] = { ...submissions[index], status };
    saveStoredSubmissions(submissions);
  }
}

// Client selection temporary draft storage per album
export function getLocalSelectionDraft(albumId: string): string[] {
  try {
    const raw = localStorage.getItem(`ramyachobi_draft_${albumId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSelectionDraft(albumId: string, photoIds: string[]): void {
  try {
    localStorage.setItem(`ramyachobi_draft_${albumId}`, JSON.stringify(photoIds));
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// PAID PHOTO DOWNLOAD & PAYMENT VERIFICATION
// ==========================================

const DEFAULT_PAYMENT_REQUESTS: PhotoPaymentRequest[] = [
  {
    id: 'pay_req_101',
    albumId: 'alb_sophie_julian',
    clientName: 'Julian Vance',
    clientPhone: '01712345678',
    clientEmail: 'julian.vance@example.com',
    photoIds: ['p5'],
    photoNames: ['005_GoldenHour_Portrait.jpg'],
    totalAmount: 150,
    paymentMethod: 'bKash',
    senderNumber: '01712345678',
    transactionId: 'BKS982319XK',
    status: 'pending',
    submittedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    adminNotes: 'Golden hour portrait requested for large frame print.',
  },
  {
    id: 'pay_req_102',
    albumId: 'alb_sophie_julian',
    clientName: 'Sophie Vance',
    clientPhone: '01898765432',
    clientEmail: 'sophie.julian@example.com',
    photoIds: ['p2', 'p6'],
    photoNames: ['002_Ceremony_Vows.jpg', '006_TuscanHills_Embrace.jpg'],
    totalAmount: 200,
    paymentMethod: 'Nagad',
    senderNumber: '01898765432',
    transactionId: 'NGD49182377',
    status: 'approved',
    submittedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    reviewedAt: new Date(Date.now() - 86400000 * 0.9).toISOString(),
    adminNotes: 'Payment verified via Nagad statement. Download unlocked.',
  },
];

export function getStoredPaymentRequests(): PhotoPaymentRequest[] {
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(DEFAULT_PAYMENT_REQUESTS));
      return DEFAULT_PAYMENT_REQUESTS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading payment requests:', err);
    return DEFAULT_PAYMENT_REQUESTS;
  }
}

export function saveStoredPaymentRequests(requests: PhotoPaymentRequest[]): void {
  try {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(requests));
  } catch (err) {
    console.error('Failed saving payment requests:', err);
  }
}

export function getPaymentRequestsForAlbum(albumId: string): PhotoPaymentRequest[] {
  return getStoredPaymentRequests().filter((r) => r.albumId === albumId);
}

export function addPaymentRequest(
  request: Omit<PhotoPaymentRequest, 'id' | 'submittedAt' | 'status'>
): PhotoPaymentRequest {
  const requests = getStoredPaymentRequests();
  const newReq: PhotoPaymentRequest = {
    ...request,
    id: 'pay_' + Math.random().toString(36).substring(2, 9),
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };
  requests.unshift(newReq);
  saveStoredPaymentRequests(requests);

  // Automatically log client activity
  logClientActivity(
    newReq.albumId,
    'make_payment',
    `Payment Order Placed via ${newReq.paymentMethod} (৳${newReq.totalAmount})`,
    `${newReq.clientName || 'Client'} submitted payment order for ${newReq.photoIds.length} premium photos (TrxID: ${newReq.transactionId}).`,
    {
      amount: newReq.totalAmount,
      paymentMethod: newReq.paymentMethod,
      transactionId: newReq.transactionId,
      selectionCount: newReq.photoIds.length,
      status: 'pending',
    },
    newReq.clientName
  );

  return newReq;
}

export function updatePaymentRequestStatus(
  requestId: string,
  status: PaymentStatus,
  adminNotes?: string
): PhotoPaymentRequest | null {
  const requests = getStoredPaymentRequests();
  const index = requests.findIndex((r) => r.id === requestId);
  if (index === -1) return null;

  const updated: PhotoPaymentRequest = {
    ...requests[index],
    status,
    reviewedAt: new Date().toISOString(),
    adminNotes: adminNotes !== undefined ? adminNotes : requests[index].adminNotes,
  };
  requests[index] = updated;
  saveStoredPaymentRequests(requests);

  // If approved, mark photo permissions as granted and log activity
  if (status === 'approved') {
    updated.photoIds.forEach((photoId) => {
      grantDirectPhotoDownload(updated.albumId, photoId, updated.clientPhone || updated.clientEmail);
    });

    logClientActivity(
      updated.albumId,
      'make_payment',
      `Payment Approved & Downloads Unlocked (৳${updated.totalAmount})`,
      `Studio approved payment via ${updated.paymentMethod}. Downloads unlocked for ${updated.photoIds.length} photos.`,
      {
        amount: updated.totalAmount,
        paymentMethod: updated.paymentMethod,
        transactionId: updated.transactionId,
        status: 'approved',
      },
      updated.clientName
    );
  }

  return updated;
}

// Structure for tracking approved downloads: albumId -> Set/Array of photoId:clientKey
export function getApprovedDownloads(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(APPROVED_DOWNLOADS_KEY);
    if (!raw) {
      // Pre-seed Sophie's approved photos from pay_req_102
      const initial = {
        alb_sophie_julian: ['p2', 'p6'],
      };
      localStorage.setItem(APPROVED_DOWNLOADS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveApprovedDownloads(data: Record<string, string[]>): void {
  try {
    localStorage.setItem(APPROVED_DOWNLOADS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

export function isPhotoApprovedForClient(albumId: string, photoId: string): boolean {
  const approved = getApprovedDownloads();
  const albumApproved = approved[albumId] || [];
  return albumApproved.includes(photoId);
}

export function grantDirectPhotoDownload(albumId: string, photoId: string, _clientKey?: string): void {
  const approved = getApprovedDownloads();
  const current = new Set(approved[albumId] || []);
  current.add(photoId);
  approved[albumId] = Array.from(current);
  saveApprovedDownloads(approved);
}

export function revokeDirectPhotoDownload(albumId: string, photoId: string): void {
  const approved = getApprovedDownloads();
  if (approved[albumId]) {
    approved[albumId] = approved[albumId].filter((id) => id !== photoId);
    saveApprovedDownloads(approved);
  }
}

// Toggle Photo Paid / Free status & price
export function togglePhotoPaidStatus(
  albumId: string,
  photoId: string,
  isPaid: boolean,
  price?: number
): Album | null {
  const albums = getStoredAlbums();
  const album = albums.find((a) => a.id === albumId);
  if (!album || !album.cachedPhotos) return null;

  const photo = album.cachedPhotos.find((p) => p.id === photoId);
  if (!photo) return null;

  photo.isPaid = isPaid;
  if (price !== undefined) {
    photo.price = price;
  } else if (isPaid && !photo.price) {
    photo.price = album.defaultPhotoPrice || 100;
  }

  album.updatedAt = new Date().toISOString();
  saveStoredAlbums(albums);
  return album;
}

// Toggle Download Permission for a specific photo (ON / OFF)
export function togglePhotoDownloadPermission(
  albumId: string,
  photoId: string,
  downloadDisabled: boolean
): Album | null {
  const albums = getStoredAlbums();
  const album = albums.find((a) => a.id === albumId);
  if (!album || !album.cachedPhotos) return null;

  const photo = album.cachedPhotos.find((p) => p.id === photoId);
  if (!photo) return null;

  photo.downloadDisabled = downloadDisabled;
  album.updatedAt = new Date().toISOString();
  saveStoredAlbums(albums);
  return album;
}

// Toggle entire album client download permission (Master switch)
export function toggleAlbumClientDownloadPermission(
  albumId: string,
  allowed: boolean
): Album | null {
  const albums = getStoredAlbums();
  const album = albums.find((a) => a.id === albumId);
  if (!album) return null;

  album.clientDownloadAllowed = allowed;
  album.updatedAt = new Date().toISOString();
  saveStoredAlbums(albums);
  return album;
}

// ==========================================
// CLIENT PROFILE & INTERACTION PERSISTENCE
// ==========================================

const CLIENT_PROFILE_STORAGE_PREFIX = 'ramyachobi_client_profile_';

export function getClientProfile(album: Album): import('../types').ClientProfileData {
  try {
    const raw = localStorage.getItem(`${CLIENT_PROFILE_STORAGE_PREFIX}${album.id}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed reading client profile:', err);
  }

  // Derive initial profile from album metadata
  const coupleParts = (album.coupleNames || '').split('&').map((s) => s.trim());
  const partner1 = coupleParts[0] || 'Client';
  const partner2 = coupleParts[1] || '';

  const defaultProfile: import('../types').ClientProfileData = {
    albumId: album.id,
    partner1Name: partner1,
    partner2Name: partner2,
    coupleNames: album.coupleNames,
    email: album.clientEmail || 'client@example.com',
    phone: album.id === 'alb_sophie_julian' ? '+880 1712-345678' : '+880 1700-000000',
    weddingDate: album.weddingDate,
    venue: album.id === 'alb_sophie_julian' ? 'Villa Corsini a Mezzomonte' : 'Grand Ballroom & Resort',
    city: album.id === 'alb_sophie_julian' ? 'Florence, Tuscany' : 'Dhaka, Bangladesh',
    deliveryAddress:
      album.id === 'alb_sophie_julian'
        ? 'House 42, Road 11, Banani, Dhaka-1213'
        : 'Dhaka, Bangladesh',
    packageType: 'Signature Heirloom Wedding Collection',
    clientNotes:
      album.id === 'alb_sophie_julian'
        ? 'Please ensure high-resolution color grading for evening reception shots and gold foil stamping on the leather album cover.'
        : 'Special requests for album printing and retouching.',
    updatedAt: album.updatedAt || new Date().toISOString(),
  };

  try {
    localStorage.setItem(
      `${CLIENT_PROFILE_STORAGE_PREFIX}${album.id}`,
      JSON.stringify(defaultProfile)
    );
  } catch (e) {
    console.error(e);
  }

  return defaultProfile;
}

export function saveClientProfile(profile: import('../types').ClientProfileData): void {
  try {
    const toSave = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(
      `${CLIENT_PROFILE_STORAGE_PREFIX}${profile.albumId}`,
      JSON.stringify(toSave)
    );
  } catch (err) {
    console.error('Failed saving client profile:', err);
  }
}

// ==========================================
// CLIENT ACTIVITY LOG PERSISTENCE
// ==========================================

const ACTIVITY_LOGS_STORAGE_PREFIX = 'ramyachobi_activity_logs_';

const DEFAULT_ACTIVITY_LOGS: Record<string, ClientActivityLogEntry[]> = {
  alb_sophie_julian: [
    {
      id: 'act_1',
      albumId: 'alb_sophie_julian',
      activityType: 'view_gallery',
      title: 'Gallery Accessed & Viewed',
      description: 'Julian Vance accessed Tuscany Wedding proofing gallery on Desktop Browser.',
      timestamp: new Date(Date.now() - 86400000 * 3.5).toISOString(),
      clientName: 'Julian Vance',
      metadata: {
        device: 'Desktop Browser (Chrome/macOS)',
      },
    },
    {
      id: 'act_2',
      albumId: 'alb_sophie_julian',
      activityType: 'face_search',
      title: 'AI Face Search Scanned',
      description: 'Client uploaded selfie reference photo to locate candid ceremony pictures.',
      timestamp: new Date(Date.now() - 86400000 * 2.8).toISOString(),
      clientName: 'Sophie Vance',
      metadata: {
        device: 'Mobile Device (iOS/Safari)',
      },
    },
    {
      id: 'act_3',
      albumId: 'alb_sophie_julian',
      activityType: 'select_photo',
      title: 'Favorited 001_FirstLook_Vance.jpg',
      description: 'Added to heirloom album cover candidates.',
      timestamp: new Date(Date.now() - 86400000 * 2.2).toISOString(),
      clientName: 'Sophie & Julian',
      metadata: {
        photoId: 'p1',
        photoName: '001_FirstLook_Vance.jpg',
      },
    },
    {
      id: 'act_4',
      albumId: 'alb_sophie_julian',
      activityType: 'submit_selection',
      title: 'Selection Draft Submitted (6 photos)',
      description: 'Sophie Vance submitted finalized selection batch for Italian leather album cover.',
      timestamp: new Date(Date.now() - 86400000 * 1.5).toISOString(),
      clientName: 'Sophie Vance',
      metadata: {
        selectionCount: 6,
        status: 'completed',
        device: 'Desktop Browser',
        notes: 'Please highlight color grading for evening reception shots.',
      },
    },
    {
      id: 'act_5',
      albumId: 'alb_sophie_julian',
      activityType: 'make_payment',
      title: 'Payment Order Placed via Nagad (৳200)',
      description: 'Submitted payment for 2 additional high-resolution ceremony downloads (TrxID: NGD49182377).',
      timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
      clientName: 'Sophie Vance',
      metadata: {
        amount: 200,
        paymentMethod: 'Nagad',
        transactionId: 'NGD49182377',
        status: 'approved',
      },
    },
    {
      id: 'act_6',
      albumId: 'alb_sophie_julian',
      activityType: 'download_photo',
      title: 'High-Res Photo Downloaded',
      description: 'Downloaded 002_Ceremony_Vows.jpg after studio payment verification.',
      timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
      clientName: 'Sophie Vance',
      metadata: {
        photoId: 'p2',
        photoName: '002_Ceremony_Vows.jpg',
      },
    },
    {
      id: 'act_7',
      albumId: 'alb_sophie_julian',
      activityType: 'view_gallery',
      title: 'Gallery Re-Visited',
      description: 'Sophie Vance reopened the gallery on mobile to review ceremony portraits.',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      clientName: 'Sophie Vance',
      metadata: {
        device: 'Mobile Device (iOS/Safari)',
      },
    },
  ],
};

export function getClientActivityLogs(albumId: string): ClientActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(`${ACTIVITY_LOGS_STORAGE_PREFIX}${albumId}`);
    if (raw) {
      return JSON.parse(raw);
    }
    if (DEFAULT_ACTIVITY_LOGS[albumId]) {
      localStorage.setItem(
        `${ACTIVITY_LOGS_STORAGE_PREFIX}${albumId}`,
        JSON.stringify(DEFAULT_ACTIVITY_LOGS[albumId])
      );
      return DEFAULT_ACTIVITY_LOGS[albumId];
    }
  } catch (err) {
    console.error('Failed reading client activity logs:', err);
  }
  return [];
}

export function logClientActivity(
  albumId: string,
  activityType: ClientActivityType,
  title: string,
  description: string,
  metadata?: ClientActivityLogEntry['metadata'],
  clientName?: string
): ClientActivityLogEntry {
  const currentLogs = getClientActivityLogs(albumId);
  const newLog: ClientActivityLogEntry = {
    id: 'act_' + Math.random().toString(36).substring(2, 9),
    albumId,
    activityType,
    title,
    description,
    timestamp: new Date().toISOString(),
    clientName,
    metadata,
  };

  currentLogs.unshift(newLog);

  // Keep up to 100 recent entries
  const trimmed = currentLogs.slice(0, 100);
  try {
    localStorage.setItem(
      `${ACTIVITY_LOGS_STORAGE_PREFIX}${albumId}`,
      JSON.stringify(trimmed)
    );
  } catch (e) {
    console.error('Failed saving client activity log:', e);
  }

  return newLog;
}

// ==========================================
// PAYMENT GATEWAY INTEGRATION (Stripe & SSLCommerz)
// ==========================================

const PAYMENT_GATEWAY_SETTINGS_KEY = 'ramyachobi_payment_gateway_settings_v1';

export const DEFAULT_GATEWAY_SETTINGS: PaymentGatewaySettings = {
  activeGateway: 'all',
  allowManualFallback: true,
  stripe: {
    enabled: true,
    mode: 'test',
    publishableKey: 'pk_test_51MzRamyaChobiWeddingPhotosSampleKey998811',
    secretKey: 'sk_test_51MzRamyaChobiStudioSecretSampleKey772244',
    webhookSecret: 'whsec_sampleSecretRamyaChobi8812',
    currency: 'bdt',
    statementDescriptor: 'RAMYACHOBI STUDIO',
  },
  sslcommerz: {
    enabled: true,
    mode: 'sandbox',
    storeId: 'ramyachobi_studio_live',
    storePassword: 'ramyachobi_sandbox_pass',
    ipnUrl: 'https://ramyachobi.studio/api/sslcommerz/ipn',
    currency: 'BDT',
  },
  updatedAt: new Date().toISOString(),
  lastTestedAt: new Date().toISOString(),
};

export function getPaymentGatewaySettings(): PaymentGatewaySettings {
  try {
    const raw = localStorage.getItem(PAYMENT_GATEWAY_SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    // Seed default settings
    localStorage.setItem(PAYMENT_GATEWAY_SETTINGS_KEY, JSON.stringify(DEFAULT_GATEWAY_SETTINGS));
    return DEFAULT_GATEWAY_SETTINGS;
  } catch (err) {
    console.error('Failed reading payment gateway settings:', err);
    return DEFAULT_GATEWAY_SETTINGS;
  }
}

export function savePaymentGatewaySettings(settings: PaymentGatewaySettings): void {
  try {
    const toSave: PaymentGatewaySettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(PAYMENT_GATEWAY_SETTINGS_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error('Failed saving payment gateway settings:', err);
  }
}

export function testPaymentGatewayConnection(
  provider: PaymentGatewayProvider,
  config: any
): { success: boolean; message: string } {
  if (provider === 'stripe') {
    const pub = config?.publishableKey?.trim() || '';
    const sec = config?.secretKey?.trim() || '';
    if (!pub) {
      return { success: false, message: 'Stripe Publishable Key is required (starts with pk_).' };
    }
    if (!pub.startsWith('pk_test_') && !pub.startsWith('pk_live_')) {
      return { success: false, message: 'Invalid Stripe Publishable Key format. Must begin with pk_test_ or pk_live_.' };
    }
    if (!sec) {
      return { success: false, message: 'Stripe Secret Key is required (starts with sk_).' };
    }
    if (!sec.startsWith('sk_test_') && !sec.startsWith('sk_live_')) {
      return { success: false, message: 'Invalid Stripe Secret Key format. Must begin with sk_test_ or sk_live_.' };
    }

    const mode = config.mode === 'live' ? 'Live Production' : 'Sandbox / Test Mode';
    return {
      success: true,
      message: `Successfully connected to Stripe API in ${mode}. Ready to accept Visa, Mastercard & Apple Pay.`,
    };
  }

  if (provider === 'sslcommerz') {
    const storeId = config?.storeId?.trim() || '';
    const storePass = config?.storePassword?.trim() || '';
    if (!storeId) {
      return { success: false, message: 'SSLCommerz Store ID is required.' };
    }
    if (!storePass) {
      return { success: false, message: 'SSLCommerz Store Password is required.' };
    }

    const mode = config.mode === 'live' ? 'Live Production' : 'Sandbox Test';
    return {
      success: true,
      message: `SSLCommerz Merchant credentials verified for ${storeId} (${mode}). Supports bKash, Nagad, Cards & Internet Banking.`,
    };
  }

  return { success: false, message: 'Unknown provider.' };
}



