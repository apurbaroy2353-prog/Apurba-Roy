import { DriveFolder, DrivePhoto } from '../types';

/**
 * Fetch folders in Google Drive for folder picker
 */
export async function listDriveFolders(accessToken: string, parentId?: string): Promise<DriveFolder[]> {
  let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.append('q', query);
  url.searchParams.append('fields', 'files(id, name, mimeType, createdTime)');
  url.searchParams.append('pageSize', '100');
  url.searchParams.append('orderBy', 'folder,name');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to list folders: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  return (data.files || []) as DriveFolder[];
}

/**
 * Search Drive folders by query text
 */
export async function searchDriveFolders(accessToken: string, searchTerm: string): Promise<DriveFolder[]> {
  const cleanSearch = searchTerm.replace(/'/g, "\\'");
  const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name contains '${cleanSearch}'`;

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.append('q', query);
  url.searchParams.append('fields', 'files(id, name, mimeType, createdTime)');
  url.searchParams.append('pageSize', '50');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to search folders: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return (data.files || []) as DriveFolder[];
}

/**
 * Fetch details of a single Drive folder
 */
export async function getDriveFolder(accessToken: string, folderId: string): Promise<DriveFolder> {
  const url = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,createdTime`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get folder info: ${res.status} ${errorText}`);
  }

  return await res.json();
}

/**
 * List all photo files inside a folder (including JPG, PNG, WEBP, HEIC, TIFF, RAW)
 */
export async function listPhotosInFolder(accessToken: string, folderId: string): Promise<DrivePhoto[]> {
  const query = `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or name contains '.jpg' or name contains '.jpeg' or name contains '.png' or name contains '.webp' or name contains '.heic' or name contains '.raw' or name contains '.cr2' or name contains '.nef' or name contains '.arw')`;

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.append('q', query);
  url.searchParams.append('fields', 'files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink, iconLink, size, createdTime, imageMediaMetadata)');
  url.searchParams.append('pageSize', '200');
  url.searchParams.append('orderBy', 'name');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch photos from Google Drive: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const rawFiles: any[] = data.files || [];

  return rawFiles.map((file) => {
    // Generate high quality thumbnail link if available
    let thumbnail = file.thumbnailLink;
    if (thumbnail) {
      // By default Google Drive thumbnail links have "=s220". We can adjust to "=s1600" or "=s800" for crisp high-res preview!
      thumbnail = thumbnail.replace(/=s\d+/, '=s1200');
    }

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      thumbnailLink: thumbnail,
      webContentLink: file.webContentLink,
      webViewLink: file.webViewLink,
      iconLink: file.iconLink,
      size: file.size,
      createdTime: file.createdTime,
      imageMediaMetadata: file.imageMediaMetadata,
    };
  });
}

/**
 * Download a file content as Blob with user's access token
 */
export async function downloadDriveFileBlob(accessToken: string, fileId: string): Promise<Blob> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download file ${fileId}: ${res.status} ${res.statusText}`);
  }

  return await res.blob();
}
