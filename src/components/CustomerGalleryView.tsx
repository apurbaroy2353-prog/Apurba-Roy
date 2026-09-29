import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Check,
  CheckCircle2,
  Heart,
  Search,
  Filter,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Download,
  Lock,
  Calendar,
  Sparkles,
  Layers,
  ArrowLeft,
  AlertCircle,
  Share2,
  Maximize2,
  Clock,
  Shield,
  FileCheck,
  Info,
  Image as ImageIcon,
  Smartphone,
  ExternalLink,
  Cloud,
  CloudOff,
  Loader2,
  RefreshCw,
  Key,
  Copy,
  RotateCcw,
  UserCheck,
  ArrowRight,
  Archive,
  Package,
  Undo2,
  Redo2,
  History,
  CheckSquare,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  CustomerGallery,
  CustomerGalleryPhoto,
  CustomerPhotoSelection,
  ClientGallerySession,
  AutoSaveStatus,
  SelectionHistoryEntry,
} from '../types';
import {
  verifyPin,
  updateCustomerSelections,
  getCustomerGalleryByToken,
  batchUpdateProjectSelections,
  clearAllProjectSelections,
  editCurrentSelection,
  submitProjectSelection,
  subscribeToProjectSelections,
  requestProjectZip,
  recordSelectionHistoryEntry,
  subscribeToSelectionHistory,
  restoreSelectionSnapshot,
  generateDrivePreviewUrl,
  generateDriveThumbnailUrl,
  generateDriveDownloadUrl,
} from '../services/customerGalleryService';
import {
  archiveSelectedPhotos,
  ArchiveProgress,
  ArchiveResult,
} from '../services/archiveService';
import { ensureAnonymousAuth, db } from '../services/auth';
import { LoadingOverlay } from './LoadingOverlay';
import {
  getOrCreateClientSession,
  getLocalSession,
  recoverSessionByCode,
  saveSelectionAction,
  processOfflineQueue,
  startSelectionAgain,
  updateSessionCustomerInfo,
} from '../services/clientSessionService';

interface LazyGalleryImageProps {
  photo: CustomerGalleryPhoto;
  alt: string;
  className?: string;
}

/**
 * High-performance Intersection Observer-based Lazy Image
 * Prevents network requests and memory consumption until photo is within 250px of the viewport.
 */
const LazyGalleryImage: React.FC<LazyGalleryImageProps> = ({ photo, alt, className = '' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(element);
        }
      },
      {
        root: null,
        rootMargin: '250px 0px', // Preload 250px before entering viewport for smooth scrolling
        threshold: 0.01,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const primaryUrl = useMemo(
    () => generateDriveThumbnailUrl(photo.driveFileId, photo.thumbnailUrl),
    [photo.driveFileId, photo.thumbnailUrl]
  );

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-stone-950 flex items-center justify-center">
      {/* Shimmer skeleton placeholder displayed while off-screen or loading */}
      {(!isInView || !isLoaded) && (
        <div className="absolute inset-0 bg-stone-900/95 flex flex-col items-center justify-center p-3 animate-pulse select-none z-1">
          <div className="w-8 h-8 rounded-xl bg-stone-850/80 border border-stone-800 flex items-center justify-center text-stone-600 mb-1.5">
            <ImageIcon className="w-4 h-4 text-stone-600" />
          </div>
          <span className="text-[10px] font-mono text-stone-500 truncate max-w-[85%] text-center">
            {photo.name}
          </span>
          <span className="text-[9px] text-stone-600 mt-0.5">Loading preview...</span>
        </div>
      )}

      {/* Actual image rendered only when intersecting */}
      {isInView && (
        <img
          src={imgError && photo.thumbnailUrl ? photo.thumbnailUrl : primaryUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            if (!imgError && photo.thumbnailUrl && photo.thumbnailUrl !== primaryUrl) {
              setImgError(true);
            } else {
              setIsLoaded(true);
            }
          }}
          className={`w-full h-full object-cover transition-all duration-500 ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-98'
          } ${className}`}
        />
      )}
    </div>
  );
};

interface CustomerGalleryViewProps {
  token: string;
  initialGallery?: CustomerGallery | null;
  onBackToAdmin?: () => void;
  isAdminPreview?: boolean;
}

