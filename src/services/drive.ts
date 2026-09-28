import { DriveFolder, DrivePhoto, DriveSharedDrive, DriveSyncStats, Album } from '../types';
import { TokenExpiredError } from './auth';

/**
 * Handle Google Drive API Errors consistently and provide human-friendly messages
 */
async function handleDriveError(res: Response, defaultMessage: string): Promise<never> {
  let errorDetails = '';
  try {
    const errorJson = await res.json();
    const gError = errorJson.error;
    if (gError) {
      if (res.status === 401) {
        throw new TokenExpiredError('Your Google Drive authorization has expired. Please reconnect your account.');
      }
      if (res.status === 403) {
        const reason = gError.errors?.[0]?.reason;
        if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded' || reason === 'dailyLimitExceeded') {
          throw new Error('Google Drive API quota limit reached. Please wait a moment and try again.');
        }
        throw new Error('Permission denied. Ensure your Google account has access to this folder or shared drive.');
      }
      if (res.status === 404) {
        throw new Error('The requested folder or file could not be found. It may have been moved or deleted.');
      }
      errorDetails = gError.message || JSON.stringify(gError);
    }
  } catch (parseErr: any) {
    if (parseErr instanceof TokenExpiredError) throw parseErr;
    if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
    errorDetails = await res.text().catch(() => res.statusText);
  }

  console.error(`[Drive API Error ${res.status}]`, defaultMessage, errorDetails);
  throw new Error(`${defaultMessage} (HTTP ${res.status}: ${errorDetails || res.statusText})`);
}

/**
 * Safely escape text for Google Drive v3 query strings
 */
export function escapeDriveQuery(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Extract Google Drive Folder ID from pasted link or raw ID
 */
export function parseDriveFolderIdFromUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern: drive.google.com/drive/folders/FOLDER_ID or drive/u/1/folders/FOLDER_ID
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Pattern: drive.google.com/open?id=FOLDER_ID or id=FOLDER_ID
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  // Pattern: drive.google.com/file/d/ID
  const fileDMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // If already clean ID (15+ alphanumeric chars with dashes/underscores)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Validate that a folder ID exists and is a folder
 */
export async function validateDriveFolder(accessToken: string, folderId: string): Promise<DriveFolder> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${folderId}`);
  url.searchParams.append('supportsAllDrives', 'true');
  url.searchParams.append('fields', 'id, name, mimeType, createdTime, modifiedTime, parents, driveId');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    await handleDriveError(res, 'Could not access the specified Google Drive folder');
  }

  const data = await res.json();
  if (data.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error(`The provided link points to a ${data.mimeType || 'file'}, not a Google Drive folder.`);
  }

  return data as DriveFolder;
}

/**
 * List folders inside a parent folder or root of My Drive
 */
export async function listDriveFolders(
  accessToken: string,
  parentId = 'root',
  driveId?: string
): Promise<DriveFolder[]> {
  const folders: DriveFolder[] = [];
  let pageToken: string | undefined = undefined;

  let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (parentId === 'root' && !driveId) {
    query += " and 'root' in parents";
  } else if (parentId) {
    query += ` and '${escapeDriveQuery(parentId)}' in parents`;
  }

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.append('q', query);
    url.searchParams.append(
      'fields',
      'nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, parents, driveId)'
    );
    url.searchParams.append('pageSize', '100');
    url.searchParams.append('orderBy', 'folder,name');
    url.searchParams.append('supportsAllDrives', 'true');
    url.searchParams.append('includeItemsFromAllDrives', 'true');

    if (driveId) {
      url.searchParams.append('corpora', 'drive');
      url.searchParams.append('driveId', driveId);
    }

    if (pageToken) {
      url.searchParams.append('pageToken', pageToken);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      await handleDriveError(res, 'Failed to list Google Drive folders');
    }

    const data = await res.json();
    if (data.files) {
      folders.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken && folders.length < 500);

  return folders;
}

/**
 * Search Drive folders by partial name match
 */
export async function searchDriveFolders(
  accessToken: string,
  searchTerm: string,
  driveId?: string
): Promise<DriveFolder[]> {
  const cleanTerm = escapeDriveQuery(searchTerm.trim());
  if (!cleanTerm) return [];

  const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name contains '${cleanTerm}'`;

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.append('q', query);
  url.searchParams.append(
    'fields',
    'files(id, name, mimeType, createdTime, modifiedTime, parents, driveId)'
  );
  url.searchParams.append('pageSize', '50');
  url.searchParams.append('orderBy', 'modifiedTime desc');
  url.searchParams.append('supportsAllDrives', 'true');
  url.searchParams.append('includeItemsFromAllDrives', 'true');

  if (driveId) {
    url.searchParams.append('corpora', 'drive');
    url.searchParams.append('driveId', driveId);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    await handleDriveError(res, 'Error searching folders in Google Drive');
  }

  const data = await res.json();
  return (data.files || []) as DriveFolder[];
}

