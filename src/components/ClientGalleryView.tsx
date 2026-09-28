import React, { useState, useEffect } from 'react';
import {
  Heart,
  Eye,
  Check,
  Share2,
  Calendar,
  Sparkles,
  ArrowLeft,
  Filter,
  CheckCircle,
  Clock,
  Send,
  Camera,
  ChevronDown,
  AlertCircle,
  X,
  Lock,
  Unlock,
  LayoutGrid,
  Search,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Download,
  Loader2,
  CreditCard,
  MessageCircle,
  User,
} from 'lucide-react';
import { Album, DrivePhoto, PhotoPaymentRequest } from '../types';
import { listPhotosInFolder } from '../services/drive';
import { downloadSinglePhoto } from '../services/zipDownloader';
import {
  getLocalSelectionDraft,
  saveLocalSelectionDraft,
  getSubmissionsForAlbum,
  isPhotoApprovedForClient,
  logClientActivity,
  WHATSAPP_SUPPORT_NUMBER,
  WHATSAPP_LINK,
} from '../services/albumStorage';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { SubmitSelectionModal } from './SubmitSelectionModal';
import { SelectionSummaryModal } from './SelectionSummaryModal';
import { PhotoPaymentModal } from './PhotoPaymentModal';
import { FaceSearchModal } from './FaceSearchModal';
import { ClientProfileView } from './ClientProfileView';

interface ClientGalleryViewProps {
  album: Album;
  accessToken?: string | null;
  onBackToAdmin?: () => void;
  isAdminViewing?: boolean;
}

