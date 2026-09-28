import React, { useState } from 'react';
import {
  Folder,
  Calendar,
  Sparkles,
  Link,
  Plus,
  AlertCircle,
  HardDrive,
  Check,
  X,
  RefreshCw,
  Sliders,
  Mail,
  Send,
} from 'lucide-react';
import { Album, DriveFolder, DrivePhoto } from '../types';
import { DriveFolderPickerModal, DriveFolderSelectionResult } from './DriveFolderPickerModal';
import { listPhotosInFolder } from '../services/drive';

interface CreateAlbumModalProps {
  isOpen: boolean;
  accessToken: string | null;
  onClose: () => void;
  onCreateAlbum: (album: Album, sendEmailNotification?: boolean) => void;
  onNeedGoogleSignIn: () => void;
}

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({
  isOpen,
  accessToken,
  onClose,
  onCreateAlbum,
  onNeedGoogleSignIn,
}) => {
  const [title, setTitle] = useState('');
  const [coupleNames, setCoupleNames] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [sendNotificationOnCreate, setSendNotificationOnCreate] = useState(true);
  const [selectionLimitEnabled, setSelectionLimitEnabled] = useState(true);
  const [maxSelections, setMaxSelections] = useState('35');
  const [notesForClient, setNotesForClient] = useState('');
  const [selectedFolderResult, setSelectedFolderResult] = useState<DriveFolderSelectionResult | null>(null);

  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenDrivePicker = () => {
    if (!accessToken) {
      onNeedGoogleSignIn();
      return;
    }
    setIsDrivePickerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !coupleNames.trim()) {
      setError('Please provide an album title and couple name(s).');
      return;
    }

    if (!selectedFolderResult) {
      setError('Please connect a Google Drive folder for this wedding album.');
      return;
    }

    setError(null);
    setIsSyncingDrive(true);

    try {
      // Use scanned preview photos or fetch live
      let fetchedPhotos: DrivePhoto[] = selectedFolderResult.previewPhotos;
      if (fetchedPhotos.length === 0 && accessToken && selectedFolderResult.folder.id) {
        try {
          fetchedPhotos = await listPhotosInFolder(accessToken, selectedFolderResult.folder.id, {
            includeSubfolders: selectedFolderResult.includeSubfolders,
            folderName: selectedFolderResult.folder.name,
          });
        } catch (syncErr: any) {
          console.warn('Could not auto-fetch photos from drive immediately:', syncErr);
        }
      }

      // Generate clean url slug
      const slug = coupleNames
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 6);

      const parsedMax = parseInt(maxSelections, 10);
      const limitVal = selectionLimitEnabled && !isNaN(parsedMax) && parsedMax > 0 ? parsedMax : undefined;

      const nowIso = new Date().toISOString();
      const newAlbum: Album = {
        id: 'alb_' + Math.random().toString(36).substring(2, 9),
        title: title.trim(),
        coupleNames: coupleNames.trim(),
        weddingDate: weddingDate.trim() || new Date().toISOString().split('T')[0],
        clientEmail: clientEmail.trim() || undefined,
        driveFolderId: selectedFolderResult.folder.id,
        driveFolderName: selectedFolderResult.folder.name,
        includeSubfolders: selectedFolderResult.includeSubfolders,
        slug,
        selectionLimitEnabled: selectionLimitEnabled && Boolean(limitVal),
        maxSelectionsAllowed: limitVal,
        notesForClient: notesForClient.trim() || undefined,
        coverPhotoUrl: fetchedPhotos[0]?.thumbnailLink || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastSyncedAt: nowIso,
        cachedPhotos: fetchedPhotos,
        syncStats: {
          lastSynced: nowIso,
          newPhotos: fetchedPhotos.length,
          updatedPhotos: 0,
          missingPhotos: 0,
          totalPhotos: fetchedPhotos.length,
        },
      };

      onCreateAlbum(newAlbum, sendNotificationOnCreate);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating album');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
        <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-medium text-stone-100">Create New Wedding Album</h3>
                <p className="text-xs text-stone-400">Connect Google Drive folder & publish private client proofing</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-stone-300 font-medium mb-1.5">
                Album Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Clara & Liam - Big Sur Coastal Wedding"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-stone-950/80 border border-stone-800 text-sm rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-300 font-medium mb-1.5">
                  Couple Name(s) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clara & Liam"
                  value={coupleNames}
                  onChange={(e) => setCoupleNames(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 text-sm rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1.5">
                  Wedding Date
                </label>
                <input
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 text-sm rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50"
                />
              </div>
            </div>

            {/* Client Email & Auto-Notification Option */}
            <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-2.5">
              <div>
                <label className="block text-stone-300 font-medium mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>Client Email Address (Optional)</span>
                  </span>
                  <span className="text-[11px] text-stone-500 font-normal">For gallery invitations</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. sophie.julian@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 text-xs rounded-xl px-3.5 py-2 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50 font-mono"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={sendNotificationOnCreate}
                  onChange={(e) => setSendNotificationOnCreate(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-stone-900 border-stone-700 focus:ring-amber-500 focus:ring-offset-stone-950"
                />
                <span className="text-xs text-stone-300">
                  Prompt to send email notification to client upon publishing
                </span>
              </label>
            </div>

            {/* Google Drive Folder Selector Box */}
            <div>
              <label className="block text-stone-300 font-medium mb-1.5 flex items-center justify-between">
                <span>Google Drive Photo Folder *</span>
                {!accessToken && (
                  <span className="text-[11px] text-amber-400">Sign in to browse Drive</span>
                )}
              </label>

              <div
                onClick={handleOpenDrivePicker}
                className={`p-3.5 rounded-xl border border-dashed cursor-pointer transition flex items-center justify-between ${
                  selectedFolderResult
                    ? 'bg-amber-500/10 border-amber-500/50 text-stone-200'
                    : 'bg-stone-950/60 border-stone-700 hover:border-stone-500 text-stone-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      selectedFolderResult ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    {selectedFolderResult ? (
                      <>
                        <p className="font-semibold text-stone-100 text-sm">{selectedFolderResult.folder.name}</p>
                        <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-0.5">
                          <span>{selectedFolderResult.previewPhotos.length} Photos Detected</span>
                          {selectedFolderResult.includeSubfolders && (
                            <span className="text-[10px] text-stone-400 font-mono">• (Subfolders Included)</span>
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-stone-300 text-xs">
                          {accessToken ? 'Click to browse & select Google Drive folder' : 'Connect Google Drive first'}
                        </p>
                        <p className="text-[11px] text-stone-500">Browse My Drive, Search, Recent, or Paste Link</p>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition"
                >
                  {selectedFolderResult ? 'Change Folder' : 'Browse Drive'}
                </button>
              </div>
            </div>

            {/* Selection Limit (Optional Cap) Feature */}
            <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-850 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    selectionLimitEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-stone-800 text-stone-500'
                  }`}>
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="text-stone-200 font-medium text-xs flex items-center gap-2 cursor-pointer" onClick={() => setSelectionLimitEnabled(!selectionLimitEnabled)}>
                      <span>Selection Limit (Cap)</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-md bg-stone-800 text-amber-400 font-normal">Optional</span>
                    </label>
                    <p className="text-[11px] text-stone-400">
                      Cap the maximum number of photos this client is allowed to pick
                    </p>
                  </div>
                </div>

                {/* iOS-style toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectionLimitEnabled}
                  onClick={() => setSelectionLimitEnabled(!selectionLimitEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors p-1 relative flex items-center ${
                    selectionLimitEnabled ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-stone-950 transition-transform ${
                      selectionLimitEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {selectionLimitEnabled ? (
                <div className="pt-2 border-t border-stone-850/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-[11px] font-medium text-stone-300">
                      Maximum Allowed Photos:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        required={selectionLimitEnabled}
                        value={maxSelections}
                        onChange={(e) => setMaxSelections(e.target.value)}
                        className="w-24 text-right bg-stone-900 border border-stone-800 text-sm font-semibold rounded-lg px-2.5 py-1 text-amber-300 focus:outline-hidden focus:border-amber-400"
                      />
                      <span className="text-xs text-stone-400">photos</span>
                    </div>
                  </div>

                  {/* Preset chips for fast photographer package selection */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-stone-500 mr-1">Presets:</span>
                    {[20, 30, 35, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMaxSelections(preset.toString())}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono transition ${
                          maxSelections === preset.toString()
                            ? 'bg-amber-500 text-stone-950 font-bold'
                            : 'bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-stone-500 italic">
                    When the client reaches {maxSelections || 'the limit'} photos, the gallery will prevent selecting additional photos until one is unselected.
                  </p>
                </div>
              ) : (
                <div className="pt-1 text-[11px] text-stone-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-600" />
                  <span>No limit applied — Client can favorite and submit unlimited photos.</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-stone-300 font-medium mb-1.5">
                Shareable Slug Preview
              </label>
              <div className="w-full bg-stone-950/40 border border-stone-850 text-xs rounded-xl px-3.5 py-2.5 text-stone-500 font-mono truncate">
                /gallery?album={coupleNames.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'client'}
              </div>
            </div>

            <div>
              <label className="block text-stone-300 font-medium mb-1.5">
                Note / Instructions for the Couple (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Please pick up to 35 photos for your album. Click heart on favorites and submit!"
                value={notesForClient}
                onChange={(e) => setNotesForClient(e.target.value)}
                className="w-full bg-stone-950/80 border border-stone-800 text-sm rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-3 border-t border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-stone-400 hover:text-stone-200 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSyncingDrive || !selectedFolderResult}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-semibold text-xs rounded-xl transition shadow-lg flex items-center gap-2"
              >
                {isSyncingDrive ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing Photos...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Publish Album</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Drive Picker Nested Modal */}
      {accessToken && (
        <DriveFolderPickerModal
          accessToken={accessToken}
          isOpen={isDrivePickerOpen}
          onClose={() => setIsDrivePickerOpen(false)}
          onSelectFolder={(result) => setSelectedFolderResult(result)}
        />
      )}
    </>
  );
};
