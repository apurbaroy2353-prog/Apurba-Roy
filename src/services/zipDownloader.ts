import JSZip from 'jszip';
import { Album, ClientSelectionSubmission, DrivePhoto } from '../types';
import { downloadDriveFileBlob } from './drive';

/**
 * Robustly fetches an image URL as a Blob, falling back to an in-memory Canvas
 * if CORS or standard fetch experiences issues.
 */
async function fetchImageBlobWithFallback(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      return await res.blob();
    }
  } catch (err) {
    // Continue to canvas fallback
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.95);
          return;
        }
      } catch (e) {
        // Tainted canvas or draw failure
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Downloads selected photos from Google Drive or image URLs and bundles them into a zip file.
 * Also includes an index manifest with photo filenames and client selection metadata.
 */
export async function downloadPhotosAsZip(
  photos: DrivePhoto[],
  options: {
    albumTitle: string;
    clientName?: string;
    accessToken?: string | null;
    zipFilename?: string;
    notes?: string;
    onProgress?: (completed: number, total: number, currentFileName: string) => void;
  }
): Promise<void> {
  const zip = new JSZip();
  const safeAlbum = options.albumTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeClient = options.clientName ? `_${options.clientName.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  const folderName = `${safeAlbum}${safeClient}_Selected`;
  const folder = zip.folder(folderName) || zip;

  const total = photos.length;
  let completed = 0;

  // Manifest text file
  const manifestLines = [
    `Wedding Photo Selection Manifest`,
    `========================================`,
    `Album: ${options.albumTitle}`,
    `Client: ${options.clientName || 'General Selection'}`,
    `Total Selected Photos: ${photos.length}`,
    `Archive Created: ${new Date().toLocaleString()}`,
  ];

  if (options.notes) {
    manifestLines.push(`Client Notes: ${options.notes}`);
  }

  manifestLines.push(
    `========================================`,
    `Files Included:`,
    ``
  );

  for (const photo of photos) {
    if (options.onProgress) {
      options.onProgress(completed, total, photo.name);
    }
    manifestLines.push(`- ${photo.name} (Drive ID: ${photo.id})`);

    try {
      let blob: Blob | null = null;

      // 1. Try Google Drive API direct download if accessToken is available and valid Drive ID
      if (options.accessToken && !photo.id.startsWith('p')) {
        try {
          blob = await downloadDriveFileBlob(options.accessToken, photo.id);
        } catch (err) {
          console.warn(`Drive direct download failed for ${photo.name}, trying thumbnail link fallback`, err);
        }
      }

      // 2. Fallback to image URL (thumbnail or webView)
      if (!blob && (photo.thumbnailLink || photo.webViewLink)) {
        const urlToFetch = photo.webViewLink || photo.thumbnailLink;
        blob = await fetchImageBlobWithFallback(urlToFetch!);
      }

      if (blob) {
        folder.file(photo.name, blob);
      } else {
        // Fallback placeholder note if neither succeeded
        folder.file(`${photo.name}.txt`, `Drive ID: ${photo.id}\nFilename: ${photo.name}\nCould not retrieve file binary.`);
      }
    } catch (err) {
      console.error(`Error archiving ${photo.name}:`, err);
      folder.file(`${photo.name}_error.txt`, `Error: ${(err as Error).message}`);
    }

    completed++;
    if (options.onProgress) {
      options.onProgress(completed, total, photo.name);
    }
  }

  manifestLines.push(``, `Generated via Wedding Proofing Admin Dashboard.`);
  folder.file('selection-summary.txt', manifestLines.join('\n'));

  // Generate zip file with optimal compression
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = options.zipFilename || `${folderName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Helper to download all selected photos for a specific submission
 */
export async function downloadSubmissionAsZip(
  submission: ClientSelectionSubmission,
  album: Album,
  accessToken?: string | null,
  onProgress?: (completed: number, total: number, currentFileName: string) => void
): Promise<void> {
  const allPhotos: DrivePhoto[] = album.cachedPhotos || [];
  
  // Resolve each selected photo ID
  const selectedPhotos: DrivePhoto[] = submission.selectedPhotoIds.map((id) => {
    const found = allPhotos.find((p) => p.id === id);
    if (found) return found;
    return {
      id,
      name: `Photo_${id}.jpg`,
      mimeType: 'image/jpeg',
      webViewLink: `https://drive.google.com/uc?id=${id}`,
    };
  });

  const safeAlbum = album.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeClient = submission.clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const zipFilename = `${safeAlbum}_${safeClient}_Selected_Photos.zip`;

  await downloadPhotosAsZip(selectedPhotos, {
    albumTitle: album.title,
    clientName: submission.clientName,
    notes: submission.clientNotes,
    accessToken,
    zipFilename,
    onProgress,
  });
}

/**
 * Copy file names list or CSV to clipboard for direct Lightroom / Capture One filter
 */
export function exportFilenamesForLightroom(photos: DrivePhoto[]): string {
  // Returns filenames separated by commas or newlines, standard for Adobe Lightroom Library filter
  return photos.map((p) => p.name.replace(/\.[^/.]+$/, '')).join(', ');
}

function escapeCSV(str: string): string {
  if (!str) return '""';
  const escaped = String(str).replace(/"/g, '""');
  return `"${escaped}"`;
}

function triggerFileDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Export client selection as a structured JSON file formatted for Adobe Lightroom ingestion & workflow automation
 */
export function exportSelectionToJSON(
  submission: ClientSelectionSubmission,
  album?: Album | null
): void {
  const allPhotos: DrivePhoto[] = album?.cachedPhotos || [];
  const selectedPhotos = submission.selectedPhotoIds.map((id, index) => {
    const found = allPhotos.find((p) => p.id === id);
    const filename = found ? found.name : `Photo_${id}.jpg`;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    return {
      sequenceNumber: index + 1,
      photoId: id,
      filename,
      baseName,
      mimeType: found?.mimeType || 'image/jpeg',
      rating: 5,
      colorLabel: 'Green',
      flag: 'Pick',
      webUrl: found?.webViewLink || '',
    };
  });

  const exportData = {
    exportFormat: 'Adobe_Lightroom_Ingestion_Manifest_v1',
    exportedAt: new Date().toISOString(),
    album: {
      id: album?.id || submission.albumId,
      title: album?.title || 'Wedding Album',
      coupleNames: album?.coupleNames || '',
      weddingDate: album?.weddingDate || '',
      driveFolderId: album?.driveFolderId || '',
      driveFolderName: album?.driveFolderName || '',
    },
    clientSubmission: {
      id: submission.id,
      clientName: submission.clientName,
      clientEmail: submission.clientEmail || '',
      submittedAt: submission.submittedAt,
      status: submission.status || 'completed',
      clientNotes: submission.clientNotes || '',
      totalSelected: selectedPhotos.length,
    },
    lightroomFilterString: selectedPhotos.map((p) => p.baseName).join(', '),
    photos: selectedPhotos,
  };

  const safeClient = (submission.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAlbum = (album?.title || 'Album').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeAlbum}_${safeClient}_Lightroom_Selection.json`;

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerFileDownload(blob, fileName);
}

/**
 * Export client selection as a CSV file compatible with Lightroom metadata ingestion, spreadsheet catalogs, and Capture One
 */
export function exportSelectionToCSV(
  submission: ClientSelectionSubmission,
  album?: Album | null
): void {
  const allPhotos: DrivePhoto[] = album?.cachedPhotos || [];
  const headers = [
    'Sequence',
    'Filename',
    'BaseName',
    'PhotoID',
    'Flag',
    'Rating',
    'ColorLabel',
    'ClientName',
    'ClientEmail',
    'AlbumTitle',
    'WeddingDate',
    'SubmittedAt',
    'Status',
    'ClientNotes',
  ];

  const rows = submission.selectedPhotoIds.map((id, index) => {
    const found = allPhotos.find((p) => p.id === id);
    const filename = found ? found.name : `Photo_${id}.jpg`;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    return [
      String(index + 1),
      escapeCSV(filename),
      escapeCSV(baseName),
      escapeCSV(id),
      'Pick',
      '5',
      'Green',
      escapeCSV(submission.clientName || ''),
      escapeCSV(submission.clientEmail || ''),
      escapeCSV(album?.title || ''),
      escapeCSV(album?.weddingDate || ''),
      escapeCSV(submission.submittedAt || ''),
      escapeCSV(submission.status || 'completed'),
      escapeCSV(submission.clientNotes || ''),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const safeClient = (submission.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAlbum = (album?.title || 'Album').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeAlbum}_${safeClient}_Lightroom_Selection.csv`;

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerFileDownload(blob, fileName);
}

/**
 * Triggers an immediate direct browser download for an individual photo
 */
export async function downloadSinglePhoto(
  photo: DrivePhoto,
  accessToken?: string | null
): Promise<boolean> {
  try {
    let blob: Blob | null = null;

    // 1. Try Google Drive API direct download if accessToken is available and not a mock/sample id
    if (accessToken && !photo.id.startsWith('p')) {
      try {
        blob = await downloadDriveFileBlob(accessToken, photo.id);
      } catch (err) {
        console.warn(`Drive direct download failed for ${photo.name}, falling back to image URL`, err);
      }
    }

    // 2. Fallback to image URL (webView or thumbnail)
    const url = photo.webViewLink || photo.thumbnailLink;
    if (!blob && url) {
      blob = await fetchImageBlobWithFallback(url);
    }

    const filename = photo.name.includes('.') ? photo.name : `${photo.name}.jpg`;

    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      return true;
    } else if (url) {
      // Fallback: trigger direct link download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }

    return false;
  } catch (err) {
    console.error('Error downloading individual photo:', err);
    return false;
  }
}