/**
 * List recent folders sorted by modifiedTime desc
 */
export async function listRecentFolders(accessToken: string, limit = 30): Promise<DriveFolder[]> {
  const query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.append('q', query);
  url.searchParams.append(
    'fields',
    'files(id, name, mimeType, createdTime, modifiedTime, parents, driveId)'
  );
  url.searchParams.append('pageSize', String(limit));
  url.searchParams.append('orderBy', 'modifiedTime desc');
  url.searchParams.append('supportsAllDrives', 'true');
  url.searchParams.append('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    await handleDriveError(res, 'Failed to fetch recent folders');
  }

  const data = await res.json();
  return (data.files || []) as DriveFolder[];
}

/**
 * List Shared Drives accessible by the user
 */
export async function listSharedDrives(accessToken: string): Promise<DriveSharedDrive[]> {
  try {
    const url = new URL('https://www.googleapis.com/drive/v3/drives');
    url.searchParams.append('pageSize', '50');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      // Shared drives might return 403 if domain doesn't use Google Workspace; fail silently
      return [];
    }

    const data = await res.json();
    return (data.drives || []) as DriveSharedDrive[];
  } catch (err) {
    console.warn('Shared Drives not supported or inaccessible:', err);
    return [];
  }
}

/**
 * List folders shared with the user
 */
export async function listSharedWithMeFolders(accessToken: string): Promise<DriveFolder[]> {
  const query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false and sharedWithMe = true";

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.append('q', query);
  url.searchParams.append(
    'fields',
    'files(id, name, mimeType, createdTime, modifiedTime, parents, driveId)'
  );
  url.searchParams.append('pageSize', '50');
  url.searchParams.append('orderBy', 'modifiedTime desc');
  url.searchParams.append('supportsAllDrives', 'true');
  url.searchParams.append('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    await handleDriveError(res, 'Failed to fetch shared folders');
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({ ...f, sharedWithMe: true })) as DriveFolder[];
}

/**
 * Fetch direct child subfolders of a folder (non-recursive)
 */