export const ClientGalleryView: React.FC<ClientGalleryViewProps> = ({
  album,
  accessToken,
  onBackToAdmin,
  isAdminViewing = false,
}) => {
  const [photos, setPhotos] = useState<DrivePhoto[]>(album.cachedPhotos || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected favorites
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const draft = getLocalSelectionDraft(album.id);
    return new Set(draft);
  });

  // Main view mode: 'gallery' | 'profile'
  const [currentView, setCurrentView] = useState<'gallery' | 'profile'>('gallery');

  // Filter tab: 'all' | 'selected' | 'unselected'
  const [filterMode, setFilterMode] = useState<'all' | 'selected' | 'unselected'>('all');

  // Search & Filtering by filename and date uploaded
  const [filenameQuery, setFilenameQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'name_asc' | 'name_desc' | 'date_desc' | 'date_asc'>('default');
  const [dateFilter, setDateFilter] = useState<string>('all'); // 'all' or 'YYYY-MM-DD'

  // AI Face Search matching filter
  const [matchingFacePhotoIds, setMatchingFacePhotoIds] = useState<string[] | null>(null);
  const [isFaceSearchModalOpen, setIsFaceSearchModalOpen] = useState(false);

  // Paid Photo Download & Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [photosToPay, setPhotosToPay] = useState<DrivePhoto[]>([]);

  // Lightbox
  const [lightboxPhotos, setLightboxPhotos] = useState<DrivePhoto[]>(album.cachedPhotos || []);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Selection Summary modal
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Submit modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Submissions count
  const [submissionsCount, setSubmissionsCount] = useState(0);

  // Selection limit enforcement
  const hasLimit = Boolean(album.selectionLimitEnabled && album.maxSelectionsAllowed && album.maxSelectionsAllowed > 0);
  const selectionLimit = album.maxSelectionsAllowed || 0;
  const isLimitReached = hasLimit && selectedIds.size >= selectionLimit;
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const warningTimerRef = React.useRef<any>(null);

  // Individual photo download tracking
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const [justDownloadedId, setJustDownloadedId] = useState<string | null>(null);

  const handleDownloadIndividualPhoto = async (photo: DrivePhoto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (downloadingPhotoId) return;

    setDownloadingPhotoId(photo.id);
    try {
      const success = await downloadSinglePhoto(photo, accessToken);
      if (success) {
        setJustDownloadedId(photo.id);
        setTimeout(() => {
          setJustDownloadedId((prev) => (prev === photo.id ? null : prev));
        }, 2500);

        logClientActivity(
          album.id,
          'download_photo',
          `Downloaded Photo (${photo.name})`,
          `Client downloaded high-resolution photo file ${photo.name}.`,
          {
            photoId: photo.id,
            photoName: photo.name,
          },
          album.coupleNames
        );
      } else {
        alert(`Could not download ${photo.name}. Please try again.`);
      }
    } catch (err) {
      console.error('Download single photo error:', err);
    } finally {
      setDownloadingPhotoId(null);
    }
  };

  // Flow for Paid vs Free Photo Download
  const handlePhotoDownloadClick = (photo: DrivePhoto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // 1. Check if admin disabled client downloads for this album
    if (album.clientDownloadAllowed === false) {
      alert('এডমিন এই অ্যালবামের ডাউনলোড সাময়িকভাবে বন্ধ রেখেছেন। সহায়তার জন্য WhatsApp এ যোগাযোগ করুন।');
      return;
    }

    // 2. Check if photo download is disabled
    if (photo.downloadDisabled) {
      alert('এই ছবিটির ডাউনলোড এডমিন সাময়িকভাবে বন্ধ রেখেছেন।');
      return;
    }

    const isPaid = Boolean(photo.isPaid);
    const isApproved = isPhotoApprovedForClient(album.id, photo.id);

    // 3. If photo is paid and NOT approved, open Payment Modal!
    if (isPaid && !isApproved) {
      setPhotosToPay([photo]);
      setIsPaymentModalOpen(true);
      return;
    }

    // 4. Free or Approved -> Download directly!
    handleDownloadIndividualPhoto(photo, e);
  };

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSubmissionsCount(getSubmissionsForAlbum(album.id).length);
  }, [album.id]);

  // Load live photos from Google Drive if folderId exists and accessToken is present
  useEffect(() => {
    async function loadDrivePhotos() {
      if (!accessToken || !album.driveFolderId || album.driveFolderId.startsWith('sample')) {
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const drivePhotos = await listPhotosInFolder(accessToken, album.driveFolderId);
        if (drivePhotos.length > 0) {
          setPhotos(drivePhotos);
        }
      } catch (err: any) {
        console.warn('Could not fetch live photos from Drive:', err);
        setLoadError(
          'Note: Live Google Drive syncing requires photographer authorization. Displaying album preview.'
        );
      } finally {
        setIsLoading(false);
      }
    }
    loadDrivePhotos();
  }, [album.driveFolderId, accessToken]);

  // Log client visiting the gallery once per session
  useEffect(() => {
    const sessionKey = `rc_logged_view_${album.id}_${new Date().toDateString()}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      logClientActivity(
        album.id,
        'view_gallery',
        'Gallery Opened & Viewed',
        `Client viewed ${album.title} with ${photos.length} photos on ${isMobile ? 'Mobile Device' : 'Desktop Browser'}.`,
        {
          device: isMobile ? 'Mobile Device' : 'Desktop Browser',
          selectionCount: selectedIds.size,
        },
        album.coupleNames
      );
    }
  }, [album.id, photos.length]);

  const toggleSelectPhoto = (photoId: string): boolean => {
    const isAdding = !selectedIds.has(photoId);

    if (isAdding) {
      // Trying to select a new photo when limit is reached
      if (hasLimit && selectedIds.size >= selectionLimit) {
        setLimitWarning(
          `Selection limit reached (${selectionLimit} photos max). Please uncheck a favorite to pick this one.`
        );
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        warningTimerRef.current = setTimeout(() => {
          setLimitWarning(null);
        }, 4500);
        return false;
      }
    }

    const photoObj = photos.find((p) => p.id === photoId);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      saveLocalSelectionDraft(album.id, Array.from(next));
      return next;
    });

    if (isAdding) {
      logClientActivity(
        album.id,
        'select_photo',
        `Favorited Photo ${photoObj ? photoObj.name : photoId}`,
        `Client added photo to their selection list (Total: ${selectedIds.size + 1})`,
        {
          photoId,
          photoName: photoObj?.name,
          selectionCount: selectedIds.size + 1,
        },
        album.coupleNames
      );
    } else {
      logClientActivity(
        album.id,
        'unselect_photo',
        `Removed Favorite ${photoObj ? photoObj.name : photoId}`,
        `Client removed photo from selection list (Remaining: ${Math.max(0, selectedIds.size - 1)})`,
        {
          photoId,
          photoName: photoObj?.name,
          selectionCount: Math.max(0, selectedIds.size - 1),
        },
        album.coupleNames
      );
    }

    return true;
  };

  // Extract distinct upload/creation dates for date filter
  const availableDates = React.useMemo(() => {
    const datesMap = new Map<string, { label: string; count: number }>();
    photos.forEach((p) => {
      if (p.createdTime) {
        try {
          const dateObj = new Date(p.createdTime);
          if (!isNaN(dateObj.getTime())) {
            const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            const formatted = dateObj.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const existing = datesMap.get(dateKey);
            if (existing) {
              existing.count++;
            } else {
              datesMap.set(dateKey, { label: formatted, count: 1 });
            }
          }
        } catch (e) {
          // ignore invalid date
        }
      }
    });
    return Array.from(datesMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, data]) => ({
        key,
        label: data.label,
        count: data.count,
      }));
  }, [photos]);

  const displayedPhotos = React.useMemo(() => {
    let result = photos.filter((p) => {
      // 0. AI Face Match Filter (if active)
      if (matchingFacePhotoIds !== null && !matchingFacePhotoIds.includes(p.id)) {
        return false;
      }

      // 1. Status Filter: all | selected | unselected
      if (filterMode === 'selected' && !selectedIds.has(p.id)) {
        return false;
      }
      if (filterMode === 'unselected' && selectedIds.has(p.id)) {
        return false;
      }

      // 2. Filename Search Filter
      if (filenameQuery.trim()) {
        const query = filenameQuery.trim().toLowerCase();
        if (!p.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // 3. Date Uploaded Filter
      if (dateFilter !== 'all') {
        if (!p.createdTime) return false;
        const pDateKey = p.createdTime.split('T')[0];
        if (pDateKey !== dateFilter) return false;
      }

      return true;
    });

    // 4. Sorting by Filename or Date Uploaded
    if (sortBy === 'name_asc') {
      result = [...result].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (sortBy === 'name_desc') {
      result = [...result].sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (sortBy === 'date_desc') {
      result = [...result].sort((a, b) => {
        const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return timeB - timeA;
      });
    } else if (sortBy === 'date_asc') {
      result = [...result].sort((a, b) => {
        const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return timeA - timeB;
      });
    }

    return result;
  }, [photos, filterMode, selectedIds, filenameQuery, dateFilter, sortBy]);

  const isFiltered = Boolean(
    filenameQuery.trim() !== '' ||
    dateFilter !== 'all' ||
    sortBy !== 'default' ||
    filterMode !== 'all'
  );

  const resetAllFilters = () => {
    setFilenameQuery('');
    setDateFilter('all');
    setSortBy('default');
    setFilterMode('all');
  };

  const selectedPhotos = photos.filter((p) => selectedIds.has(p.id));

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?album=${album.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (currentView === 'profile') {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-rose-500 selection:text-white">
        {/* Top Notice Banner if Admin viewing */}
        {isAdminViewing && (
          <div className="bg-amber-950/80 border-b border-amber-800/40 px-4 py-2 text-xs flex items-center justify-between text-amber-200">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <strong>Client Preview Mode</strong> — Viewing Client Profile & History.
            </span>
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="underline text-amber-300 hover:text-white font-medium ml-4 shrink-0"
              >
                ← Back to Admin Dashboard
              </button>
            )}
          </div>
        )}

        <ClientProfileView
          album={album}
          photos={photos}
          selectedIds={selectedIds}
          onBackToGallery={() => setCurrentView('gallery')}
          onViewSelectedInGallery={() => {
            setFilterMode('selected');
            setCurrentView('gallery');
          }}
          onOpenFaceSearch={() => setIsFaceSearchModalOpen(true)}
          onOpenPaymentModal={() => {
            if (photos.length > 0) {
              setPhotosToPay([photos[0]]);
              setIsPaymentModalOpen(true);
            }
          }}
        />

        {/* Submit Selection Modal */}
        <SubmitSelectionModal
          album={album}
          selectedPhotoIds={Array.from(selectedIds)}
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          onBackToSummary={() => setIsSummaryModalOpen(true)}
          onSuccess={() => {
            setSubmissionsCount((prev) => prev + 1);
          }}
        />

        {/* Paid Photo Payment Modal */}
        <PhotoPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          album={album}
          photosToBuy={photosToPay}
          onPaymentSubmitted={(req) => {
            console.log('Payment request submitted:', req);
          }}
        />

        {/* AI Face Search Modal */}
        <FaceSearchModal
          isOpen={isFaceSearchModalOpen}
          onClose={() => setIsFaceSearchModalOpen(false)}
          album={album}
          onFilterMatchingPhotos={(matchingIds) => {
            setMatchingFacePhotoIds(matchingIds);
          }}
          onDownloadPhoto={handlePhotoDownloadClick}
          onPayForPhoto={(photo) => {
            setPhotosToPay([photo]);
            setIsPaymentModalOpen(true);
          }}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectPhoto}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Top Notice Banner if Admin viewing */}
      {isAdminViewing && (
        <div className="bg-amber-950/80 border-b border-amber-800/40 px-4 py-2 text-xs flex items-center justify-between text-amber-200">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <strong>Client Preview Mode</strong> — This is exactly what the couple sees on mobile & desktop.
          </span>
          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="underline text-amber-300 hover:text-white font-medium ml-4 shrink-0"
            >
              ← Back to Admin Dashboard
            </button>
          )}
        </div>
      )}

      {/* Hero Header */}
      <div className="relative border-b border-stone-850 overflow-hidden bg-stone-900">
        {/* Ambient Blur Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-rose-500/30 blur-3xl" />
          <div className="absolute top-1/2 -right-24 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400 font-mono">
                <span className="font-bold text-amber-300">[রম্যছবি - RamyaChobi]</span>
                <span className="text-stone-600">•</span>
                <span className="text-rose-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Wedding Proofing Gallery
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl font-light tracking-tight text-stone-100">
                {album.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-stone-400 font-sans">
                <span className="text-stone-300 font-medium">{album.coupleNames}</span>
                {album.weddingDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    {album.weddingDate}
                  </span>
                )}
                <span>•</span>
                <span>{photos.length} Total Photographs</span>
                {hasLimit && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium text-[11px] flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>{selectionLimit} Photos Limit</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions for Header: Profile, Share link, AI Face Search */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Client Profile Button */}
              <button
                onClick={() => setCurrentView('profile')}
                className="px-4 py-2.5 rounded-xl bg-stone-900/90 border border-amber-500/40 text-amber-300 hover:text-white hover:bg-stone-850 hover:border-amber-400 text-xs font-semibold transition flex items-center gap-2 shadow-sm"
                title="View your client profile, personal details, and wedding interaction history"
              >
                <User className="w-4 h-4 text-amber-400" />
                <span>Client Profile & History</span>
              </button>

              {/* AI Face Search Primary Action */}
              <button
                onClick={() => setIsFaceSearchModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 font-bold text-xs transition flex items-center gap-2 shadow-lg"
                title="মুখ স্ক্যান বা ছবি আপলোড করে নিজের ছবি খুঁজুন"
              >
                <Sparkles className="w-4 h-4 text-stone-950" />
                <span>AI Face Search</span>
              </button>

              <button
                onClick={handleCopyShareLink}
                className="px-4 py-2.5 rounded-xl bg-stone-900/90 border border-stone-800 text-stone-300 hover:text-white hover:border-stone-700 text-xs font-medium transition flex items-center gap-2"
                title="Copy share link for client"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Gallery</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Notes for Client banner */}
          {album.notesForClient && (
            <div className="mt-6 p-4 rounded-2xl bg-stone-950/60 border border-stone-800 text-xs text-stone-300 leading-relaxed max-w-3xl">
              <p className="font-semibold text-rose-300 mb-1">A Note from Your Photographer:</p>
              <p>{album.notesForClient}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Filter & Selection Counter Toolbar */}
      <div className="sticky top-0 z-30 bg-stone-950/95 backdrop-blur-md border-b border-stone-850 px-3 sm:px-6 py-2.5 sm:py-3 transition space-y-2.5 shadow-md">
        {/* Row 1: Primary Tabs & Submission Actions */}
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Tabs: All vs Selected vs Unselected + AI Face Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-stone-900/90 p-1 rounded-xl border border-stone-800 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterMode === 'all'
                    ? 'bg-stone-800 text-stone-100 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                All Photos ({photos.length})
              </button>
              <button
                onClick={() => setFilterMode('selected')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  filterMode === 'selected'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    selectedIds.size > 0 ? 'fill-rose-400 stroke-rose-400' : ''
                  }`}
                />
                <span>Selected ({selectedIds.size})</span>
              </button>
              <button
                onClick={() => setFilterMode('unselected')}
                className={`hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition ${
                  filterMode === 'unselected'
                    ? 'bg-stone-800 text-stone-100 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <span>Unselected ({Math.max(0, photos.length - selectedIds.size)})</span>
              </button>
            </div>

            {/* AI Face Search Quick Trigger */}
            <button
              onClick={() => setIsFaceSearchModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                matchingFacePhotoIds !== null
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md font-bold'
                  : 'bg-stone-900/80 hover:bg-stone-850 border-amber-500/30 text-amber-300'
              }`}
              title="মুখ স্ক্যান বা ছবি আপলোড করে নিজের ছবি খুঁজুন"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{matchingFacePhotoIds !== null ? `Face Match (${matchingFacePhotoIds.length})` : 'AI Face Search'}</span>
            </button>

            {/* Client Profile & History Tab */}
            <button
              onClick={() => setCurrentView('profile')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-800 bg-stone-900/80 hover:bg-stone-850 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 text-xs font-semibold transition"
              title="View your client profile, personal details, and wedding interaction history"
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Profile & History</span>
            </button>
          </div>

          {/* Right Action: Selected counter, cap progress and Submit button */}
          <div className="flex items-center gap-2 sm:gap-4">
            {hasLimit ? (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-stone-200">
                    {selectedIds.size} <span className="text-stone-500 font-normal">/</span> {selectionLimit}
                  </span>
                  {isLimitReached ? (
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span className="hidden sm:inline">Limit Reached</span>
                      <span className="sm:hidden">Max</span>
                    </span>
                  ) : (
                    <span className="hidden sm:inline text-[11px] text-stone-400">
                      ({selectionLimit - selectedIds.size} left)
                    </span>
                  )}
                </div>
                {/* Visual Progress Bar */}
                <div className="w-20 sm:w-28 h-1.5 bg-stone-850 rounded-full overflow-hidden border border-stone-800">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isLimitReached ? 'bg-amber-400' : 'bg-linear-to-r from-rose-500 to-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, (selectedIds.size / selectionLimit) * 100)}%` }}
                  />
                </div>
              </div>
            ) : album.maxSelectionsAllowed ? (
              <span className="hidden sm:inline-block text-xs text-stone-400">
                Target: {album.maxSelectionsAllowed} photos
              </span>
            ) : null}

            {/* Quick Review Selection Button */}
            {selectedIds.size > 0 && (
              <button
                onClick={() => setIsSummaryModalOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-semibold transition"
                title="Review selected photos in summary grid"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-rose-400" />
                <span>Review Selection</span>
              </button>
            )}

            <button
              onClick={() => setIsSummaryModalOpen(true)}
              disabled={selectedIds.size === 0}
              className={`px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 sm:gap-2 shadow-lg ${
                selectedIds.size > 0
                  ? 'bg-linear-to-r from-rose-500 to-amber-500 hover:opacity-95 text-stone-950 shadow-rose-950/40 animate-pulse'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Review & Submit ({selectedIds.size})</span>
            </button>
          </div>
        </div>

        {/* Row 2: Live Filename Search, Date Filter, and Sorting Controls */}
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-stone-900 text-xs">
          {/* Left: Search input by filename & Date Uploaded filter */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
            {/* Search by filename */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by filename (e.g. 001, Ceremony, Rings)..."
                value={filenameQuery}
                onChange={(e) => setFilenameQuery(e.target.value)}
                className="w-full bg-stone-900/90 border border-stone-800 focus:border-amber-400/60 rounded-xl pl-8 pr-7 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-hidden transition"
              />
              {filenameQuery && (
                <button
                  onClick={() => setFilenameQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition"
                  title="Clear filename filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Date Uploaded Filter Dropdown */}
            {availableDates.length > 0 && (
              <div className="relative flex items-center">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-stone-900/90 border border-stone-800 hover:border-stone-700 text-stone-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-amber-400/60 cursor-pointer transition appearance-none pr-7"
                  title="Filter photos by date uploaded"
                >
                  <option value="all">All Upload Dates ({photos.length})</option>
                  {availableDates.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label} ({d.count} {d.count === 1 ? 'photo' : 'photos'})
                    </option>
                  ))}
                </select>
                <Calendar className="w-3.5 h-3.5 text-amber-400/70 absolute right-2.5 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Right: Sort Dropdown & Quick Reset */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-stone-900/90 border border-stone-800 hover:border-stone-700 text-stone-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-amber-400/60 cursor-pointer transition appearance-none pr-7"
                title="Sort photos by date or filename"
              >
                <option value="default">Sort: Original Sequence</option>
                <option value="date_desc">Sort: Date Uploaded (Newest First)</option>
                <option value="date_asc">Sort: Date Uploaded (Oldest First)</option>
                <option value="name_asc">Sort: Filename (A → Z)</option>
                <option value="name_desc">Sort: Filename (Z → A)</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400/70 absolute right-2.5 pointer-events-none" />
            </div>

            {/* Reset All Filters Button */}
            {isFiltered && (
              <button
                onClick={resetAllFilters}
                className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-medium transition flex items-center gap-1.5"
                title="Reset all search filters and sorting"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Active Filters & Results Summary Banner */}
        {isFiltered && (
          <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
            <span className="text-stone-400">
              Showing <strong className="text-stone-200">{displayedPhotos.length}</strong> of{' '}
              <strong className="text-stone-200">{photos.length}</strong> photos:
            </span>

            {filenameQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                <Search className="w-2.5 h-2.5 text-stone-400" />
                <span>Name: "{filenameQuery}"</span>
                <button
                  onClick={() => setFilenameQuery('')}
                  className="hover:text-rose-400 transition"
                  title="Remove filename filter"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}

            {dateFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                <Calendar className="w-2.5 h-2.5 text-amber-400" />
                <span>Date: {availableDates.find((d) => d.key === dateFilter)?.label || dateFilter}</span>
                <button
                  onClick={() => setDateFilter('all')}
                  className="hover:text-rose-400 transition"
                  title="Remove date filter"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}

            {sortBy !== 'default' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                <ArrowUpDown className="w-2.5 h-2.5 text-amber-400" />
                <span>
                  {sortBy === 'name_asc'
                    ? 'Filename (A→Z)'
                    : sortBy === 'name_desc'
                    ? 'Filename (Z→A)'
                    : sortBy === 'date_desc'
                    ? 'Newest Uploads'
                    : 'Oldest Uploads'}
                </span>
                <button
                  onClick={() => setSortBy('default')}
                  className="hover:text-rose-400 transition"
                  title="Reset to original order"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}

            {filterMode !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
                <Heart className="w-2.5 h-2.5 fill-rose-400 stroke-rose-400" />
                <span>{filterMode === 'selected' ? 'Selected Only' : 'Unselected Only'}</span>
                <button
                  onClick={() => setFilterMode('all')}
                  className="hover:text-rose-200 transition"
                  title="Show all photos"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Gallery Grid */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 py-6">
        {loadError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300">
            {loadError}
          </div>
        )}

        {/* AI Face Match Active Notice Banner */}
        {matchingFacePhotoIds !== null && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-amber-300">
                  ✨ AI Face Search সক্রিয়: {matchingFacePhotoIds.length}টি ফটো আপনার মুখের সাথে মিলেছে!
                </p>
                <p className="text-[11px] text-stone-400">
                  গ্যালারিতে শুধুমাত্র ম্যাচ হওয়া ছবিগুলো দেখানো হচ্ছে।
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFaceSearchModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold transition"
              >
                আবার স্ক্যান করুন
              </button>
              <button
                onClick={() => setMatchingFacePhotoIds(null)}
                className="px-3 py-1.5 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 text-xs font-medium transition flex items-center gap-1 border border-stone-750"
              >
                <X className="w-3.5 h-3.5" />
                <span>সব ছবি দেখুন</span>
              </button>
            </div>
          </div>
        )}

        {displayedPhotos.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            {isFiltered ? (
              <div className="p-8 max-w-md mx-auto rounded-3xl bg-stone-900/60 border border-stone-800 space-y-3 shadow-xl">
                <Search className="w-12 h-12 stroke-1 text-stone-600 mx-auto" />
                <h3 className="font-serif text-lg text-stone-200">No matching photos found</h3>
                <p className="text-xs text-stone-400">
                  No photos match your current filters
                  {filenameQuery ? ` for "${filenameQuery}"` : ''}
                  {dateFilter !== 'all' ? ` on selected date` : ''}.
                </p>
                <button
                  onClick={resetAllFilters}
                  className="mt-3 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-amber-300 text-xs font-semibold transition inline-flex items-center gap-2 border border-stone-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Heart className="w-12 h-12 stroke-1 text-stone-700 mx-auto" />
                <h3 className="font-serif text-lg text-stone-400">No photos in this view</h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  {filterMode === 'selected'
                    ? 'Tap the heart icon on any photo to favorite it for your wedding album.'
                    : 'This album is currently empty. Connect a Google Drive folder in Admin.'}
                </p>
                {filterMode === 'selected' && (
                  <button
                    onClick={() => setFilterMode('all')}
                    className="mt-2 text-xs font-semibold text-rose-400 underline"
                  >
                    Browse All Photos
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Mobile-first dynamic masonry-like responsive photo grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {displayedPhotos.map((photo, index) => {
              const isSelected = selectedIds.has(photo.id);
              const imgUrl = photo.thumbnailLink || photo.webViewLink;

              return (
                <div
                  key={photo.id}
                  className={`group relative aspect-4/5 sm:aspect-square bg-stone-900 rounded-xl overflow-hidden cursor-pointer border transition duration-300 select-none ${
                    isSelected
                      ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-xl scale-[0.99]'
                      : 'border-stone-850 hover:border-stone-700'
                  }`}
                  onClick={() => {
                    setLightboxPhotos(displayedPhotos);
                    setLightboxIndex(index);
                  }}
                >
                  <img
                    src={imgUrl}
                    alt={photo.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />

                  {/* Top Shadow Gradient for contrast */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/30 pointer-events-none opacity-0 group-hover:opacity-100 transition duration-300" />

                  {/* Favorite / Select Heart Button (Instant tap on Mobile) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectPhoto(photo.id);
                    }}
                    aria-label="Toggle selection"
                    className={`absolute top-2.5 right-2.5 z-20 w-9 h-9 rounded-full flex items-center justify-center transition backdrop-blur-md ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-950/50 scale-105'
                        : 'bg-black/50 text-white hover:bg-black/70 sm:opacity-75 sm:group-hover:opacity-100'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition ${
                        isSelected ? 'fill-white stroke-white' : 'stroke-white'
                      }`}
                    />
                  </button>

                  {/* Checkmark badge when selected */}
                  {isSelected && (
                    <div className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-md bg-rose-600/90 text-white text-[10px] font-semibold tracking-wider uppercase backdrop-blur-xs flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Selected</span>
                    </div>
                  )}

                  {/* Paid / Free Status Badge */}
                  {(() => {
                    const isPaid = Boolean(photo.isPaid);
                    const isApproved = isPhotoApprovedForClient(album.id, photo.id);
                    const price = photo.price || album.defaultPhotoPrice || 100;

                    return (
                      <div className="absolute bottom-2.5 left-2.5 z-20 pointer-events-none">
                        {isPaid ? (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-sm flex items-center gap-1 ${
                              isApproved
                                ? 'bg-emerald-500 text-stone-950'
                                : 'bg-amber-500 text-stone-950'
                            }`}
                          >
                            {isApproved ? (
                              <>
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                <span>PAID (Unlocked)</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-2.5 h-2.5" />
                                <span>PAID ৳{price}</span>
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-black/70 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono font-bold backdrop-blur-xs">
                            FREE
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Individual Photo Download Trigger Button */}
                  {(() => {
                    const isPaid = Boolean(photo.isPaid);
                    const isApproved = isPhotoApprovedForClient(album.id, photo.id);
                    const isLocked = isPaid && !isApproved;

                    return (
                      <button
                        onClick={(e) => handlePhotoDownloadClick(photo, e)}
                        disabled={downloadingPhotoId === photo.id}
                        aria-label={`Download photo ${photo.name}`}
                        title={
                          isLocked
                            ? `Paid Photo: Click to pay ৳${photo.price || album.defaultPhotoPrice || 100} and download`
                            : isSelected
                            ? `Download selected photo (${photo.name})`
                            : `Download photo (${photo.name})`
                        }
                        className={`absolute bottom-2.5 right-2.5 z-20 p-2 rounded-xl backdrop-blur-md transition-all duration-200 flex items-center justify-center shadow-lg ${
                          isLocked
                            ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 scale-100 opacity-100 shadow-amber-950/40 ring-1 ring-amber-300/50'
                            : isSelected
                            ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 scale-100 opacity-100 shadow-amber-950/40 ring-1 ring-amber-300/50'
                            : 'bg-black/60 text-stone-200 hover:text-white hover:bg-black/85 opacity-0 group-hover:opacity-100 focus:opacity-100'
                        }`}
                      >
                        {downloadingPhotoId === photo.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-950" />
                        ) : justDownloadedId === photo.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-950 stroke-[3]" />
                        ) : isLocked ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>
                    );
                  })()}

                  {/* Photo Title and Upload Date Overlay at bottom */}
                  <div className="absolute bottom-0 inset-x-0 p-2 sm:p-2.5 pr-12 text-white z-10 pointer-events-none opacity-0 sm:group-hover:opacity-100 transition duration-200 bg-linear-to-t from-black/85 via-black/40 to-transparent">
                    <p className="text-[11px] font-mono truncate text-stone-200 drop-shadow-md">
                      {photo.name}
                    </p>
                    {photo.createdTime && (
                      <p className="text-[10px] text-stone-400 flex items-center gap-1 font-mono mt-0.5">
                        <Calendar className="w-2.5 h-2.5 text-amber-400/80" />
                        <span>
                          {new Date(photo.createdTime).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Warning Toast when limit is reached */}
      {limitWarning && (
        <div className="fixed top-16 left-1/2 -translate-y-1/2 z-60 max-w-md w-[92vw] sm:w-auto bg-amber-950/95 border border-amber-500 text-amber-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-fade-in backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-xs font-medium leading-tight">{limitWarning}</span>
          </div>
          <button
            onClick={() => setLimitWarning(null)}
            className="p-1 rounded-lg hover:bg-amber-900/60 text-amber-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Bottom Drawer for Mobile Viewers */}
      <div className="sm:hidden sticky bottom-0 z-40 bg-stone-900/95 backdrop-blur-lg border-t border-stone-800 px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-stone-400 uppercase font-mono tracking-wider">
            {hasLimit ? `Selection Limit: ${selectionLimit}` : 'Your Selection'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-rose-400">
              {hasLimit ? `${selectedIds.size} / ${selectionLimit}` : `${selectedIds.size} ${selectedIds.size === 1 ? 'photo' : 'photos'}`} chosen
            </span>
            {isLimitReached && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                Cap Reached
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSummaryModalOpen(true)}
            disabled={selectedIds.size === 0}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              selectedIds.size > 0
                ? 'bg-stone-800 border border-stone-700 text-stone-200 hover:bg-stone-750'
                : 'bg-stone-850 text-stone-600'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-rose-400" />
            <span>Review</span>
          </button>

          <button
            onClick={() => setIsSummaryModalOpen(true)}
            disabled={selectedIds.size === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
              selectedIds.size > 0
                ? 'bg-linear-to-r from-rose-500 to-amber-500 text-stone-950 shadow-md shadow-rose-950/40'
                : 'bg-stone-800 text-stone-500'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit</span>
          </button>
        </div>
      </div>

      {/* Selection Summary Modal */}
      <SelectionSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        album={album}
        selectedPhotos={selectedPhotos}
        onRemovePhoto={(photoId) => toggleSelectPhoto(photoId)}
        onDownloadPhoto={handlePhotoDownloadClick}
        onPayForPhotos={(photos) => {
          setPhotosToPay(photos);
          setIsPaymentModalOpen(true);
        }}
        isPhotoApproved={(photoId) => isPhotoApprovedForClient(album.id, photoId)}
        onPhotoClick={(photoId) => {
          setLightboxPhotos(selectedPhotos);
          const idx = selectedPhotos.findIndex((p) => p.id === photoId);
          if (idx !== -1) {
            setLightboxIndex(idx);
          }
        }}
        onProceedToSubmit={() => {
          setIsSummaryModalOpen(false);
          setIsSubmitModalOpen(true);
        }}
        hasLimit={hasLimit}
        selectionLimit={selectionLimit}
      />

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <PhotoLightboxModal
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          selectedIds={selectedIds}
          selectionLimit={hasLimit ? selectionLimit : undefined}
          isLimitReached={isLimitReached}
          onToggleSelect={toggleSelectPhoto}
          onDownloadPhoto={handlePhotoDownloadClick}
          onPayForPhoto={(photo) => {
            setPhotosToPay([photo]);
            setIsPaymentModalOpen(true);
          }}
          isApprovedForDownload={(photoId) => isPhotoApprovedForClient(album.id, photoId)}
          defaultPrice={album.defaultPhotoPrice || 100}
          accessToken={accessToken}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Submit Selection Modal */}
      <SubmitSelectionModal
        album={album}
        selectedPhotoIds={Array.from(selectedIds)}
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onBackToSummary={() => setIsSummaryModalOpen(true)}
        onViewProfile={() => setCurrentView('profile')}
        onSuccess={() => {
          setSubmissionsCount((prev) => prev + 1);
        }}
      />

      {/* Paid Photo Payment Modal */}
      <PhotoPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        album={album}
        photosToBuy={photosToPay}
        onPaymentSubmitted={(req) => {
          console.log('Payment request submitted:', req);
        }}
      />

      {/* AI Face Search Modal */}
      <FaceSearchModal
        isOpen={isFaceSearchModalOpen}
        onClose={() => setIsFaceSearchModalOpen(false)}
        album={album}
        onFilterMatchingPhotos={(matchingIds) => {
          setMatchingFacePhotoIds(matchingIds);
        }}
        onDownloadPhoto={handlePhotoDownloadClick}
        onPayForPhoto={(photo) => {
          setPhotosToPay([photo]);
          setIsPaymentModalOpen(true);
        }}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelectPhoto}
      />
    </div>
  );
};
