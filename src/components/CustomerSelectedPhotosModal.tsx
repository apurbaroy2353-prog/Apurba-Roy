import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FileSpreadsheet,
  HardDrive,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  Layers,
  Archive,
  Check,
} from 'lucide-react';
import {
  CustomerGallery,
  CustomerPhotoSelection,
  DrivePhoto,
} from '../types';
import {
  copySelectedFilenamesToClipboard,
  exportSelectedFilenamesToTxt,
  exportSelectedPhotosToCsv,
  saveCustomerGallery,
} from '../services/customerGalleryService';
import { createClientSelectedFolderInDrive } from '../services/drive';
import { downloadSubmissionAsZip } from '../services/zipDownloader';

interface CustomerSelectedPhotosModalProps {
  gallery: CustomerGallery;
  isOpen: boolean;
  onClose: () => void;
  accessToken: string | null;
  onNeedGoogleSignIn: () => void;
  onUpdated: (gallery: CustomerGallery) => void;
}

export const CustomerSelectedPhotosModal: React.FC<CustomerSelectedPhotosModalProps> = ({
  gallery,
  isOpen,
  onClose,
  accessToken,
  onNeedGoogleSignIn,
  onUpdated,
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [isCollectingDrive, setIsCollectingDrive] = useState(false);
  const [collectSuccessMessage, setCollectSuccessMessage] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  if (!isOpen) return null;

  const selections: CustomerPhotoSelection[] = gallery.selections || [];

  const handleCopyFilenames = async () => {
    const success = await copySelectedFilenamesToClipboard(gallery);
    if (success) {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  const handleCollectInDrive = async () => {
    if (!accessToken) {
      onNeedGoogleSignIn();
      return;
    }
    if (selections.length === 0) {
      alert('No photos selected yet by customer.');
      return;
    }

    setIsCollectingDrive(true);
    setCollectSuccessMessage(null);

    try {
      // Map selections to DrivePhotos
      const allDrivePhotos: DrivePhoto[] = (gallery.photos || []).map((p) => ({
        id: p.id,
        name: p.name,
        mimeType: p.mimeType || 'image/jpeg',
        thumbnailLink: p.thumbnailUrl,
        webViewLink: p.previewUrl,
      }));

      const selectedIds = selections.map((s) => s.driveFileId || s.photoId);

      const result = await createClientSelectedFolderInDrive(
        accessToken,
        gallery.driveFolderId,
        selectedIds,
        allDrivePhotos
      );

      const updatedGallery: CustomerGallery = {
        ...gallery,
        collectedFolderId: result.folderId,
        lastActivity: `Collected ${result.shortcutCount} photos to Drive folder`,
      };

      await saveCustomerGallery(updatedGallery);
      onUpdated(updatedGallery);

      setCollectSuccessMessage(
        `Successfully collected ${result.shortcutCount} photos into Google Drive folder "${result.folderName}"!`
      );
    } catch (err: any) {
      console.error('Failed to collect photos in Google Drive:', err);
      alert('Failed to collect photos in Drive: ' + err.message);
    } finally {
      setIsCollectingDrive(false);
    }
  };

  const handleDownloadZip = async () => {
    if (selections.length === 0) {
      alert('No photos selected to download.');
      return;
    }
    setIsDownloadingZip(true);
    try {
      // Create a virtual submission object for the zip downloader
      const virtualSub = {
        id: gallery.id,
        albumId: gallery.id,
        clientName: gallery.customerName,
        selectedPhotoIds: selections.map((s) => s.photoId),
        submittedAt: gallery.submittedAt || new Date().toISOString(),
      };

      const virtualAlbum = {
        id: gallery.id,
        title: `${gallery.customerName} - ${gallery.eventName}`,
        coupleNames: gallery.customerName,
        weddingDate: gallery.selectionDeadline,
        driveFolderId: gallery.driveFolderId,
        driveFolderName: gallery.driveFolderName,
        slug: gallery.secureToken,
        createdAt: gallery.createdAt,
        updatedAt: gallery.updatedAt,
        cachedPhotos: (gallery.photos || []).map((p) => ({
          id: p.id,
          name: p.name,
          mimeType: p.mimeType || 'image/jpeg',
          thumbnailLink: p.thumbnailUrl,
          webViewLink: p.previewUrl,
        })),
      };

      await downloadSubmissionAsZip(virtualSub, virtualAlbum, accessToken);
    } catch (err: any) {
      console.error('Error generating zip:', err);
      alert('Could not download zip: ' + err.message);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-serif font-bold text-lg">
              RC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-serif font-semibold text-stone-100">
                  Customer Selected Photos
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {selections.length} Selected
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {gallery.customerName} • {gallery.eventName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="p-4 bg-stone-950/60 border-b border-stone-850 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy All Filenames */}
            <button
              onClick={handleCopyFilenames}
              className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copy Filenames</span>
                </>
              )}
            </button>

            {/* Download TXT */}
            <button
              onClick={() => exportSelectedFilenamesToTxt(gallery)}
              className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Download TXT</span>
            </button>

            {/* Download CSV */}
            <button
              onClick={() => exportSelectedPhotosToCsv(gallery)}
              className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download CSV</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Collect Selected Photos in Google Drive */}
            <button
              onClick={handleCollectInDrive}
              disabled={isCollectingDrive || selections.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Create a non-destructive 'Customer Selected' folder in Google Drive"
            >
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isCollectingDrive ? 'Collecting in Drive...' : 'Collect in Google Drive'}
              </span>
            </button>

            {/* Download ZIP */}
            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip || selections.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-sm"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isDownloadingZip ? 'Creating ZIP...' : 'Download ZIP'}</span>
            </button>
          </div>
        </div>

        {/* Success Message Banner */}
        {collectSuccessMessage && (
          <div className="p-3 mx-6 mt-4 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{collectSuccessMessage}</span>
          </div>
        )}

        {/* Photo List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {selections.length === 0 ? (
            <div className="py-16 text-center text-stone-500 text-xs">
              No photos have been selected by the customer yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selections.map((sel, idx) => {
                const orderNum = String(idx + 1).padStart(3, '0');
                const matchedPhoto = gallery.photos?.find((p) => p.id === sel.photoId);
                const thumb = sel.thumbnailUrl || matchedPhoto?.thumbnailUrl;

                return (
                  <div
                    key={sel.photoId + '_' + idx}
                    className="p-2.5 rounded-2xl bg-stone-950 border border-stone-850 flex items-center gap-3 group hover:border-amber-500/40 transition"
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-xl bg-stone-900 overflow-hidden shrink-0 border border-stone-800">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={sel.fileName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-600 font-mono">
                          #{orderNum}
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-stone-200 truncate font-mono">
                          <span className="text-amber-400 font-bold">{orderNum}</span> - {sel.fileName}
                        </p>
                      </div>
                      <p className="text-[10px] font-mono text-stone-500 truncate mt-0.5">
                        ID: {sel.driveFileId || sel.photoId}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400 shrink-0">
          <span>
            Total Selected: <strong className="text-amber-400">{selections.length}</strong> / {gallery.maxSelections} Max
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-750 text-stone-200 rounded-xl font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