async function getChildFolders(accessToken: string, parentId: string): Promise<DriveFolder[]> {
  const query = `'${escapeDriveQuery(parentId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.append('q', query);
  url.searchParams.append('fields', 'files(id, name, mimeType, parents)');
  url.searchParams.append('pageSize', '100');
  url.searchParams.append('supportsAllDrives', 'true');
  url.searchParams.append('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.files || []) as DriveFolder[];
}

/**
 * Fetch images inside a single folder with pagination
 */
async function fetchImagesInSingleFolder(
  accessToken: string,
  folderId: string,
  folderName: string,
  maxPerFolder = 500
): Promise<DrivePhoto[]> {
  const photos: DrivePhoto[] = [];
  let pageToken: string | undefined = undefined;

  // Broad image filter covering all photography formats
  const query = `'${escapeDriveQuery(folderId)}' in parents and trashed = false and (mimeType contains 'image/' or name contains '.jpg' or name contains '.jpeg' or name contains '.png' or name contains '.webp' or name contains '.heic' or name contains '.heif' or name contains '.raw' or name contains '.cr2' or name contains '.nef' or name contains '.arw' or name contains '.dng' or name contains '.tiff')`;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.append('q', query);
    url.searchParams.append(
      'fields',
      'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink, iconLink, size, createdTime, modifiedTime, imageMediaMetadata)'
    );
    url.searchParams.append('pageSize', '100');
    url.searchParams.append('orderBy', 'name');
    url.searchParams.append('supportsAllDrives', 'true');
    url.searchParams.append('includeItemsFromAllDrives', 'true');

    if (pageToken) {
      url.searchParams.append('pageToken', pageToken);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      await handleDriveError(res, `Failed to load images from folder "${folderName}"`);
    }

    const data = await res.json();
    const rawFiles: any[] = data.files || [];

    for (const file of rawFiles) {
      let thumbnail = file.thumbnailLink;
      if (thumbnail) {
        // High resolution thumbnail replacement
        thumbnail = thumbnail.replace(/=s\d+/, '=s1200');
      }

      photos.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        thumbnailLink: thumbnail,
        webContentLink: file.webContentLink,
        webViewLink: file.webViewLink,
        iconLink: file.iconLink,
        size: file.size,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        folderId,
        folderName,
        imageMediaMetadata: file.imageMediaMetadata,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken && photos.length < maxPerFolder);

  return photos;
}

/**
 * List all photo files inside a folder.
 * If includeSubfolders is true, recursively scans all descendant folders with circular reference protection.
 */
export async function listPhotosInFolder(
  accessToken: string,
  folderId: string,
  options?: {
    includeSubfolders?: boolean;
    folderName?: string;
    onProgress?: (count: number, currentFolder: string) => void;
  }
): Promise<DrivePhoto[]> {
  const includeSubfolders = options?.includeSubfolders !== false;
  const rootFolderName = options?.folderName || 'Gallery';

  if (!includeSubfolders) {
    const singleFolderPhotos = await fetchImagesInSingleFolder(accessToken, folderId, rootFolderName);
    options?.onProgress?.(singleFolderPhotos.length, rootFolderName);
    return singleFolderPhotos;
  }

  // Recursive Breadth-First-Search scanning
  const allPhotos: DrivePhoto[] = [];
  const folderQueue: { id: string; name: string }[] = [{ id: folderId, name: rootFolderName }];
  const visitedFolders = new Set<string>([folderId]);

  let processedCount = 0;
  const maxFoldersToScan = 80; // Safety threshold

  while (folderQueue.length > 0 && processedCount < maxFoldersToScan) {
    const current = folderQueue.shift()!;
    processedCount++;

    options?.onProgress?.(allPhotos.length, current.name);

    // 1. Fetch images in this folder
    try {
      const photos = await fetchImagesInSingleFolder(accessToken, current.id, current.name);
      allPhotos.push(...photos);
      options?.onProgress?.(allPhotos.length, current.name);
    } catch (err) {
      console.warn(`Could not read images from child folder ${current.name}:`, err);
    }

    // 2. Discover child subfolders
    try {
      const children = await getChildFolders(accessToken, current.id);
      for (const child of children) {
        if (!visitedFolders.has(child.id)) {
          visitedFolders.add(child.id);
          folderQueue.push({ id: child.id, name: child.name });
        }
      }
    } catch (err) {
      console.warn(`Could not read subfolders of ${current.name}:`, err);
    }
  }

  return allPhotos;
}

/**
 * Sync an album's photos from Google Drive, detecting new, updated, and missing files
 */
export async function syncAlbumPhotos(
  accessToken: string,
  album: Album,
  onProgress?: (status: string) => void
): Promise<{ updatedAlbum: Album; stats: DriveSyncStats }> {
  onProgress?.(`Connecting to Google Drive folder "${album.driveFolderName}"...`);

  // Scan live photos from Drive
  const livePhotos = await listPhotosInFolder(accessToken, album.driveFolderId, {
    includeSubfolders: album.includeSubfolders !== false,
    folderName: album.driveFolderName,
    onProgress: (count, folder) => {
      onProgress?.(`Scanned ${count} photos (Scanning: ${folder})...`);
    },
  });

  const existingMap = new Map<string, DrivePhoto>();
  (album.cachedPhotos || []).forEach((p) => existingMap.set(p.id, p));

  const liveMap = new Map<string, DrivePhoto>();
  livePhotos.forEach((p) => liveMap.set(p.id, p));

  let newPhotosCount = 0;
  let updatedPhotosCount = 0;
  let missingPhotosCount = 0;

  // Build merged photo list, preserving admin custom settings (isPaid, price, downloadDisabled)
  const mergedPhotos: DrivePhoto[] = [];

  livePhotos.forEach((livePhoto) => {
    const existing = existingMap.get(livePhoto.id);
    if (!existing) {
      newPhotosCount++;
      mergedPhotos.push(livePhoto);
    } else {
      // Check if file was modified
      const isModified =
        existing.modifiedTime !== livePhoto.modifiedTime ||
        existing.name !== livePhoto.name ||
        existing.size !== livePhoto.size;

      if (isModified) {
        updatedPhotosCount++;
      }

      // Preserve admin customizations
      mergedPhotos.push({
        ...livePhoto,
        isPaid: existing.isPaid,
        price: existing.price,
        downloadDisabled: existing.downloadDisabled,
      });
    }
  });

  // Calculate missing photos
  (album.cachedPhotos || []).forEach((p) => {
    if (!liveMap.has(p.id)) {
      missingPhotosCount++;
    }
  });

  const syncTimestamp = new Date().toISOString();
  const stats: DriveSyncStats = {
    lastSynced: syncTimestamp,
    newPhotos: newPhotosCount,
    updatedPhotos: updatedPhotosCount,
    missingPhotos: missingPhotosCount,
    totalPhotos: mergedPhotos.length,
  };

  const updatedAlbum: Album = {
    ...album,
    cachedPhotos: mergedPhotos,
    coverPhotoUrl: mergedPhotos[0]?.thumbnailLink || album.coverPhotoUrl,
    lastSyncedAt: syncTimestamp,
    syncStats: stats,
    updatedAt: syncTimestamp,
  };

  return { updatedAlbum, stats };
}

/**
 * Create a non-destructive 'CLIENT SELECTED' folder in Google Drive and copy/shortcut selected photos
 */
export async function createClientSelectedFolderInDrive(
  accessToken: string,
  parentFolderId: string,
  selectedPhotoIds: string[],
  allPhotos: DrivePhoto[]
): Promise<{ folderId: string; folderName: string; shortcutCount: number }> {
  // 1. Check if folder already exists in parent
  const existingFolders = await getChildFolders(accessToken, parentFolderId);
  let targetFolder = existingFolders.find((f) => f.name.toUpperCase() === 'CLIENT SELECTED');

  if (!targetFolder) {
    // Create folder
    const createUrl = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true';
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'CLIENT SELECTED',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    });

    if (!res.ok) {
      await handleDriveError(res, 'Failed to create "CLIENT SELECTED" folder in Google Drive');
    }

    targetFolder = await res.json();
  }

  const selectedFolderId = targetFolder!.id;

  // 2. Create shortcuts for each selected photo in CLIENT SELECTED
  let shortcutCount = 0;
  for (const photoId of selectedPhotoIds) {
    const photo = allPhotos.find((p) => p.id === photoId);
    if (!photo) continue;

    try {
      const shortcutUrl = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true';
      const shortcutRes = await fetch(shortcutUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: photo.name,
          mimeType: 'application/vnd.google-apps.shortcut',
          shortcutDetails: { targetId: photo.id },
          parents: [selectedFolderId],
        }),
      });

      if (shortcutRes.ok) {
        shortcutCount++;
      }
    } catch (e) {
      console.warn(`Failed to create shortcut for photo ${photo.name}:`, e);
    }
  }

  return {
    folderId: selectedFolderId,
    folderName: 'CLIENT SELECTED',
    shortcutCount,
  };
}

/**
 * Download a file content as Blob with user's access token
 */
export async function downloadDriveFileBlob(accessToken: string, fileId: string): Promise<Blob> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    await handleDriveError(res, `Failed to download file ${fileId}`);
  }

  return await res.blob();
}
