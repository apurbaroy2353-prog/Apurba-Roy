import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Calendar,
  User,
  Mail,
  MessageSquare,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  HardDrive,
  FileCheck,
  CheckCircle2,
  Hourglass,
  ArrowUpDown,
  Archive,
  Loader2,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import { Album, ClientSelectionSubmission, DrivePhoto, SubmissionStatus } from '../types';
import {
  downloadSubmissionAsZip,
  exportFilenamesForLightroom,
  exportSelectionToJSON,
  exportSelectionToCSV,
} from '../services/zipDownloader';
import { updateSubmissionStatus } from '../services/albumStorage';

interface ClientSubmissionsViewerProps {
  album: Album;
  submissions: ClientSelectionSubmission[];
  accessToken?: string | null;
  onRefreshData?: () => void;
  onNotifyClient?: (
    album: Album,
    template?: 'album_ready' | 'gallery_updated' | 'selection_reminder'
  ) => void;
}

export const ClientSubmissionsViewer: React.FC<ClientSubmissionsViewerProps> = ({
  album,
  submissions,
  accessToken,
  onRefreshData,
  onNotifyClient,
}) => {
  const [selectedSubId, setSelectedSubId] = useState<string>(
    submissions.length > 0 ? submissions[0].id : ''
  );
  const [downloadingSubId, setDownloadingSubId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    completed: number;
    total: number;
    filename: string;
  } | null>(null);
  const [copiedFilenames, setCopiedFilenames] = useState(false);
  const [exportedFormat, setExportedFormat] = useState<'json' | 'csv' | null>(null);

  // If selectedSubId is not in submissions or is empty, fallback to the first
  const activeSubmission =
    submissions.find((s) => s.id === selectedSubId) || submissions[0];

  // Helper for visual status badge
  const renderStatusBadge = (status: SubmissionStatus | undefined, size: 'sm' | 'md' = 'sm') => {
    const isCompleted = status !== 'in_progress';
    if (isCompleted) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${
            size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <CheckCircle2 className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
          <span>Completed</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 ${
          size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <Hourglass className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        <span>In Progress</span>
      </span>
    );
  };

  const handleToggleStatus = (subId: string, currentStatus: SubmissionStatus | undefined) => {
    const newStatus: SubmissionStatus = currentStatus === 'in_progress' ? 'completed' : 'in_progress';
    updateSubmissionStatus(subId, newStatus);
    if (onRefreshData) {
      onRefreshData();
    }
  };

  // Map photo IDs to actual DrivePhoto objects
  const allPhotos: DrivePhoto[] = album.cachedPhotos || [];
  const selectedPhotos: DrivePhoto[] = activeSubmission
    ? activeSubmission.selectedPhotoIds.map((id) => {
        const found = allPhotos.find((p) => p.id === id);
        if (found) return found;
        return {
          id,
          name: `Photo_${id}.jpg`,
          mimeType: 'image/jpeg',
          webViewLink: `https://drive.google.com/uc?id=${id}`,
        };
      })
    : [];

  const handleDownloadSpecificSubmissionZip = async (
    sub: ClientSelectionSubmission,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (downloadingSubId) return;

    setDownloadingSubId(sub.id);
    setDownloadProgress({ completed: 0, total: sub.selectedPhotoIds.length, filename: 'Preparing...' });

    try {
      await downloadSubmissionAsZip(sub, album, accessToken, (completed, total, filename) => {
        setDownloadProgress({ completed, total, filename });
      });
    } catch (err) {
      console.error('Download error:', err);
      alert('Error creating zip bundle: ' + (err as Error).message);
    } finally {
      setDownloadingSubId(null);
      setDownloadProgress(null);
    }
  };

  const handleCopyLightroomNames = () => {
    if (selectedPhotos.length === 0) return;
    const text = exportFilenamesForLightroom(selectedPhotos);
    navigator.clipboard.writeText(text);
    setCopiedFilenames(true);
    setTimeout(() => setCopiedFilenames(false), 2500);
  };

  const handleExportJSON = () => {
    if (!activeSubmission) return;
    exportSelectionToJSON(activeSubmission, album);
    setExportedFormat('json');
    setTimeout(() => setExportedFormat(null), 2500);
  };

  const handleExportCSV = () => {
    if (!activeSubmission) return;
    exportSelectionToCSV(activeSubmission, album);
    setExportedFormat('csv');
    setTimeout(() => setExportedFormat(null), 2500);
  };

  if (submissions.length === 0) {
    return (
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-10 text-center space-y-3">
        <FileCheck className="w-12 h-12 stroke-1 text-stone-600 mx-auto" />
        <h4 className="font-serif text-lg text-stone-300">No client submissions yet</h4>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          Share the album private link with the client. When they heart and submit their selections, their chosen photos, notes, and direct download links will appear here immediately.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-stone-900/70 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Submissions List Header & Selector */}
      <div className="p-4 sm:p-5 border-b border-stone-800 bg-stone-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400">
              Submissions List ({submissions.length})
            </span>
            <h4 className="font-serif text-lg text-stone-100 font-medium">
              Client Photo Selections
            </h4>
          </div>

          {/* Quick counts breakdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{submissions.filter((s) => s.status !== 'in_progress').length} Completed</span>
            </span>
            {submissions.some((s) => s.status === 'in_progress') && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>{submissions.filter((s) => s.status === 'in_progress').length} In Progress</span>
              </span>
            )}
          </div>
        </div>

        {/* Submissions List Tabs / Pill Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {submissions.map((sub) => {
            const isSubSelected = (activeSubmission?.id === sub.id);
            return (
              <div
                key={sub.id}
                onClick={() => setSelectedSubId(sub.id)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                  isSubSelected
                    ? 'bg-stone-900 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                    : 'bg-stone-950/50 border-stone-850 hover:bg-stone-900/60 hover:border-stone-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-stone-100 truncate">
                      {sub.clientName}
                    </p>
                    {renderStatusBadge(sub.status, 'sm')}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-1">
                    <span>{sub.selectedPhotoIds.length} photos</span>
                    <span>•</span>
                    <span>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => handleDownloadSpecificSubmissionZip(sub, e)}
                    disabled={Boolean(downloadingSubId)}
                    className="p-1.5 rounded-lg bg-stone-850 hover:bg-amber-500 hover:text-stone-950 text-stone-300 transition border border-stone-800"
                    title={`Bulk download all ${sub.selectedPhotoIds.length} photos for ${sub.clientName} as a single ZIP file`}
                  >
                    {downloadingSubId === sub.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition ${
                      isSubSelected ? 'text-amber-400' : 'text-stone-600'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeSubmission && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Active Submission Header with Status Badge & Status Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-850">
            <div>
              <div className="flex items-center gap-3">
                <h4 className="font-serif text-xl text-stone-100 font-medium">
                  {activeSubmission.clientName}
                </h4>
                {renderStatusBadge(activeSubmission.status, 'md')}
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Client submission review and export
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick direct download button in header */}
              <button
                onClick={(e) => handleDownloadSpecificSubmissionZip(activeSubmission, e)}
                disabled={Boolean(downloadingSubId) || selectedPhotos.length === 0}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-950/30 disabled:opacity-40"
                title="Download all selected photos for this submission as a ZIP"
              >
                {downloadingSubId === activeSubmission.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download ZIP ({activeSubmission.selectedPhotoIds.length})</span>
              </button>

              {/* Status Switch button for Photographer */}
              <button
                onClick={() => handleToggleStatus(activeSubmission.id, activeSubmission.status)}
                className="px-3 py-1.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-medium transition flex items-center gap-2"
                title="Change client status between Completed and In Progress"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  Mark as {activeSubmission.status === 'in_progress' ? 'Completed' : 'In Progress'}
                </span>
              </button>

              {/* Email / Remind Client */}
              {onNotifyClient && (
                <button
                  onClick={() =>
                    onNotifyClient(
                      album,
                      activeSubmission.status === 'in_progress'
                        ? 'selection_reminder'
                        : 'gallery_updated'
                    )
                  }
                  className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium transition flex items-center gap-1.5"
                  title="Send email notification or selection reminder to this client"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>
                    {activeSubmission.status === 'in_progress' ? 'Send Reminder' : 'Email Client'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Submission Details Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-850 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-500 uppercase font-mono">Selected</p>
                <p className="text-sm font-semibold text-stone-200">
                  {activeSubmission.selectedPhotoIds.length} Photos
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-850 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-500 uppercase font-mono">Status</p>
                <p className="text-sm font-semibold text-stone-200 capitalize">
                  {activeSubmission.status === 'in_progress' ? 'In Progress' : 'Completed'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-850 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-500 uppercase font-mono">Submitted Date</p>
                <p className="text-sm font-semibold text-stone-200">
                  {new Date(activeSubmission.submittedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-850 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0 truncate">
                <p className="text-[11px] text-stone-500 uppercase font-mono">Contact Email</p>
                <p className="text-sm font-semibold text-stone-200 truncate">
                  {activeSubmission.clientEmail || 'None provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Client Notes if any */}
          {activeSubmission.clientNotes && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 text-xs text-amber-200/90 space-y-1">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Client's Specific Instructions:
              </span>
              <p className="italic pl-5 leading-relaxed">"{activeSubmission.clientNotes}"</p>
            </div>
          )}

          {/* Bulk ZIP Download Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-950/70 border border-stone-800 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0 mt-0.5">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-stone-100 flex items-center gap-2">
                    <span>Bulk Download Submission ZIP Archive</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      .ZIP
                    </span>
                  </h5>
                  <p className="text-xs text-stone-400 mt-0.5 max-w-xl">
                    Downloads all <strong className="text-stone-200">{selectedPhotos.length} selected photos</strong> for{' '}
                    <span className="text-amber-300 font-medium">{activeSubmission.clientName}</span> bundled into a single ZIP file, complete with photo selection manifest and client notes.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Lightroom Ingestion Export Buttons */}
                <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
                  <button
                    onClick={handleExportJSON}
                    className="px-3 py-1.5 rounded-lg bg-stone-850 hover:bg-stone-800 hover:text-amber-300 text-stone-200 text-xs font-medium border border-stone-750 transition flex items-center gap-1.5 shadow-xs"
                    title="Export selection to JSON manifest for Adobe Lightroom ingestion"
                  >
                    {exportedFormat === 'json' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Exported JSON!</span>
                      </>
                    ) : (
                      <>
                        <FileJson className="w-3.5 h-3.5 text-amber-400" />
                        <span>Export JSON</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 rounded-lg bg-stone-850 hover:bg-stone-800 hover:text-emerald-300 text-stone-200 text-xs font-medium border border-stone-750 transition flex items-center gap-1.5 shadow-xs"
                    title="Export selection to CSV spreadsheet for Lightroom ingestion"
                  >
                    {exportedFormat === 'csv' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Exported CSV!</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Export CSV</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Copy file list for Lightroom / Capture One */}
                <button
                  onClick={handleCopyLightroomNames}
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-medium rounded-xl transition flex items-center gap-2"
                  title="Copies comma-separated filenames to paste directly into Adobe Lightroom's Library Filter"
                >
                  {copiedFilenames ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied for Lightroom!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-stone-400" />
                      <span>Copy Names</span>
                    </>
                  )}
                </button>

                {/* Main Download Selected Zip */}
                <button
                  onClick={(e) => handleDownloadSpecificSubmissionZip(activeSubmission, e)}
                  disabled={Boolean(downloadingSubId) || selectedPhotos.length === 0}
                  className="px-4 py-2 bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-semibold rounded-xl transition shadow-lg flex items-center gap-2 disabled:opacity-40"
                >
                  {downloadingSubId === activeSubmission.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Archiving ZIP ({downloadProgress?.completed}/{downloadProgress?.total})...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download All as Single ZIP ({selectedPhotos.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Progress Bar when downloading this submission */}
            {downloadingSubId === activeSubmission.id && downloadProgress && (
              <div className="pt-2 border-t border-stone-850 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-400 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    <span>Archiving: <strong className="text-stone-200 font-mono">{downloadProgress.filename}</strong></span>
                  </span>
                  <span className="text-amber-400 font-mono font-semibold">
                    {Math.round((downloadProgress.completed / (downloadProgress.total || 1)) * 100)}%
                  </span>
                </div>

                <div className="w-full h-2 bg-stone-850 rounded-full overflow-hidden border border-stone-800">
                  <div
                    className="h-full bg-linear-to-r from-amber-500 to-rose-500 transition-all duration-200"
                    style={{
                      width: `${Math.min(100, (downloadProgress.completed / (downloadProgress.total || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Selected Photos Thumbnails Grid */}
          <div>
            <h5 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">
              Selected Photo Previews ({selectedPhotos.length})
            </h5>

            {selectedPhotos.length === 0 ? (
              <div className="p-6 bg-stone-950/40 rounded-xl text-xs text-stone-500 text-center">
                Photo metadata is linked to Google Drive ID(s).
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {selectedPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-square bg-stone-950 rounded-lg overflow-hidden border border-stone-800"
                  >
                    <img
                      src={photo.thumbnailLink || photo.webViewLink}
                      alt={photo.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/80 backdrop-blur-xs text-[10px] text-stone-300 font-mono truncate text-center">
                      {photo.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