export const CustomerGalleryView: React.FC<CustomerGalleryViewProps> = ({
  token,
  initialGallery,
  onBackToAdmin,
  isAdminPreview = false,
}) => {
  const [gallery, setGallery] = useState<CustomerGallery | null>(initialGallery || null);
  const [loading, setLoading] = useState(!initialGallery);
  const [error, setError] = useState<string | null>(null);

  // Debounced Queuing Mechanism for Firestore Updates
  const pendingQueueRef = useRef<Map<string, boolean>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hideSavedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Persistent Client Session & Auto-Save State
  const [clientSession, setClientSession] = useState<ClientGallerySession | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('saved');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // PIN Protection State
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Gallery Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'selected' | 'unselected'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'name_asc' | 'name_desc' | 'selected_first'>('default');
  const [visibleCount, setVisibleCount] = useState(48); // Progressive lazy loading

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);

  // Batch Multiple Selection Mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const lastClickedIndexRef = useRef<number | null>(null);

  // Lightbox State
  const [lightboxPhoto, setLightboxPhoto] = useState<CustomerGalleryPhoto | null>(null);

  // View Selected Mode
  const [isViewingSelectedOnly, setIsViewingSelectedOnly] = useState(false);

  // Submit Modal & Success Screen
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // Recovery PIN & Cross-device Session Recovery State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showEnterRecoveryModal, setShowEnterRecoveryModal] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [copiedRecoveryCode, setCopiedRecoveryCode] = useState(false);

  // Optional Customer Identification State
  const [showIdentificationModal, setShowIdentificationModal] = useState(false);
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientPhoneInput, setClientPhoneInput] = useState('');

  // Start Selection Again Confirm Modal
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // High-Resolution ZIP Request State
  const [showZipModal, setShowZipModal] = useState(false);
  const [isSubmittingZip, setIsSubmittingZip] = useState(false);
  const [zipEmailInput, setZipEmailInput] = useState('');
  const [zipPhoneInput, setZipPhoneInput] = useState('');
  const [zipNotesInput, setZipNotesInput] = useState('');

  // Selection History & Undo/Redo State
  const [historyEntries, setHistoryEntries] = useState<SelectionHistoryEntry[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);
  const [isRestoringHistory, setIsRestoringHistory] = useState(false);

  // Cloud Function Archive & ZIP Download State
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState<ArchiveProgress | null>(null);
  const [archiveResult, setArchiveResult] = useState<ArchiveResult | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Share Link & Visual Confirmation Toast State
  const [hasCopiedShareLink, setHasCopiedShareLink] = useState(false);
  const [shareToast, setShareToast] = useState<{ show: boolean; message: string; subtext?: string } | null>(null);
  const shareToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Accessible Keyboard Grid Navigation State
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Dynamic column detection for accurate ArrowUp/ArrowDown navigation
  const getGridColumnCount = useCallback(() => {
    const gridEl = gridContainerRef.current;
    if (!gridEl || !gridEl.children || gridEl.children.length < 2) {
      if (typeof window !== 'undefined') {
        const w = window.innerWidth;
        if (w >= 1280) return 6;
        if (w >= 1024) return 5;
        if (w >= 768) return 4;
        if (w >= 640) return 3;
        return 2;
      }
      return 2;
    }
    const children = Array.from(gridEl.children) as HTMLElement[];
    const firstTop = children[0].offsetTop;
    let count = 0;
    for (let i = 0; i < children.length; i++) {
      if (Math.abs(children[i].offsetTop - firstTop) < 10) {
        count++;
      } else {
        break;
      }
    }
    return count > 0 ? count : 2;
  }, []);

  // Touch Swipe for mobile lightbox
  const touchStartX = useRef<number | null>(null);

  // Listen to network status for reliable offline synchronization
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (token && gallery) {
        processOfflineQueue(token, gallery, (status) => setAutoSaveStatus(status));
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setAutoSaveStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token, gallery]);

  // Background anonymous authentication on mount
  useEffect(() => {
    ensureAnonymousAuth().catch((err) => {
      console.warn('Anonymous auth check notice:', err);
    });
  }, []);

  // Fetch gallery by token or projectId and hydrate
  useEffect(() => {
    let isMounted = true;
    const loadGallery = async () => {
      if (!initialGallery || initialGallery.secureToken !== token) {
        setLoading(true);
        try {
          const g = await getCustomerGalleryByToken(token);
          if (isMounted) {
            if (g) {
              setGallery(g);
              // Check session unlock
              const unlockedSession = sessionStorage.getItem(`rcfoto_pin_unlocked_${g.id}`);
              if (!g.pinEnabled || unlockedSession === 'true' || isAdminPreview) {
                setIsPinUnlocked(true);
              }
              if (g.status === 'submitted') {
                setIsSubmittedSuccess(true);
              }

              // Load existing selections into UI
              if (g.selectedPhotoIds && g.selectedPhotoIds.length > 0) {
                setSelectedIds(new Set(g.selectedPhotoIds));
              }

              // Load or create persistent client session
              try {
                const sess = await getOrCreateClientSession(token, g);
                if (isMounted) {
                  setClientSession(sess);
                  if (sess.selectedPhotoIds && sess.selectedPhotoIds.length > 0) {
                    setSelectedIds(new Set(sess.selectedPhotoIds));
                  }
                  if (sess.status === 'submitted') {
                    setIsSubmittedSuccess(true);
                  }
                  if ((g.askCustomerName || g.askCustomerPhone) && !sess.customerName && !sess.customerPhone) {
                    setShowIdentificationModal(true);
                  }
                }
              } catch (sessErr) {
                console.warn('Session init fallback:', sessErr);
              }
            } else {
              setError('Gallery Not Found. This link may be invalid or no longer available.');
            }
          }
        } catch (err: any) {
          if (isMounted) {
            setError('Could not load gallery. Please verify your connection.');
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      } else {
        setGallery(initialGallery);
        const unlockedSession = sessionStorage.getItem(`rcfoto_pin_unlocked_${initialGallery.id}`);
        if (!initialGallery.pinEnabled || unlockedSession === 'true' || isAdminPreview) {
          setIsPinUnlocked(true);
        }
        if (initialGallery.status === 'submitted') {
          setIsSubmittedSuccess(true);
        }
        if (initialGallery.selectedPhotoIds) {
          setSelectedIds(new Set(initialGallery.selectedPhotoIds));
        }
        getOrCreateClientSession(token, initialGallery)
          .then((sess) => {
            if (isMounted) {
              setClientSession(sess);
              if (sess.selectedPhotoIds && sess.selectedPhotoIds.length > 0) {
                setSelectedIds(new Set(sess.selectedPhotoIds));
              }
              if (sess.status === 'submitted') {
                setIsSubmittedSuccess(true);
              }
            }
          })
          .catch(() => {});
        setLoading(false);
      }
    };

    loadGallery();
    return () => {
      isMounted = false;
    };
  }, [token, initialGallery, isAdminPreview]);

  // Real-time Firestore sync: subscribe to selections subcollection
  useEffect(() => {
    if (!gallery?.id) return;
    const unsubscribe = subscribeToProjectSelections(gallery.id, (remoteSelectedIds) => {
      // Only sync if user does not have uncommitted pending clicks in flight
      if (pendingQueueRef.current.size === 0) {
        setSelectedIds(new Set(remoteSelectedIds));
        setGallery((prev) => (prev ? { ...prev, selectedCount: remoteSelectedIds.length } : null));
      }
    });
    return () => unsubscribe();
  }, [gallery?.id]);

  // Real-time Firestore sync for project document status (e.g. ZIP fulfillment link, status changes)
  useEffect(() => {
    if (!gallery?.id) return;
    try {
      const docRef = doc(db, 'projects', gallery.id);
      const unsub = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setGallery((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              zipRequested: !!data.zipRequested,
              zipRequestedAt: data.zipRequestedAt || prev.zipRequestedAt,
              zipRequestStatus: data.zipRequestStatus || prev.zipRequestStatus,
              zipRequestNotes: data.zipRequestNotes || prev.zipRequestNotes,
              zipDownloadUrl: data.zipDownloadUrl || prev.zipDownloadUrl,
              zipRequestedCount: data.zipRequestedCount || prev.zipRequestedCount,
              status: (data.status as any) || prev.status,
            };
          });
        }
      });
      return () => unsub();
    } catch (e) {
      console.warn('Realtime project doc listener notice:', e);
    }
  }, [gallery?.id]);

  // Real-time Firestore sync: subscribe to selection_history subcollection
  useEffect(() => {
    if (!gallery?.id) return;
    const unsub = subscribeToSelectionHistory(gallery.id, (entries) => {
      setHistoryEntries(entries);
    });
    return () => unsub();
  }, [gallery?.id]);

  // Clean up debounce timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (hideSavedTimerRef.current) clearTimeout(hideSavedTimerRef.current);
    };
  }, []);

  // Handle PIN Submission
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gallery) return;
    if (!pinInput.trim()) {
      setPinError('Please enter your 4-digit PIN');
      return;
    }
    setIsVerifyingPin(true);
    setPinError(null);
    try {
      const isValid = await verifyPin(pinInput, gallery.pinHash);
      if (isValid) {
        setIsPinUnlocked(true);
        sessionStorage.setItem(`rcfoto_pin_unlocked_${gallery.id}`, 'true');
      } else {
        setPinError('Incorrect PIN. Please try again.');
      }
    } catch {
      setPinError('Error verifying PIN. Please try again.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Check Expiration
  const isExpired = useMemo(() => {
    if (!gallery?.selectionDeadline) return false;
    const deadline = new Date(gallery.selectionDeadline);
    deadline.setHours(23, 59, 59, 999);
    return Date.now() > deadline.getTime();
  }, [gallery?.selectionDeadline]);

  // Read-only condition (submitted and editing disabled, or locked, or expired, or disabled)
  const isReadOnly = useMemo(() => {
    if (!gallery) return false;
    if (gallery.status === 'locked' || gallery.status === 'disabled' || isExpired) return true;
    if (gallery.status === 'submitted' && !gallery.allowEditing && !isEditMode) return true;
    return false;
  }, [gallery, isExpired, isEditMode]);

  // Format selection deadline nicely
  const formattedDeadline = useMemo(() => {
    if (!gallery?.selectionDeadline) return null;
    try {
      const d = new Date(gallery.selectionDeadline);
      return d.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return gallery.selectionDeadline;
    }
  }, [gallery?.selectionDeadline]);

  // All photos array
  const allPhotos: CustomerGalleryPhoto[] = useMemo(() => {
    return gallery?.photos || [];
  }, [gallery?.photos]);

  // Filtered & Sorted Photos
  const filteredPhotos = useMemo(() => {
    let result = [...allPhotos];

    // Search query filter (matches filename or number, e.g. '1023' or 'IMG_1023')
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (activeFilter === 'selected' || isViewingSelectedOnly) {
      result = result.filter((p) => selectedIds.has(p.id));
    } else if (activeFilter === 'unselected') {
      result = result.filter((p) => !selectedIds.has(p.id));
    }

    // Sorting
    if (sortBy === 'name_asc') {
      result.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (sortBy === 'name_desc') {
      result.sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
      );
    } else if (sortBy === 'selected_first') {
      result.sort((a, b) => {
        const aSel = selectedIds.has(a.id) ? 1 : 0;
        const bSel = selectedIds.has(b.id) ? 1 : 0;
        return bSel - aSel;
      });
    }

    return result;
  }, [allPhotos, searchQuery, activeFilter, isViewingSelectedOnly, selectedIds, sortBy]);

  // Visible sliced photos for infinite scrolling
  const visiblePhotos = useMemo(() => {
    return filteredPhotos.slice(0, visibleCount);
  }, [filteredPhotos, visibleCount]);

  // Intersection Observer Sentinel for Progressive Grid Infinite Loading
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 36, filteredPhotos.length));
        }
      },
      {
        root: null,
        rootMargin: '350px 0px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [filteredPhotos.length]);

  // Passive scroll listener fallback for browsers without IntersectionObserver
  useEffect(() => {
    if (typeof IntersectionObserver !== 'undefined') return;

    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 600
      ) {
        setVisibleCount((prev) => Math.min(prev + 36, filteredPhotos.length));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredPhotos.length]);

  // Debounced Photo Selection with Instant 0ms UI update and Batched Firestore updates
  const togglePhotoSelection = useCallback(
    (photoId: string) => {
      if (isReadOnly) {
        setSelectionNotice('This gallery is currently read-only.');
        setTimeout(() => setSelectionNotice(null), 3000);
        return;
      }

      if (!gallery) return;

      const isAlreadySelected = selectedIds.has(photoId);

      // Check max selection limit
      if (!isAlreadySelected && gallery.maxSelections > 0) {
        if (selectedIds.size >= gallery.maxSelections) {
          setSelectionNotice(`You can select a maximum of ${gallery.maxSelections} photos.`);
          setTimeout(() => setSelectionNotice(null), 4000);
          return;
        }
      }

      // 1. Instant optimistic UI update (0ms lag, smooth feedback)
      const nextIsSelected = !isAlreadySelected;
      const nextSet = new Set(selectedIds);
      if (nextIsSelected) {
        nextSet.add(photoId);
      } else {
        nextSet.delete(photoId);
      }

      // Save previous state for undo and clear redo branch
      setUndoStack((prev) => [...prev.slice(-30), Array.from(selectedIds)]);
      setRedoStack([]);

      setSelectedIds(nextSet);
      setGallery((prev) => (prev ? { ...prev, selectedCount: nextSet.size } : null));

      // 2. Queue mutation in pendingQueueRef
      pendingQueueRef.current.set(photoId, nextIsSelected);
      setAutoSaveStatus('saving');

      // 3. Debounce Firestore writeBatch (batches multiple rapid clicks into one API call)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const changes = new Map(pendingQueueRef.current);
        pendingQueueRef.current.clear();
        debounceTimerRef.current = null;

        if (changes.size === 0) return;

        try {
          await batchUpdateProjectSelections(
            gallery.id,
            changes,
            gallery.photos || [],
            nextSet.size
          );

          // Record action in selection_history subcollection
          const targetPhoto = gallery.photos?.find((p) => p.id === photoId);
          const photoName = targetPhoto?.name || `Photo ${photoId}`;
          recordSelectionHistoryEntry(gallery.id, {
            action: nextIsSelected ? 'select' : 'deselect',
            description: `${nextIsSelected ? 'Selected' : 'Deselected'} ${photoName}`,
            selectedPhotoIds: Array.from(nextSet),
            selectedCount: nextSet.size,
            affectedPhotoId: photoId,
            affectedPhotoName: photoName,
            timestamp: new Date().toISOString(),
            sessionId: clientSession?.sessionId,
            clientName: clientSession?.customerName || gallery.customerName,
          }).catch((e) => console.warn('History record error:', e));

          // Update clientSession local storage
          if (clientSession) {
            saveSelectionAction(clientSession, Array.from(nextSet), gallery, false).catch(() => {});
          }

          setAutoSaveStatus('saved');
          if (hideSavedTimerRef.current) clearTimeout(hideSavedTimerRef.current);
          hideSavedTimerRef.current = setTimeout(() => {
            setAutoSaveStatus('saved');
          }, 1500);
        } catch (err) {
          console.warn('Debounced Firestore selection sync failed:', err);
          setAutoSaveStatus('offline');
        }
      }, 350);
    },
    [gallery, isReadOnly, selectedIds, clientSession]
  );

  // Batch Select All Filtered Photos
  const handleSelectAllFiltered = async () => {
    if (isReadOnly || !gallery) return;

    const availableLimit = gallery.maxSelections > 0 ? gallery.maxSelections : Infinity;
    const currentSelected = new Set(selectedIds);
    const toAdd: string[] = [];

    for (const photo of filteredPhotos) {
      if (!currentSelected.has(photo.id)) {
        if (currentSelected.size + toAdd.length >= availableLimit) {
          setSelectionNotice(`Reached maximum limit of ${gallery.maxSelections} photos.`);
          setTimeout(() => setSelectionNotice(null), 3500);
          break;
        }
        toAdd.push(photo.id);
      }
    }

    if (toAdd.length === 0) {
      setSelectionNotice('All filtered photos are already selected.');
      setTimeout(() => setSelectionNotice(null), 2500);
      return;
    }

    // Save current onto undoStack
    setUndoStack((prev) => [...prev.slice(-30), Array.from(selectedIds)]);
    setRedoStack([]);

    const nextSet = new Set(selectedIds);
    const changes = new Map<string, boolean>();
    toAdd.forEach((id) => {
      nextSet.add(id);
      changes.set(id, true);
    });

    setSelectedIds(nextSet);
    setGallery((prev) => (prev ? { ...prev, selectedCount: nextSet.size } : null));

    try {
      await batchUpdateProjectSelections(
        gallery.id,
        changes,
        gallery.photos || [],
        nextSet.size
      );

      recordSelectionHistoryEntry(gallery.id, {
        action: 'batch_select',
        description: `Batch selected ${toAdd.length} photos`,
        selectedPhotoIds: Array.from(nextSet),
        selectedCount: nextSet.size,
        timestamp: new Date().toISOString(),
        sessionId: clientSession?.sessionId,
        clientName: clientSession?.customerName || gallery.customerName,
      }).catch(() => {});

      if (clientSession) {
        saveSelectionAction(clientSession, Array.from(nextSet), gallery, false).catch(() => {});
      }

      setSelectionNotice(`Selected ${toAdd.length} photos.`);
      setTimeout(() => setSelectionNotice(null), 3000);
    } catch (e) {
      console.warn('Batch select error:', e);
    }
  };

  // Batch Deselect All Filtered Photos
  const handleDeselectAllFiltered = async () => {
    if (isReadOnly || !gallery) return;

    const toRemove: string[] = [];
    filteredPhotos.forEach((p) => {
      if (selectedIds.has(p.id)) {
        toRemove.push(p.id);
      }
    });

    if (toRemove.length === 0) {
      setSelectionNotice('No filtered photos are currently selected.');
      setTimeout(() => setSelectionNotice(null), 2500);
      return;
    }

    // Save current onto undoStack
    setUndoStack((prev) => [...prev.slice(-30), Array.from(selectedIds)]);
    setRedoStack([]);

    const nextSet = new Set(selectedIds);
    const changes = new Map<string, boolean>();
    toRemove.forEach((id) => {
      nextSet.delete(id);
      changes.set(id, false);
    });

    setSelectedIds(nextSet);
    setGallery((prev) => (prev ? { ...prev, selectedCount: nextSet.size } : null));

    try {
      await batchUpdateProjectSelections(
        gallery.id,
        changes,
        gallery.photos || [],
        nextSet.size
      );

      recordSelectionHistoryEntry(gallery.id, {
        action: 'batch_select',
        description: `Batch deselected ${toRemove.length} photos`,
        selectedPhotoIds: Array.from(nextSet),
        selectedCount: nextSet.size,
        timestamp: new Date().toISOString(),
        sessionId: clientSession?.sessionId,
        clientName: clientSession?.customerName || gallery.customerName,
      }).catch(() => {});

      if (clientSession) {
        saveSelectionAction(clientSession, Array.from(nextSet), gallery, false).catch(() => {});
      }

      setSelectionNotice(`Deselected ${toRemove.length} photos.`);
      setTimeout(() => setSelectionNotice(null), 3000);
    } catch (e) {
      console.warn('Batch deselect error:', e);
    }
  };

  // Handle Photo Card Click in Batch Selection Mode with Shift+Click Range Selection
  const handlePhotoCardClick = (photo: CustomerGalleryPhoto, index: number, isShiftKey: boolean) => {
    if (isReadOnly) return;

    if (!isBatchMode) {
      // Normal mode: open lightbox preview
      setLightboxPhoto(photo);
      return;
    }

    // In Batch Mode: Shift+Click range selection
    if (isShiftKey && lastClickedIndexRef.current !== null && lastClickedIndexRef.current !== index) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const rangePhotos = visiblePhotos.slice(start, end + 1);

      const availableLimit = gallery?.maxSelections && gallery.maxSelections > 0 ? gallery.maxSelections : Infinity;
      const nextSet = new Set(selectedIds);
      const changes = new Map<string, boolean>();
      let addedCount = 0;

      // Save onto undoStack
      setUndoStack((prev) => [...prev.slice(-30), Array.from(selectedIds)]);
      setRedoStack([]);

      // Select all in range
      for (const p of rangePhotos) {
        if (!nextSet.has(p.id)) {
          if (nextSet.size >= availableLimit) {
            setSelectionNotice(`Reached maximum limit of ${gallery?.maxSelections} photos.`);
            setTimeout(() => setSelectionNotice(null), 3500);
            break;
          }
          nextSet.add(p.id);
          changes.set(p.id, true);
          addedCount++;
        }
      }

      if (addedCount > 0 && gallery) {
        setSelectedIds(nextSet);
        setGallery((prev) => (prev ? { ...prev, selectedCount: nextSet.size } : null));

        batchUpdateProjectSelections(
          gallery.id,
          changes,
          gallery.photos || [],
          nextSet.size
        ).catch(() => {});

        recordSelectionHistoryEntry(gallery.id, {
          action: 'batch_select',
          description: `Range selected ${addedCount} photos`,
          selectedPhotoIds: Array.from(nextSet),
          selectedCount: nextSet.size,
          timestamp: new Date().toISOString(),
          sessionId: clientSession?.sessionId,
          clientName: clientSession?.customerName || gallery.customerName,
        }).catch(() => {});

        setSelectionNotice(`Range selected ${addedCount} photos.`);
        setTimeout(() => setSelectionNotice(null), 3000);
      }

      lastClickedIndexRef.current = index;
      return;
    }

    // Normal click in batch mode: toggle selection
    lastClickedIndexRef.current = index;
    togglePhotoSelection(photo.id);
  };

  // Cross-device Session Recovery using 6-digit Recovery Code
  const handleRecoverSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = recoveryInput.trim();
    if (!code || code.length < 6) {
      setRecoveryError('Please enter a valid 6-digit recovery code.');
      return;
    }
    setIsRecovering(true);
    setRecoveryError(null);
    try {
      const res = await recoverSessionByCode(token, code);
      if (res.success && res.session) {
        setClientSession(res.session);
        setSelectedIds(new Set(res.session.selectedPhotoIds || []));
        setShowEnterRecoveryModal(false);
        setSelectionNotice(
          `Previous selections restored! (${res.session.selectedCount || 0} photos)`
        );
        setTimeout(() => setSelectionNotice(null), 4000);
      } else {
        setRecoveryError(res.error || 'Invalid recovery code. Please check and try again.');
      }
    } catch {
      setRecoveryError('Could not verify recovery code. Please check your network connection.');
    } finally {
      setIsRecovering(false);
    }
  };

  // Optional Customer Identification submission
  const handleSaveCustomerInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSession) {
      setShowIdentificationModal(false);
      return;
    }
    const name = clientNameInput.trim();
    const phone = clientPhoneInput.trim();
    try {
      await updateSessionCustomerInfo(clientSession.sessionId, name, phone);
      setClientSession((prev) =>
        prev ? { ...prev, customerName: name, customerPhone: phone } : null
      );
    } catch (err) {
      console.warn('Could not save customer info:', err);
    } finally {
      setShowIdentificationModal(false);
    }
  };

  // Clear All & Start Again: deletes all selection documents in Firestore, keeps gallery and project active
  const handleRestartSelections = async () => {
    if (!gallery) return;
    setIsRestarting(true);
    try {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingQueueRef.current.clear();

      // Push current selections onto undo stack so user can easily undo a reset
      if (selectedIds.size > 0) {
        setUndoStack((prev) => [...prev.slice(-30), Array.from(selectedIds)]);
        setRedoStack([]);
      }

      await clearAllProjectSelections(gallery.id);

      // Record in selection_history subcollection
      recordSelectionHistoryEntry(gallery.id, {
        action: 'clear',
        description: `Cleared all ${selectedIds.size} selected photos`,
        selectedPhotoIds: [],
        selectedCount: 0,
        timestamp: new Date().toISOString(),
        sessionId: clientSession?.sessionId,
        clientName: clientSession?.customerName || gallery.customerName,
      }).catch(() => {});

      setSelectedIds(new Set());
      setGallery((prev) => (prev ? { ...prev, selectedCount: 0, selectedPhotoIds: [], status: 'draft' } : null));
      setShowRestartModal(false);
      setSelectionNotice('All selections cleared. (Tip: Click "Undo" anytime to revert)');
      setTimeout(() => setSelectionNotice(null), 3500);
    } catch (err: any) {
      console.error('Error restarting selections:', err);
      // Fallback local reset
      setSelectedIds(new Set());
      setShowRestartModal(false);
      setSelectionNotice('Selections reset. You can begin picking your favorites.');
      setTimeout(() => setSelectionNotice(null), 3500);
    } finally {
      setIsRestarting(false);
    }
  };

  // Edit Current Selection: changes status back to draft, keeps all existing selected photos
  const handleStartEditing = async () => {
    if (!gallery) return;
    await editCurrentSelection(gallery.id);
    setGallery((prev) => (prev ? { ...prev, status: 'draft' } : null));
    setIsSubmittedSuccess(false);
    setIsEditMode(true);
    setSelectionNotice('Status returned to draft. You can now continue editing your selections.');
    setTimeout(() => setSelectionNotice(null), 3500);
  };

  // Open High-Resolution ZIP Request Modal
  const handleOpenZipModal = () => {
    setZipEmailInput(gallery?.customerEmail || gallery?.zipRequestEmail || clientSession?.customerName || '');
    setZipPhoneInput(gallery?.customerPhone || gallery?.zipRequestPhone || clientSession?.customerPhone || '');
    setZipNotesInput(gallery?.zipRequestNotes || '');
    setShowZipModal(true);
  };

  // Submit High-Resolution ZIP Request to Admin
  const handleRequestZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gallery) return;

    if (selectedIds.size === 0) {
      setSelectionNotice('Please select at least 1 photo before requesting a High-Res ZIP archive.');
      setTimeout(() => setSelectionNotice(null), 3500);
      return;
    }

    setIsSubmittingZip(true);
    try {
      const selectedArray = Array.from(selectedIds);
      await requestProjectZip(gallery.id, {
        clientEmail: zipEmailInput,
        clientPhone: zipPhoneInput,
        notes: zipNotesInput,
        selectedCount: selectedIds.size,
        selectedPhotoIds: selectedArray,
      });

      setGallery((prev) =>
        prev
          ? {
              ...prev,
              zipRequested: true,
              zipRequestedAt: new Date().toISOString(),
              zipRequestStatus: 'pending',
              zipRequestNotes: zipNotesInput,
              zipRequestEmail: zipEmailInput,
              zipRequestPhone: zipPhoneInput,
              zipRequestedCount: selectedIds.size,
            }
          : null
      );

      setShowZipModal(false);
      setSelectionNotice('High-Res ZIP archive requested! The photographer has been notified.');
      setTimeout(() => setSelectionNotice(null), 4500);
    } catch (err: any) {
      console.error('ZIP request error:', err);
      alert('Could not submit ZIP request: ' + (err.message || 'Please check your connection.'));
    } finally {
      setIsSubmittingZip(false);
    }
  };

  // Trigger Cloud Function to bundle selected photos into a single ZIP archive download
  const handleTriggerCloudArchive = async () => {
    if (!gallery || selectedIds.size === 0) {
      setSelectionNotice('Please select at least 1 photo to create an archive.');
      setTimeout(() => setSelectionNotice(null), 3000);
      return;
    }

    const selectedPhotosList = (gallery.photos || []).filter((p) => selectedIds.has(p.id));
    if (selectedPhotosList.length === 0) {
      setSelectionNotice('No matching photos found to archive.');
      setTimeout(() => setSelectionNotice(null), 3000);
      return;
    }

    setIsArchiving(true);
    setShowArchiveModal(true);
    setArchiveProgress({
      current: 0,
      total: selectedPhotosList.length,
      percent: 5,
      currentFileName: 'Initializing cloud archive worker...',
      statusText: `Preparing archive container for ${selectedPhotosList.length} photos...`,
    });

    try {
      const result = await archiveSelectedPhotos(
        gallery.id,
        gallery.customerName || gallery.eventName || 'Selected_Photos',
        selectedPhotosList,
        (progress) => setArchiveProgress(progress)
      );

      if (result.success) {
        setArchiveResult(result);
        setGallery((prev) =>
          prev
            ? {
                ...prev,
                zipDownloadUrl: result.downloadUrl,
                zipRequestStatus: 'ready',
                zipFulfilledAt: new Date().toISOString(),
                zipRequestedCount: selectedPhotosList.length,
              }
            : null
        );
        setSelectionNotice(`Archive ready! (${result.sizeFormatted})`);
        setTimeout(() => setSelectionNotice(null), 4000);
      } else {
        alert('Could not create archive: ' + (result.error || 'Please check your connection and try again.'));
      }
    } catch (err: any) {
      console.error('Cloud archiving error:', err);
      alert('Archive error: ' + (err.message || 'Please check your connection.'));
    } finally {
      setIsArchiving(false);
    }
  };

  // Undo last selection action
  const handleUndo = async () => {
    if (isReadOnly || undoStack.length === 0 || !gallery) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, undoStack.length - 1);

    // Save current to redo stack
    setRedoStack((prev) => [...prev.slice(-30), Array.from(selectedIds)]);
    setUndoStack(newUndoStack);

    // Immediate UI update
    setSelectedIds(new Set(previousState));
    setGallery((prev) => (prev ? { ...prev, selectedCount: previousState.length } : null));

    // Synchronize snapshot to Firestore & record history
    setIsRestoringHistory(true);
    try {
      await restoreSelectionSnapshot(
        gallery.id,
        previousState,
        gallery.photos || [],
        `Undo to ${previousState.length} photos`
      );
      setSelectionNotice(`Undo: restored to ${previousState.length} selected photos`);
      setTimeout(() => setSelectionNotice(null), 3000);
    } catch (e) {
      console.warn('Undo sync error:', e);
    } finally {
      setIsRestoringHistory(false);
    }
  };

  // Redo previously undone action
  const handleRedo = async () => {
    if (isReadOnly || redoStack.length === 0 || !gallery) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, redoStack.length - 1);

    // Save current to undo stack
    setUndoStack((prev) => [...prev.slice(-30), Array.from(selectedIds)]);
    setRedoStack(newRedoStack);

    // Immediate UI update
    setSelectedIds(new Set(nextState));
    setGallery((prev) => (prev ? { ...prev, selectedCount: nextState.length } : null));

    // Synchronize snapshot to Firestore & record history
    setIsRestoringHistory(true);
    try {
      await restoreSelectionSnapshot(
        gallery.id,
        nextState,
        gallery.photos || [],
        `Redo to ${nextState.length} photos`
      );
      setSelectionNotice(`Redo: restored to ${nextState.length} selected photos`);
      setTimeout(() => setSelectionNotice(null), 3000);
    } catch (e) {
      console.warn('Redo sync error:', e);
    } finally {
      setIsRestoringHistory(false);
    }
  };

  // Restore an exact historical selection state snapshot from the history list
  const handleRestoreHistoryEntry = async (entry: SelectionHistoryEntry) => {
    if (isReadOnly || !gallery) return;

    // Push current onto undo stack so user can easily undo this restore
    setUndoStack((prev) => [...prev.slice(-30), Array.from(selectedIds)]);
    setRedoStack([]);

    setSelectedIds(new Set(entry.selectedPhotoIds));
    setGallery((prev) => (prev ? { ...prev, selectedCount: entry.selectedCount } : null));
    setShowHistoryModal(false);

    setIsRestoringHistory(true);
    try {
      await restoreSelectionSnapshot(
        gallery.id,
        entry.selectedPhotoIds,
        gallery.photos || [],
        `Restored snapshot (${entry.selectedCount} photos)`
      );
      setSelectionNotice(`Restored snapshot with ${entry.selectedCount} photos.`);
      setTimeout(() => setSelectionNotice(null), 3500);
    } catch (e) {
      console.warn('Snapshot restore error:', e);
    } finally {
      setIsRestoringHistory(false);
    }
  };

  // Comprehensive Keyboard Navigation (Undo/Redo, Grid Arrow Navigation, Enter/Space Selection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const activeTag = activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      // 1. Undo / Redo Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Check if any modal is currently open
      const isAnyModalOpen =
        isSubmitModalOpen ||
        isSubmittedSuccess ||
        showRecoveryModal ||
        showEnterRecoveryModal ||
        showIdentificationModal ||
        showRestartModal ||
        showZipModal ||
        showHistoryModal ||
        showArchiveModal;

      // 2. Lightbox Navigation
      if (lightboxPhoto) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setLightboxPhoto(null);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const curIdx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
          if (curIdx > 0) setLightboxPhoto(filteredPhotos[curIdx - 1]);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const curIdx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
          if (curIdx < filteredPhotos.length - 1) setLightboxPhoto(filteredPhotos[curIdx + 1]);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePhotoSelection(lightboxPhoto.id);
        }
        return;
      }

      if (isAnyModalOpen || visiblePhotos.length === 0) return;

      // 3. Arrow Keys Navigation in the Photo Grid
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIdx = focusedIndex === null ? 0 : Math.min(visiblePhotos.length - 1, focusedIndex + 1);
        setFocusedIndex(nextIdx);
        cardRefs.current[nextIdx]?.focus();
        cardRefs.current[nextIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (nextIdx >= visiblePhotos.length - 6) {
          setVisibleCount((prev) => Math.min(prev + 36, filteredPhotos.length));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIdx = focusedIndex === null ? 0 : Math.max(0, focusedIndex - 1);
        setFocusedIndex(prevIdx);
        cardRefs.current[prevIdx]?.focus();
        cardRefs.current[prevIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const cols = getGridColumnCount();
        const downIdx = focusedIndex === null ? 0 : Math.min(visiblePhotos.length - 1, focusedIndex + cols);
        setFocusedIndex(downIdx);
        cardRefs.current[downIdx]?.focus();
        cardRefs.current[downIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (downIdx >= visiblePhotos.length - 6) {
          setVisibleCount((prev) => Math.min(prev + 36, filteredPhotos.length));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const cols = getGridColumnCount();
        const upIdx = focusedIndex === null ? 0 : Math.max(0, focusedIndex - cols);
        setFocusedIndex(upIdx);
        cardRefs.current[upIdx]?.focus();
        cardRefs.current[upIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusedIndex(0);
        cardRefs.current[0]?.focus();
        cardRefs.current[0]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (e.key === 'End') {
        e.preventDefault();
        const lastIdx = visiblePhotos.length - 1;
        setFocusedIndex(lastIdx);
        cardRefs.current[lastIdx]?.focus();
        cardRefs.current[lastIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (e.key === 'Enter' || e.key === ' ') {
        // 4. Select / Deselect Photo using Enter or Space Key
        if (focusedIndex !== null && visiblePhotos[focusedIndex]) {
          e.preventDefault();
          togglePhotoSelection(visiblePhotos[focusedIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undoStack,
    redoStack,
    selectedIds,
    gallery,
    isReadOnly,
    lightboxPhoto,
    focusedIndex,
    visiblePhotos,
    filteredPhotos,
    getGridColumnCount,
    togglePhotoSelection,
    isSubmitModalOpen,
    isSubmittedSuccess,
    showRecoveryModal,
    showEnterRecoveryModal,
    showIdentificationModal,
    showRestartModal,
    showZipModal,
    showHistoryModal,
    showArchiveModal,
  ]);

  // Copy current gallery share link to clipboard with visual confirmation toast
  const handleCopyShareLink = async () => {
    let shareUrl = '';
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      shareUrl = `${url.origin}/gallery/${token}`;
    }

    if (!shareUrl) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setHasCopiedShareLink(true);
      if (shareToastTimeoutRef.current) {
        clearTimeout(shareToastTimeoutRef.current);
      }
      setShareToast({
        show: true,
        message: 'Gallery Share Link Copied!',
        subtext: 'Link copied to clipboard — ready to share with family or clients.',
      });

      shareToastTimeoutRef.current = setTimeout(() => {
        setHasCopiedShareLink(false);
        setShareToast(null);
      }, 3500);
    } catch (err) {
      console.error('Failed to copy gallery link:', err);
      setSelectionNotice('Could not copy link to clipboard.');
      setTimeout(() => setSelectionNotice(null), 3000);
    }
  };

  // Auto-save UI status renderer
  const renderAutoSaveBadge = () => {
    if (!isOnline || autoSaveStatus === 'offline') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
          title="Selections are safely saved locally on this device and will automatically sync when connection returns."
        >
          <CloudOff className="w-3.5 h-3.5 text-amber-400" />
          <span>Offline - changes will sync automatically</span>
        </span>
      );
    }
    if (autoSaveStatus === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          <span>Saving...</span>
        </span>
      );
    }
    if (autoSaveStatus === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
          <span>Syncing...</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
        <span>All changes saved ✓</span>
      </span>
    );
  };

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!lightboxPhoto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxPhoto(null);
      } else if (e.key === 'ArrowRight') {
        const curIdx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
        if (curIdx >= 0 && curIdx < filteredPhotos.length - 1) {
          setLightboxPhoto(filteredPhotos[curIdx + 1]);
        }
      } else if (e.key === 'ArrowLeft') {
        const curIdx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
        if (curIdx > 0) {
          setLightboxPhoto(filteredPhotos[curIdx - 1]);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePhotoSelection(lightboxPhoto.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhoto, filteredPhotos, togglePhotoSelection]);

  // Touch swipe support for mobile lightbox
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !lightboxPhoto) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      const curIdx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
      if (diff < 0 && curIdx < filteredPhotos.length - 1) {
        // Swiped Left -> Next
        setLightboxPhoto(filteredPhotos[curIdx + 1]);
      } else if (diff > 0 && curIdx > 0) {
        // Swiped Right -> Previous
        setLightboxPhoto(filteredPhotos[curIdx - 1]);
      }
    }
    touchStartX.current = null;
  };

  // Submit Final Selection: flushes queue, saves status = 'submitted' with server timestamp, transitions cleanly
  const handleFinalSubmit = async () => {
    if (!gallery) return;
    setIsSubmitting(true);
    try {
      // 1. Flush any pending uncommitted selections first
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (pendingQueueRef.current.size > 0) {
        const changes = new Map(pendingQueueRef.current);
        pendingQueueRef.current.clear();
        await batchUpdateProjectSelections(
          gallery.id,
          changes,
          gallery.photos || [],
          selectedIds.size
        ).catch(() => {});
      }

      const photoIdsArray = Array.from(selectedIds);

      // 2. Submit to Firestore
      const res = await submitProjectSelection(
        gallery.id,
        photoIdsArray,
        customerNotes
      );

      // Also finalize client session
      if (clientSession) {
        saveSelectionAction(clientSession, photoIdsArray, gallery, true).catch(() => {});
      }

      setGallery((prev) =>
        prev
          ? {
              ...prev,
              status: 'submitted',
              submittedAt: new Date().toISOString(),
              selectedCount: photoIdsArray.length,
              selectedPhotoIds: photoIdsArray,
            }
          : null
      );
      setIsSubmittedSuccess(true);
      setIsSubmitModalOpen(false);
      setIsViewingSelectedOnly(false);
    } catch (err: any) {
      console.warn('Submission fallback notice:', err);
      // Ensure UI doesn't hang; mark as submitted
      setGallery((prev) => (prev ? { ...prev, status: 'submitted' } : null));
      setIsSubmittedSuccess(true);
      setIsSubmitModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download individual photo
  const handleDownloadPhoto = (photo: CustomerGalleryPhoto) => {
    if (!gallery?.allowDownloads) return;
    const link = document.createElement('a');
    link.href = photo.previewUrl || photo.thumbnailUrl;
    link.download = photo.name || 'photo.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading Screen
  if (loading) {
    return (
      <LoadingOverlay
        variant="fullscreen"
        statusText="Loading gallery..."
        subtext="Fetching high-resolution previews and album details"
      />
    );
  }

  // Error / Invalid Link Screen
  if (error || !gallery) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-center text-stone-300">
        <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-serif text-stone-100 mb-2">Gallery Not Found</h1>
        <p className="text-sm text-stone-400 max-w-md mb-6">
          This link may be invalid, expired, or no longer available. Please contact your photographer for an updated link.
        </p>
        {isAdminPreview && onBackToAdmin && (
          <button
            onClick={onBackToAdmin}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-xl transition shadow-lg"
          >
            Back to Admin Dashboard
          </button>
        )}
      </div>
    );
  }

  // Disabled Gallery Screen
  if (gallery.status === 'disabled') {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-center text-stone-300">
        <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-serif text-stone-100 mb-2">This gallery is currently unavailable.</h1>
        <p className="text-sm text-stone-400 max-w-md mb-6">
          Please contact your photographer.
        </p>
        {isAdminPreview && onBackToAdmin && (
          <button
            onClick={onBackToAdmin}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-xl transition shadow-lg"
          >
            Back to Admin Dashboard
          </button>
        )}
      </div>
    );
  }

  // Expired Gallery Screen
  if (isExpired && gallery.status !== 'submitted') {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-center text-stone-300">
        <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <Clock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-serif text-stone-100 mb-2">This gallery has expired.</h1>
        <p className="text-sm text-stone-400 max-w-md mb-6">
          Please contact your photographer.
        </p>
        {isAdminPreview && onBackToAdmin && (
          <button
            onClick={onBackToAdmin}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-xl transition shadow-lg"
          >
            Back to Admin Dashboard
          </button>
        )}
      </div>
    );
  }

  // PIN Protection Screen
  if (gallery.pinEnabled && !isPinUnlocked) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-stone-100">
        <div className="w-full max-w-sm bg-stone-900/90 border border-stone-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 font-serif font-bold text-xl mx-auto mb-4 shadow-lg">
            RC
          </div>
          <h2 className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-widest mb-1">
            RC Foto
          </h2>
          <h1 className="text-2xl font-serif text-stone-100 mb-1">Private Gallery</h1>
          <p className="text-xs text-stone-400 mb-6">
            {gallery.customerName} • {gallery.eventName}
          </p>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <label className="block text-xs text-stone-400 mb-2">Enter Gallery PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(null);
                }}
                autoFocus
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.5em] py-3 px-4 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-stone-100 placeholder:text-stone-700 font-mono transition"
              />
              {pinError && (
                <p className="text-xs text-rose-400 mt-2 font-medium flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{pinError}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifyingPin}
              className="w-full py-3 bg-linear-to-r from-amber-500 to-amber-600 hover:opacity-95 text-stone-950 font-semibold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isVerifyingPin ? 'Verifying...' : 'Open Gallery'}</span>
            </button>
          </form>

          <p className="text-[11px] text-stone-500 mt-6">
            No login or account creation required.
          </p>
        </div>
      </div>
    );
  }

  // Main Customer Gallery View
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col selection:bg-amber-500 selection:text-stone-950 pb-28">
      {/* Admin Preview Banner (if photographer is previewing) */}
      {isAdminPreview && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span>Admin Live Preview Mode (How your customer sees it)</span>
          </div>
          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-lg text-xs transition"
            >
              Exit to Dashboard
            </button>
          )}
        </div>
      )}

      {/* Floating Selection Notification Toast */}
      {selectionNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <AlertCircle className="w-4 h-4" />
          <span>{selectionNotice}</span>
        </div>
      )}

      {/* Floating Share Link Copied Toast Notification */}
      {shareToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 border border-emerald-500/50 text-stone-100 text-xs px-5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 ring-1 ring-emerald-500/20">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-emerald-300">{shareToast.message}</p>
            {shareToast.subtext && (
              <p className="text-[11px] text-stone-400 mt-0.5">{shareToast.subtext}</p>
            )}
          </div>
          <button
            onClick={() => setShareToast(null)}
            className="ml-2 text-stone-500 hover:text-stone-300 p-1 transition cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-stone-850 bg-stone-900/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 font-serif font-bold text-lg shadow-md shrink-0">
              RC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest text-amber-400 font-semibold uppercase">
                  RC Foto
                </span>
                {gallery.status === 'submitted' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Submitted</span>
                  </span>
                )}
                {gallery.zipRequested && (
                  <button
                    type="button"
                    onClick={handleOpenZipModal}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 cursor-pointer hover:bg-purple-500/30 transition"
                    title={gallery.zipDownloadUrl ? "High-Res ZIP is ready! Click to download." : "High-Res ZIP has been requested"}
                  >
                    <Archive className="w-3 h-3 text-purple-400" />
                    <span>{gallery.zipRequestStatus === 'ready' && gallery.zipDownloadUrl ? 'ZIP Ready' : 'ZIP Requested'}</span>
                  </button>
                )}
                {/* Auto-Save Status Badge */}
                {renderAutoSaveBadge()}
              </div>
              <h1 className="text-lg sm:text-xl font-serif text-stone-100 font-medium">
                {gallery.customerName}
              </h1>
              <p className="text-xs text-stone-400">
                {gallery.eventName} • {gallery.galleryName}
              </p>
            </div>
          </div>

          {/* Controls & Stats in Header */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs text-stone-300">
            {/* Recovery Code Pill */}
            {clientSession?.recoveryCode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRecoveryModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-950/80 hover:bg-stone-800 border border-stone-800 text-[11px] font-mono text-stone-300 hover:text-amber-300 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Click to view 6-digit recovery code to continue on another device"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Recovery Code:{' '}
                    <strong className="text-amber-400 font-bold">{clientSession.recoveryCode}</strong>
                  </span>
                </button>

                <button
                  onClick={() => setShowEnterRecoveryModal(true)}
                  className="text-[11px] text-stone-400 hover:text-amber-400 underline transition cursor-pointer hidden lg:inline"
                >
                  Continue Previous Selection?
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-stone-800 hidden sm:block" />

            <div>
              <span className="text-stone-500 block text-[10px] uppercase font-mono">Photos</span>
              <span className="font-semibold text-stone-200">
                {(gallery.totalPhotos || allPhotos.length).toLocaleString()} Photos
              </span>
            </div>

            <div className="h-6 w-px bg-stone-800" />

            <div>
              <span className="text-stone-500 block text-[10px] uppercase font-mono">Selected</span>
              <span className="font-semibold text-amber-400 flex items-center gap-1">
                <span>{selectedIds.size}</span>
                {gallery.maxSelections > 0 && (
                  <span className="text-stone-500">/ {gallery.maxSelections} Max</span>
                )}
              </span>
            </div>

            {formattedDeadline && (
              <>
                <div className="h-6 w-px bg-stone-800 hidden sm:block" />
                <div className="hidden sm:block">
                  <span className="text-stone-500 block text-[10px] uppercase font-mono">Deadline</span>
                  <span className="font-semibold text-stone-300 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>{formattedDeadline}</span>
                  </span>
                </div>
              </>
            )}

            {!isReadOnly && (
              <>
                <div className="h-6 w-px bg-stone-800 hidden md:block" />
                <div className="hidden md:flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="p-1.5 rounded-lg bg-stone-950/80 hover:bg-stone-800 disabled:opacity-30 border border-stone-800 text-stone-300 hover:text-amber-400 transition cursor-pointer"
                    title="Undo last selection (Ctrl+Z)"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="p-1.5 rounded-lg bg-stone-950/80 hover:bg-stone-800 disabled:opacity-30 border border-stone-800 text-stone-300 hover:text-amber-400 transition cursor-pointer"
                    title="Redo selection (Ctrl+Y)"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-stone-950/80 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-400 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                    title="View selection history timeline"
                  >
                    <History className="w-3.5 h-3.5 text-stone-400" />
                    <span>History</span>
                    {historyEntries.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 font-mono">
                        {historyEntries.length}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Copy Share Link Button in Header */}
            <div className="h-6 w-px bg-stone-800 hidden sm:block" />
            <button
              type="button"
              onClick={handleCopyShareLink}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                hasCopiedShareLink
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-stone-950/80 hover:bg-stone-800 border-stone-800 text-stone-300 hover:text-amber-400'
              }`}
              title="Copy link to this customer gallery to clipboard"
            >
              {hasCopiedShareLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copy Share Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1 flex flex-col gap-6">
        {/* Offline Banner Alert */}
        {(!isOnline || autoSaveStatus === 'offline') && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Offline Mode Active:</strong> You can continue selecting photos freely. All your selections are safely recorded on this device and will automatically sync to your photographer when your connection returns.
              </span>
            </div>
          </div>
        )}
        {/* Read-only Alert Banner (if submitted & not editable) */}
        {gallery.status === 'submitted' && !gallery.allowEditing && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Your photo selection has been submitted ({selectedIds.size} photos selected). The gallery is in read-only mode.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setIsViewingSelectedOnly(true)}
                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-medium transition cursor-pointer"
              >
                View Selection ({selectedIds.size})
              </button>

              {/* Cloud Function ZIP Archive Trigger or Direct Download */}
              {(archiveResult?.downloadUrl || gallery.zipDownloadUrl) ? (
                <a
                  href={archiveResult?.downloadUrl || gallery.zipDownloadUrl}
                  download={archiveResult?.fileName || `${gallery.customerName.replace(/\s+/g, '_')}_Selections.zip`}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                  title="Download your single ZIP file containing all selected photos"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ZIP {archiveResult?.sizeFormatted ? `(${archiveResult.sizeFormatted})` : ''}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleTriggerCloudArchive}
                  disabled={isArchiving || selectedIds.size === 0}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                  title="Trigger cloud function to archive selected photos into a single ZIP file"
                >
                  {isArchiving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Archiving ZIP...</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5 text-purple-200" />
                      <span>Archive & Download ZIP</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search Bar & Filter Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-stone-900/70 border border-stone-850 p-3.5 sm:p-4 rounded-2xl backdrop-blur-md shadow-sm">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename or photo number (e.g. IMG_1023, 1023)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-500 transition shadow-inner"
              aria-label="Search photos by filename or photo number"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-0.5 rounded-full hover:bg-stone-800 transition cursor-pointer"
                title="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown & Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Status Filter Dropdown */}
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none text-amber-400">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <select
                value={isViewingSelectedOnly ? 'selected' : activeFilter}
                onChange={(e) => {
                  const val = e.target.value as 'all' | 'selected' | 'unselected';
                  setActiveFilter(val);
                  setIsViewingSelectedOnly(val === 'selected');
                }}
                className="appearance-none pl-8 pr-8 py-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-stone-700 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 transition cursor-pointer font-medium"
                aria-label="Filter photos by selection status"
              >
                <option value="all">All Photos ({allPhotos.length})</option>
                <option value="selected">Selected ({selectedIds.size})</option>
                <option value="unselected">Unselected ({Math.max(0, allPhotos.length - selectedIds.size)})</option>
              </select>
              <div className="absolute right-2.5 pointer-events-none text-stone-500">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Sort Order Dropdown */}
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none text-stone-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-8 pr-8 py-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-stone-700 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 transition cursor-pointer font-medium"
                aria-label="Sort photos"
              >
                <option value="default">Original Order</option>
                <option value="name_asc">Filename: A → Z</option>
                <option value="name_desc">Filename: Z → A</option>
                <option value="selected_first">Selected First</option>
              </select>
              <div className="absolute right-2.5 pointer-events-none text-stone-500">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Quick Status Pills for instant mobile/tablet toggle */}
            <div className="hidden sm:flex items-center gap-1.5 bg-stone-950/80 p-1 rounded-xl border border-stone-850">
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('all');
                  setIsViewingSelectedOnly(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeFilter === 'all' && !isViewingSelectedOnly
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('selected');
                  setIsViewingSelectedOnly(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                  activeFilter === 'selected' || isViewingSelectedOnly
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Check className="w-3 h-3" />
                <span>Selected</span>
              </button>
            </div>

            {/* Select Multiple / Batch Selection Toggle */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  lastClickedIndexRef.current = null;
                }}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isBatchMode
                    ? 'bg-amber-400 text-stone-950 border-amber-400 shadow-md ring-2 ring-amber-400/30'
                    : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-300 hover:text-stone-100'
                }`}
                title="Toggle Select Multiple: click anywhere on cards to rapidly select multiple photos"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{isBatchMode ? 'Multiple: ON' : 'Select Multiple'}</span>
              </button>
            )}

            {/* Reset Filters button if any filter/search is active */}
            {(searchQuery.trim() !== '' || activeFilter !== 'all' || isViewingSelectedOnly || sortBy !== 'default') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                  setIsViewingSelectedOnly(false);
                  setSortBy('default');
                }}
                className="px-3 py-2.5 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-300 hover:text-amber-400 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Reset search and filters to default"
              >
                <RotateCcw className="w-3 h-3 text-stone-400" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* Counter pill */}
            <div className="text-[11px] text-stone-400 px-2.5 py-2 rounded-xl bg-stone-950/80 border border-stone-850 font-mono hidden md:block">
              <span className="text-amber-400 font-semibold">{filteredPhotos.length}</span>
              <span className="text-stone-500"> / {allPhotos.length}</span>
            </div>

            {/* Keyboard Accessibility Hint Pill */}
            <div
              className="text-[11px] text-stone-400 px-3 py-2 rounded-xl bg-stone-950/80 border border-stone-850 font-mono hidden xl:flex items-center gap-1.5 shadow-xs"
              title="Use Arrow keys to navigate photos, Enter or Space to toggle selection"
            >
              <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-300 text-[10px]">
                ↑↓←→
              </kbd>
              <span className="text-stone-500">Navigate</span>
              <span className="text-stone-600">•</span>
              <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-amber-400 text-[10px] font-bold">
                Enter ↵
              </kbd>
              <span className="text-stone-500">Select</span>
            </div>
          </div>
        </div>

        {/* Selected Photos Banner (if in view selected only mode) */}
        {isViewingSelectedOnly && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-amber-400" />
              <span>Viewing your {selectedIds.size} selected photos</span>
            </div>
            <button
              onClick={() => setIsViewingSelectedOnly(false)}
              className="text-xs font-semibold text-amber-400 hover:underline"
            >
              Back to All Photos
            </button>
          </div>
        )}

        {/* Batch Selection Mode Banner & Quick Actions */}
        {isBatchMode && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-amber-200 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-300 text-sm">Select Multiple Active</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-stone-950">
                    {selectedIds.size} Selected
                  </span>
                </div>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Click any photo to select/deselect • Hold <kbd className="px-1.5 py-0.5 bg-stone-900 border border-amber-500/40 rounded text-[10px] font-mono text-amber-200">Shift</kbd> to select a range of photos
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold transition cursor-pointer shadow-xs"
              >
                Select All ({filteredPhotos.length})
              </button>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-amber-500/30 text-amber-300 font-semibold transition cursor-pointer"
              >
                Deselect All
              </button>
              <button
                type="button"
                onClick={() => setIsBatchMode(false)}
                className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-300 hover:text-stone-100 font-medium transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Photo Grid */}
        {filteredPhotos.length === 0 ? (
          <div className="py-16 px-4 text-center bg-stone-900/40 border border-stone-850 rounded-3xl max-w-md mx-auto text-stone-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-850 border border-stone-800 flex items-center justify-center mx-auto text-stone-500">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-200">No photos found</p>
              <p className="text-xs text-stone-500 mt-1">
                {searchQuery
                  ? `No photos matching "${searchQuery}"`
                  : activeFilter !== 'all'
                  ? `No photos found in "${activeFilter}" status`
                  : 'No photos found in this gallery.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
                setIsViewingSelectedOnly(false);
                setSortBy('default');
              }}
              className="px-4 py-2 bg-stone-850 hover:bg-stone-800 border border-stone-750 rounded-xl text-xs text-amber-400 font-semibold transition cursor-pointer"
            >
              Clear Search & Show All Photos
            </button>
          </div>
        ) : (
          <div
            ref={gridContainerRef}
            role="region"
            aria-label="Photo gallery grid"
            tabIndex={-1}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 focus:outline-hidden"
          >
            {visiblePhotos.map((photo, index) => {
              const isSelected = selectedIds.has(photo.id);
              const isFocused = focusedIndex === index;
              return (
                <div
                  key={photo.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`Photo ${index + 1} of ${filteredPhotos.length}: ${photo.name}. ${
                    isSelected ? 'Selected' : 'Not selected'
                  }. Press Enter to toggle selection.`}
                  onFocus={() => setFocusedIndex(index)}
                  onClick={(e) => {
                    setFocusedIndex(index);
                    if (isBatchMode) {
                      handlePhotoCardClick(photo, index, e.shiftKey);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      togglePhotoSelection(photo.id);
                    }
                  }}
                  className={`group relative rounded-2xl overflow-hidden bg-stone-900 border transition-all duration-200 flex flex-col focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 ${
                    isBatchMode ? 'cursor-pointer select-none' : 'cursor-pointer'
                  } ${
                    isFocused
                      ? 'ring-2 ring-amber-400 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)] scale-[1.01]'
                      : isSelected
                      ? 'border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.3)] ring-2 ring-amber-400/50'
                      : isBatchMode
                      ? 'border-stone-850 hover:border-amber-400/70 hover:shadow-md'
                      : 'border-stone-850 hover:border-stone-700'
                  }`}
                >
                  {/* Image Container */}
                  <div
                    onClick={(e) => {
                      if (isBatchMode) {
                        e.stopPropagation();
                        handlePhotoCardClick(photo, index, e.shiftKey);
                      } else {
                        setLightboxPhoto(photo);
                      }
                    }}
                    className="relative aspect-3/4 sm:aspect-square bg-stone-950 overflow-hidden cursor-pointer"
                  >
                    {/* Lazy Loaded Image via Intersection Observer */}
                    <LazyGalleryImage
                      photo={photo}
                      alt={photo.name}
                      className="group-hover:scale-105"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-stone-950/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Selected Badge or Batch Checkbox Indicator (Top Right) */}
                    {isBatchMode ? (
                      <div className="absolute top-2.5 right-2.5 z-10 transition-transform">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center shadow-lg font-bold ring-2 ring-stone-950">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-white/70 bg-stone-950/70 backdrop-blur-md flex items-center justify-center group-hover:border-amber-400 shadow-md">
                            <div className="w-2 h-2 rounded-full bg-amber-400/0 group-hover:bg-amber-400/40 transition-colors" />
                          </div>
                        )}
                      </div>
                    ) : (
                      isSelected && (
                        <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center shadow-lg font-bold">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )
                    )}

                    {/* Keyboard Focus Key Hint (shows Enter key badge when card is active) */}
                    {isFocused && (
                      <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-amber-400 text-stone-950 font-mono text-[9px] font-bold shadow-md flex items-center gap-1 pointer-events-none animate-in fade-in">
                        <span>Enter ↵</span>
                      </div>
                    )}

                    {/* Preview Button on Hover (In normal mode center, in batch mode bottom-right) */}
                    {isBatchMode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxPhoto(photo);
                        }}
                        className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-stone-950/80 hover:bg-stone-900 border border-stone-750 text-stone-200 text-[10px] font-medium backdrop-blur-md flex items-center gap-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                        title="View photo preview"
                      >
                        <Eye className="w-3 h-3 text-amber-400" />
                        <span>Preview</span>
                      </button>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="px-3 py-1.5 rounded-full bg-stone-900/90 text-stone-200 text-[11px] font-medium backdrop-blur-md flex items-center gap-1.5 shadow-xl">
                          <Eye className="w-3 h-3 text-amber-400" />
                          <span>Preview</span>
                        </span>
                      </div>
                    )}

                    {/* Photo Number Pill (Top Left) */}
                    {!isFocused && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-950/70 text-[10px] font-mono text-stone-300 backdrop-blur-xs">
                        #{index + 1}
                      </span>
                    )}
                  </div>

                  {/* Card Footer: Filename & Select Button */}
                  <div className="p-2.5 sm:p-3 bg-stone-900/95 flex flex-col gap-2">
                    <p
                      className="text-[11px] font-mono text-stone-300 truncate"
                      title={photo.name}
                    >
                      {photo.name}
                    </p>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePhotoCardClick(photo, index, e.shiftKey);
                      }}
                      disabled={isReadOnly}
                      className={`w-full py-1.5 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-stone-950 shadow-sm hover:bg-amber-300'
                          : isBatchMode
                          ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30'
                          : 'bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-800'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Selected</span>
                        </>
                      ) : (
                        <span>{isBatchMode ? 'Click to Select' : 'Select'}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Intersection Observer Sentinel for automatic smooth infinite scroll */}
        {visibleCount < filteredPhotos.length && (
          <div ref={sentinelRef} className="h-10 w-full pointer-events-none" />
        )}

        {/* Load More Button if remaining */}
        {visibleCount < filteredPhotos.length && (
          <div className="text-center pt-4">
            <button
              onClick={() => setVisibleCount((prev) => prev + 48)}
              className="px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-xs font-semibold text-stone-300 hover:text-stone-100 transition shadow-md"
            >
              Load More Photos ({filteredPhotos.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </main>

      {/* Sticky Bottom Selection Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-stone-900/95 backdrop-blur-xl border-t border-stone-800 px-4 sm:px-6 py-3 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold font-mono text-sm shrink-0">
              {selectedIds.size}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-stone-100 flex items-center gap-1.5">
                  <span>{selectedIds.size} Photos Selected</span>
                  {gallery.maxSelections > 0 && (
                    <span className="text-stone-400 font-normal">
                      (Max: {gallery.maxSelections})
                    </span>
                  )}
                </p>
                {/* Auto-save status indicator in bottom bar */}
                <div className="hidden sm:inline-block">
                  {renderAutoSaveBadge()}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-stone-400">
                <span>
                  {gallery.maxSelections > 0
                    ? `${Math.max(0, gallery.maxSelections - selectedIds.size)} photo${Math.max(0, gallery.maxSelections - selectedIds.size) === 1 ? '' : 's'} remaining`
                    : 'Selections automatically saved'}
                </span>
                {clientSession?.recoveryCode && (
                  <>
                    <span>•</span>
                    <button
                      onClick={() => setShowRecoveryModal(true)}
                      className="text-amber-400 hover:underline cursor-pointer"
                    >
                      Recovery PIN: {clientSession.recoveryCode}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5">
            {/* Undo Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-stone-850 hover:bg-stone-800 disabled:opacity-30 border border-stone-750 text-stone-300 hover:text-amber-400 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                title="Undo last selection change (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Undo</span>
              </button>
            )}

            {/* Redo Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-stone-850 hover:bg-stone-800 disabled:opacity-30 border border-stone-750 text-stone-300 hover:text-amber-400 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                title="Redo selection change (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Redo</span>
              </button>
            )}

            {/* Selection History Timeline Button */}
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-300 hover:text-amber-400 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              title="View selection history timeline"
            >
              <History className="w-3.5 h-3.5 text-stone-400" />
              <span className="hidden sm:inline">History</span>
              {historyEntries.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 font-mono">
                  {historyEntries.length}
                </span>
              )}
            </button>

            {/* Select Multiple Button in Bottom Bar */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  lastClickedIndexRef.current = null;
                }}
                className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isBatchMode
                    ? 'bg-amber-400 text-stone-950 border-amber-400 shadow-md ring-2 ring-amber-400/30'
                    : 'bg-stone-850 hover:bg-stone-800 border-stone-750 text-stone-300 hover:text-amber-400'
                }`}
                title="Toggle Select Multiple Mode"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{isBatchMode ? 'Multiple: ON' : 'Select Multiple'}</span>
                <span className="md:hidden">Multiple</span>
              </button>
            )}

            {/* Start Selection Again button */}
            {selectedIds.size > 0 && !isReadOnly && (
              <button
                onClick={() => setShowRestartModal(true)}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-400 hover:text-rose-400 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                title="Clear selected photos and start fresh without losing your session"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Restart</span>
              </button>
            )}

            <button
              onClick={() => setIsViewingSelectedOnly(!isViewingSelectedOnly)}
              className="px-3 sm:px-4 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-200 text-xs font-medium transition cursor-pointer"
            >
              {isViewingSelectedOnly ? 'All Photos' : 'View Selected'}
            </button>

            {/* Copy Share Link button in Bottom Bar */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                hasCopiedShareLink
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-stone-850 hover:bg-stone-800 border-stone-750 text-stone-300 hover:text-amber-400'
              }`}
              title="Copy gallery share link to clipboard"
            >
              {hasCopiedShareLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {/* Download Ready ZIP or Archive ZIP button */}
            {(archiveResult?.downloadUrl || gallery.zipDownloadUrl) ? (
              <a
                href={archiveResult?.downloadUrl || gallery.zipDownloadUrl}
                download={archiveResult?.fileName || `${gallery.customerName.replace(/\s+/g, '_')}_Selections.zip`}
                className="px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                title="Download your single ZIP file containing all selected photos"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download ZIP</span>
                <span className="sm:hidden">ZIP</span>
              </a>
            ) : selectedIds.size > 0 && gallery.status === 'submitted' ? (
              <button
                type="button"
                onClick={handleTriggerCloudArchive}
                disabled={isArchiving}
                className="px-3 sm:px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                title="Archive selected photos into a single ZIP file"
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isArchiving ? 'Archiving...' : 'Archive ZIP'}</span>
                <span className="sm:hidden">ZIP</span>
              </button>
            ) : selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={handleTriggerCloudArchive}
                disabled={isArchiving}
                className="px-3 sm:px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Archive and download selected photos as ZIP"
              >
                <Archive className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Archive ZIP</span>
                <span className="sm:hidden">ZIP</span>
              </button>
            ) : null}

            {!isReadOnly && (
              <button
                onClick={() => setIsSubmitModalOpen(true)}
                disabled={selectedIds.size === 0}
                className="px-4 sm:px-5 py-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:opacity-95 disabled:opacity-40 text-stone-950 font-bold text-xs transition shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Selection</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-2xl flex flex-col justify-between"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Lightbox Header */}
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-stone-850 bg-stone-900/60">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-stone-300">
                {lightboxPhoto.name}
              </span>
              <span className="text-[11px] text-stone-500">
                ({filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id) + 1} of {filteredPhotos.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {gallery.allowDownloads && (
                <button
                  onClick={() => handleDownloadPhoto(lightboxPhoto)}
                  className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 transition"
                  title="Download photo"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-400 transition"
                title="Copy gallery share link"
              >
                {hasCopiedShareLink ? (
                  <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 transition"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lightbox Center Image with Navigation Arrows */}
          <div className="relative flex-1 flex items-center justify-center p-4 select-none">
            {/* Previous Arrow */}
            <button
              onClick={() => {
                const curIdx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
                if (curIdx > 0) setLightboxPhoto(filteredPhotos[curIdx - 1]);
              }}
              disabled={filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id) === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-stone-900/80 border border-stone-800 text-stone-300 hover:text-stone-100 disabled:opacity-20 flex items-center justify-center transition z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Next Arrow */}
            <button
              onClick={() => {
                const curIdx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
                if (curIdx < filteredPhotos.length - 1) setLightboxPhoto(filteredPhotos[curIdx + 1]);
              }}
              disabled={filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id) === filteredPhotos.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-stone-900/80 border border-stone-800 text-stone-300 hover:text-stone-100 disabled:opacity-20 flex items-center justify-center transition z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Large Image with Reliable High-Res URL & Fallback */}
            <img
              src={generateDrivePreviewUrl(lightboxPhoto.driveFileId, lightboxPhoto.previewUrl || lightboxPhoto.thumbnailUrl)}
              alt={lightboxPhoto.name}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== lightboxPhoto.thumbnailUrl && lightboxPhoto.thumbnailUrl) {
                  target.src = lightboxPhoto.thumbnailUrl;
                }
              }}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl transition-opacity duration-200"
            />
          </div>

          {/* Lightbox Bottom Controls */}
          <div className="px-4 py-4 flex items-center justify-between border-t border-stone-850 bg-stone-900/60">
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-stone-400">
              <span>← / → Arrows to navigate</span>
              <span>•</span>
              <span>Space to select</span>
              <span>•</span>
              <span>Esc to close</span>
            </div>

            <div className="ml-auto">
              <button
                onClick={() => togglePhotoSelection(lightboxPhoto.id)}
                disabled={isReadOnly}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition flex items-center gap-2 cursor-pointer ${
                  selectedIds.has(lightboxPhoto.id)
                    ? 'bg-amber-400 text-stone-950 shadow-lg'
                    : 'bg-stone-800 hover:bg-stone-750 text-stone-100 border border-stone-700'
                }`}
              >
                {selectedIds.has(lightboxPhoto.id) ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>✓ Selected</span>
                  </>
                ) : (
                  <span>Select This Photo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Selection Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                <FileCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-serif text-stone-100">Confirm Your Selection</h2>
              <p className="text-xs text-stone-400">
                You selected <strong className="text-amber-400">{selectedIds.size} photos</strong>
                {gallery.maxSelections > 0 && ` out of ${gallery.maxSelections} allowed`}.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-950 border border-stone-850 text-xs text-stone-300 space-y-2">
              <p>Once submitted, your photographer will receive your selection for final editing and album design.</p>
              {!gallery.allowEditing && (
                <p className="text-amber-400/90 font-medium">
                  Note: Editing will be locked once submitted.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-stone-400 mb-1.5 font-medium">
                Notes for Photographer (Optional)
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Any special requests or instructions regarding your selected photos..."
                rows={3}
                className="w-full p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 placeholder:text-stone-600 focus:border-amber-400 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitting(false);
                  setIsSubmitModalOpen(false);
                }}
                className="px-4 py-2.5 text-stone-400 hover:text-stone-200 text-xs font-medium transition cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:opacity-95 disabled:opacity-70 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Selection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Screen Modal */}
      {isSubmittedSuccess && (
        <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-serif text-stone-100">
                Selection Submitted Successfully!
              </h2>
              <p className="text-xs font-semibold text-amber-400">
                {selectedIds.size} Photos Selected
              </p>
              <p className="text-xs text-stone-400 mt-2">
                Your photographer has received your selection. We look forward to creating your beautiful memories!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                onClick={() => {
                  setIsSubmittedSuccess(false);
                  setIsViewingSelectedOnly(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                View Selection
              </button>

              {gallery.allowEditing && (
                <button
                  onClick={handleStartEditing}
                  className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-xl transition shadow-lg cursor-pointer"
                >
                  Edit Selection
                </button>
              )}
            </div>

            {/* Instant ZIP Download / Cloud Function Archive Option in Success Modal */}
            <div className="p-4 rounded-2xl bg-stone-950/90 border border-purple-500/40 text-left space-y-3 mt-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Archive className="w-4 h-4" />
                  </div>
                  <span>Single ZIP Archive</span>
                </span>
                {(archiveResult || gallery.zipDownloadUrl) ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Archive Ready</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300">
                    Instant Cloud Export
                  </span>
                )}
              </div>

              <p className="text-[11px] text-stone-300 leading-relaxed">
                {(archiveResult || gallery.zipDownloadUrl)
                  ? 'Your selected photos have been packaged into a single archive file. Download it directly now.'
                  : `Trigger our cloud archiving process to automatically bundle all ${selectedIds.size} selected photos into a single ZIP download file.`}
              </p>

              {(archiveResult?.downloadUrl || gallery.zipDownloadUrl) ? (
                <div className="space-y-2">
                  <a
                    href={archiveResult?.downloadUrl || gallery.zipDownloadUrl}
                    download={archiveResult?.fileName || `${gallery.customerName.replace(/\s+/g, '_')}_Selections.zip`}
                    className="w-full py-2.5 px-4 bg-linear-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download ZIP Archive {archiveResult?.sizeFormatted ? `(${archiveResult.sizeFormatted})` : ''}</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleTriggerCloudArchive}
                    disabled={isArchiving}
                    className="w-full py-1.5 text-stone-400 hover:text-stone-200 text-[11px] transition text-center cursor-pointer"
                  >
                    Re-generate fresh ZIP archive
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleTriggerCloudArchive}
                  disabled={isArchiving || selectedIds.size === 0}
                  className="w-full py-2.5 px-4 bg-linear-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isArchiving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Packaging ZIP File...</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      <span>Archive & Download ZIP ({selectedIds.size} Photos)</span>
                    </>
                  )}
                </button>
              )}

              {/* Secondary link for custom studio fulfillment */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={handleOpenZipModal}
                  className="text-[11px] text-stone-500 hover:text-purple-300 underline transition cursor-pointer"
                >
                  Need studio print-master delivery or custom RAW files?
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Code Info Modal */}
      {showRecoveryModal && clientSession && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-semibold text-stone-100">
                    Switch Devices Anytime
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Your photo selections are saved automatically
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Recovery Code Box */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center space-y-2">
              <p className="text-xs text-stone-400 uppercase tracking-widest font-mono">
                Your 6-Digit Recovery PIN
              </p>
              <div className="text-3xl font-mono font-bold tracking-[0.3em] text-amber-400 py-1">
                {clientSession.recoveryCode}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(clientSession.recoveryCode);
                  setCopiedRecoveryCode(true);
                  setTimeout(() => setCopiedRecoveryCode(false), 2500);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-xs font-medium text-stone-300 transition cursor-pointer"
              >
                {copiedRecoveryCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">PIN Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-400" />
                    <span>Copy Recovery PIN</span>
                  </>
                )}
              </button>
            </div>

            {/* Explanation Steps */}
            <div className="space-y-2.5 text-xs text-stone-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <p>Open this same gallery link on your phone, tablet, or another browser.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  2
                </span>
                <p>Click <strong className="text-stone-100">Continue Previous Selection</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  3
                </span>
                <p>Enter your 6-digit PIN <strong className="text-amber-400 font-mono">{clientSession.recoveryCode}</strong> to instantly restore all chosen photos.</p>
              </div>
            </div>

            <p className="text-[11px] text-stone-500 bg-stone-950/60 p-3 rounded-xl border border-stone-850">
              No account creation or password needed. Your choices survive browser refresh, tab close, and network drops.
            </p>

            <button
              onClick={() => setShowRecoveryModal(false)}
              className="w-full py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-semibold rounded-xl transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Enter Recovery Code Modal (for continuing on another device) */}
      {showEnterRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-semibold text-stone-100">
                    Continue Previous Selection
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Restore your chosen photos from another device
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEnterRecoveryModal(false);
                  setRecoveryError(null);
                }}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecoverSession} className="space-y-4">
              <div>
                <label className="block text-xs text-stone-400 mb-2 font-medium">
                  Enter 6-Digit Recovery PIN
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={recoveryInput}
                  onChange={(e) => {
                    setRecoveryInput(e.target.value.replace(/[^0-9]/g, ''));
                    setRecoveryError(null);
                  }}
                  autoFocus
                  placeholder="482761"
                  className="w-full text-center text-3xl tracking-[0.4em] py-3 px-4 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-stone-100 font-mono transition placeholder:text-stone-700"
                />
                {recoveryError && (
                  <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5 justify-center">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{recoveryError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEnterRecoveryModal(false);
                    setRecoveryError(null);
                  }}
                  className="px-4 py-2.5 text-stone-400 hover:text-stone-200 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecovering || recoveryInput.length < 6}
                  className="px-5 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:opacity-95 disabled:opacity-40 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {isRecovering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Restore Selections</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Optional Customer Identification Modal (One-time only when enabled by admin) */}
      {showIdentificationModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                <UserCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-serif text-stone-100">
                Welcome to Photo Selection
              </h2>
              <p className="text-xs text-stone-400">
                Please provide your contact details so your photographer knows who is selecting photos for {gallery.customerName}.
              </p>
            </div>

            <form onSubmit={handleSaveCustomerInfo} className="space-y-4">
              {gallery.askCustomerName && (
                <div>
                  <label className="block text-xs text-stone-400 mb-1.5 font-medium">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={clientNameInput}
                    onChange={(e) => setClientNameInput(e.target.value)}
                    placeholder="e.g. Rahim or Ayesha"
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600"
                  />
                </div>
              )}

              {gallery.askCustomerPhone && (
                <div>
                  <label className="block text-xs text-stone-400 mb-1.5 font-medium">
                    Your Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={clientPhoneInput}
                    onChange={(e) => setClientPhoneInput(e.target.value)}
                    placeholder="e.g. +880 1712-345678"
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600"
                  />
                </div>
              )}

              <p className="text-[11px] text-stone-500 bg-stone-950/60 p-2.5 rounded-xl border border-stone-850">
                No password or account registration required. This information is only used to identify your session for your photographer.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIdentificationModal(false)}
                  className="px-4 py-2.5 text-stone-400 hover:text-stone-200 text-xs font-medium transition cursor-pointer"
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:opacity-95 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <span>Start Selecting Photos</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restart Selections Confirmation Modal */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-md">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-serif font-semibold text-stone-100">
                Start Selection Again?
              </h3>
              <p className="text-xs text-stone-400 mt-1.5">
                This will clear your {selectedIds.size} selected photos. Your session and gallery will remain active, and you can re-pick your favorites.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRestarting(false);
                  setShowRestartModal(false);
                }}
                className="px-4 py-2 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-300 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                Keep Current
              </button>
              <button
                type="button"
                onClick={handleRestartSelections}
                disabled={isRestarting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-70 text-white text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {isRestarting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <span>Clear Selections</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Resolution ZIP Request Modal */}
      {showZipModal && gallery && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-md">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-semibold text-stone-100">
                    Request High-Resolution ZIP
                  </h3>
                  <p className="text-xs text-stone-400">
                    Receive uncompressed studio-quality files of your chosen photos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowZipModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Count Chip */}
            <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between text-xs">
              <span className="text-stone-400">Target Selection</span>
              <span className="font-semibold text-amber-400 font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{selectedIds.size} Photos Selected</span>
              </span>
            </div>

            {/* Existing ZIP Status if already requested */}
            {gallery.zipRequested && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                  gallery.zipRequestStatus === 'ready' && gallery.zipDownloadUrl
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-purple-950/30 border-purple-800/40 text-purple-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <Package className="w-4 h-4" />
                  <span>
                    {gallery.zipRequestStatus === 'ready' && gallery.zipDownloadUrl
                      ? 'High-Resolution ZIP Archive is Ready!'
                      : 'High-Res ZIP Request Pending Fulfillment'}
                  </span>
                </div>
                <p className="text-stone-300 text-[11px] leading-relaxed">
                  {gallery.zipRequestStatus === 'ready' && gallery.zipDownloadUrl
                    ? 'Your photographer has prepared and uploaded your high-resolution archive package. Click below to download.'
                    : `Requested on ${gallery.zipRequestedAt ? new Date(gallery.zipRequestedAt).toLocaleDateString() : 'recently'} for ${gallery.zipRequestedCount || selectedIds.size} photos. The photographer will review and fulfill your archive.`}
                </p>

                {gallery.zipDownloadUrl && (
                  <div className="pt-1.5">
                    <a
                      href={gallery.zipDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs transition shadow-lg cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download High-Res ZIP Archive</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Request Form */}
            <form onSubmit={handleRequestZipSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Notification Email Address <span className="text-amber-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={zipEmailInput}
                  onChange={(e) => setZipEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-purple-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  We'll send the download link directly to this email once your photographer packages the ZIP.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Phone / WhatsApp (Optional)
                </label>
                <input
                  type="tel"
                  value={zipPhoneInput}
                  onChange={(e) => setZipPhoneInput(e.target.value)}
                  placeholder="+88017XXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-purple-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Special Notes or Instructions for Photographer (Optional)
                </label>
                <textarea
                  rows={3}
                  value={zipNotesInput}
                  onChange={(e) => setZipNotesInput(e.target.value)}
                  placeholder="e.g. Please include color-corrected high-res files, print sizing preferences, or specific formats..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-purple-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-850">
                <button
                  type="button"
                  onClick={() => setShowZipModal(false)}
                  className="px-4 py-2.5 text-stone-400 hover:text-stone-200 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingZip || selectedIds.size === 0}
                  className="px-5 py-2.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:opacity-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {isSubmittingZip ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      <span>
                        {gallery.zipRequested ? 'Update ZIP Request' : 'Submit High-Res Request'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Auto-Saving State Indicator */}
      {autoSaveStatus === 'saving' && (
        <LoadingOverlay
          variant="floating"
          statusText="Saving..."
          subtext="Syncing photo selections"
        />
      )}

      {/* Submitting Selection Modal Overlay */}
      {isSubmitting && (
        <LoadingOverlay
          variant="overlay"
          statusText="Submitting selection..."
          subtext="Transmitting your curated photo list to the photographer"
        />
      )}

      {/* Clearing Selections Modal Overlay */}
      {isRestarting && (
        <LoadingOverlay
          variant="overlay"
          statusText="Clearing selections..."
          subtext="Resetting photo choices in draft status"
        />
      )}

      {/* Submitting ZIP Request Overlay */}
      {isSubmittingZip && (
        <LoadingOverlay
          variant="overlay"
          statusText="Submitting ZIP request..."
          subtext="Notifying your studio team to package your high-res files"
        />
      )}

      {/* Restoring Selection History Overlay */}
      {isRestoringHistory && (
        <LoadingOverlay
          variant="overlay"
          statusText="Restoring selection state..."
          subtext="Synchronizing choices with Firestore timeline"
        />
      )}

      {/* Selection History Timeline Modal */}
      {showHistoryModal && gallery && (
        <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-semibold text-stone-100 flex items-center gap-2">
                    <span>Selection History & Timeline</span>
                  </h3>
                  <p className="text-xs text-stone-400">
                    Track past selection states, undo changes, or restore any snapshot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Undo / Redo controls in Modal */}
            {!isReadOnly && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-950 border border-stone-850 text-xs shrink-0">
                <div className="text-stone-400 flex items-center gap-2">
                  <span>Current:</span>
                  <span className="font-semibold text-amber-400 font-mono">
                    {selectedIds.size} photos selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="px-2.5 py-1.5 rounded-xl bg-stone-850 hover:bg-stone-800 disabled:opacity-35 border border-stone-750 text-stone-300 hover:text-amber-400 font-medium transition flex items-center gap-1 cursor-pointer"
                    title="Undo last change (Ctrl+Z)"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="px-2.5 py-1.5 rounded-xl bg-stone-850 hover:bg-stone-800 disabled:opacity-35 border border-stone-750 text-stone-300 hover:text-amber-400 font-medium transition flex items-center gap-1 cursor-pointer"
                    title="Redo change (Ctrl+Y)"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                    <span>Redo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Timeline List */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-2.5">
              {historyEntries.length === 0 ? (
                <div className="p-8 text-center bg-stone-950/60 border border-stone-850 rounded-2xl text-stone-500 space-y-2">
                  <History className="w-8 h-8 text-stone-600 mx-auto" />
                  <p className="text-xs">No selection history recorded yet.</p>
                  <p className="text-[11px] text-stone-600">
                    As you select or deselect photos, a complete audit history will be tracked here.
                  </p>
                </div>
              ) : (
                historyEntries.map((entry, idx) => {
                  const isCurrent =
                    entry.selectedCount === selectedIds.size &&
                    entry.selectedPhotoIds.every((id) => selectedIds.has(id));

                  const actionBadgeColor = {
                    select: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    deselect: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                    clear: 'bg-stone-800 text-stone-400 border-stone-700',
                    restore_snapshot: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                    undo: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                    redo: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                    batch_select: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    initial: 'bg-stone-800 text-stone-400 border-stone-700',
                  }[entry.action] || 'bg-stone-850 text-stone-400 border-stone-700';

                  return (
                    <div
                      key={entry.id || idx}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 text-xs ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-stone-950/70 border-stone-850 hover:border-stone-750'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border font-mono ${actionBadgeColor}`}
                          >
                            {entry.action.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-stone-400 text-[11px]">
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-stone-950">
                              Active State
                            </span>
                          )}
                        </div>
                        <p className="text-stone-200 font-medium text-xs truncate">
                          {entry.description || `State change to ${entry.selectedCount} photos`}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {entry.selectedCount} photo{entry.selectedCount === 1 ? '' : 's'} in snapshot
                        </p>
                      </div>

                      {!isReadOnly && !isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRestoreHistoryEntry(entry)}
                          className="px-3 py-1.5 rounded-xl bg-stone-850 hover:bg-amber-500 hover:text-stone-950 border border-stone-750 text-stone-300 font-semibold text-xs transition shrink-0 cursor-pointer shadow-xs"
                          title="Restore selections to this exact state"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-stone-850 flex items-center justify-between text-[11px] text-stone-500 shrink-0">
              <span>Keyboard shortcuts: Ctrl+Z (Undo), Ctrl+Y (Redo)</span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-stone-850 hover:bg-stone-800 text-stone-300 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Function ZIP Archive Progress & Download Modal */}
      {showArchiveModal && gallery && (
        <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 text-center">
            {/* Icon Header */}
            <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto shadow-lg">
              {archiveResult ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              ) : isArchiving ? (
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              ) : (
                <Archive className="w-8 h-8 text-purple-400" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-serif font-semibold text-stone-100">
                {archiveResult ? 'ZIP Archive Ready!' : 'Packaging Photo Archive'}
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                {archiveResult
                  ? `Successfully bundled ${archiveResult.totalPhotos} photos into a single ZIP file.`
                  : 'Automated cloud worker is fetching and compressing your selected photos.'}
              </p>
            </div>

            {/* Progress Bar (while archiving) */}
            {isArchiving && archiveProgress && (
              <div className="space-y-2.5 p-4 rounded-2xl bg-stone-950 border border-stone-800 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-300 font-medium truncate max-w-[220px]">
                    {archiveProgress.statusText}
                  </span>
                  <span className="text-amber-400 font-mono font-bold">
                    {archiveProgress.percent}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-850 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-purple-500 via-indigo-500 to-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${archiveProgress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono">
                  <span>Photo {archiveProgress.current} of {archiveProgress.total}</span>
                  <span>ZIP Deflate Format</span>
                </div>
              </div>
            )}

            {/* Download Link Card (when completed) */}
            {archiveResult && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-stone-950 border border-emerald-500/30 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-200">Archive File</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {archiveResult.sizeFormatted}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-stone-400 truncate">
                    {archiveResult.fileName}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    Includes {archiveResult.totalPhotos} selected photos + ARCHIVE_MANIFEST.txt
                  </p>
                </div>

                <a
                  href={archiveResult.downloadUrl}
                  download={archiveResult.fileName}
                  className="w-full py-3 px-5 bg-linear-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-stone-950 font-bold text-sm rounded-xl transition shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download ZIP Archive ({archiveResult.sizeFormatted})</span>
                </a>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="w-full py-2 bg-stone-850 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
