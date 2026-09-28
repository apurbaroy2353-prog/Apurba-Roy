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
} from 'lucide-react';
import {
  CustomerGallery,
  CustomerGalleryPhoto,
  CustomerPhotoSelection,
  ClientGallerySession,
  AutoSaveStatus,
} from '../types';
import {
  verifyPin,
  updateCustomerSelections,
  getCustomerGalleryByToken,
} from '../services/customerGalleryService';
import {
  getOrCreateClientSession,
  getLocalSession,
  recoverSessionByCode,
  saveSelectionAction,
  processOfflineQueue,
  startSelectionAgain,
  updateSessionCustomerInfo,
} from '../services/clientSessionService';

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
  const [visibleCount, setVisibleCount] = useState(48); // Progressive lazy loading

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);

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

  // Fetch gallery by token and hydrate or initialize persistent client session
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

              // Load or create persistent client session
              try {
                const sess = await getOrCreateClientSession(token, g);
                if (isMounted) {
                  setClientSession(sess);
                  if (sess.selectedPhotoIds && sess.selectedPhotoIds.length > 0) {
                    setSelectedIds(new Set(sess.selectedPhotoIds));
                  } else if (g.selectedPhotoIds && g.selectedPhotoIds.length > 0) {
                    setSelectedIds(new Set(g.selectedPhotoIds));
                  }
                  if (sess.status === 'submitted') {
                    setIsSubmittedSuccess(true);
                  }
                  // Check if customer identification prompt was configured and not yet entered
                  if ((g.askCustomerName || g.askCustomerPhone) && !sess.customerName && !sess.customerPhone) {
                    setShowIdentificationModal(true);
                  }
                }
              } catch (sessErr) {
                console.warn('Session init fallback:', sessErr);
                setSelectedIds(new Set(g.selectedPhotoIds || []));
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
        getOrCreateClientSession(token, initialGallery)
          .then((sess) => {
            if (isMounted) {
              setClientSession(sess);
              if (sess.selectedPhotoIds && sess.selectedPhotoIds.length > 0) {
                setSelectedIds(new Set(sess.selectedPhotoIds));
              } else if (initialGallery.selectedPhotoIds) {
                setSelectedIds(new Set(initialGallery.selectedPhotoIds));
              }
              if (sess.status === 'submitted') {
                setIsSubmittedSuccess(true);
              }
              if (
                (initialGallery.askCustomerName || initialGallery.askCustomerPhone) &&
                !sess.customerName &&
                !sess.customerPhone
              ) {
                setShowIdentificationModal(true);
              }
            }
          })
          .catch(() => {
            setSelectedIds(new Set(initialGallery.selectedPhotoIds || []));
          });
        setLoading(false);
      }
    };

    loadGallery();
    return () => {
      isMounted = false;
    };
  }, [token, initialGallery, isAdminPreview]);

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

  // Filtered Photos
  const filteredPhotos = useMemo(() => {
    let result = allPhotos;

    // Search query filter (matches filename or number, e.g. '1023' or 'IMG_1023')
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
      );
    }

    // Filter pills
    if (activeFilter === 'selected' || isViewingSelectedOnly) {
      result = result.filter((p) => selectedIds.has(p.id));
    } else if (activeFilter === 'unselected') {
      result = result.filter((p) => !selectedIds.has(p.id));
    }

    return result;
  }, [allPhotos, searchQuery, activeFilter, isViewingSelectedOnly, selectedIds]);

  // Visible sliced photos for infinite scrolling
  const visiblePhotos = useMemo(() => {
    return filteredPhotos.slice(0, visibleCount);
  }, [filteredPhotos, visibleCount]);

  // Scroll event for infinite load
  useEffect(() => {
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

  // Toggle Photo Selection with Instant UI update and auto-saving to persistent client session
  const togglePhotoSelection = useCallback(
    async (photoId: string) => {
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

      // 1. Update UI immediately
      const nextSet = new Set(selectedIds);
      if (isAlreadySelected) {
        nextSet.delete(photoId);
      } else {
        nextSet.add(photoId);
      }

      const nextArray = Array.from(nextSet);
      setSelectedIds(nextSet);

      // 2. Immediate auto-save status indication
      const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setAutoSaveStatus(onlineNow ? 'saving' : 'offline');

      // 3. Persist via persistent client session (Firestore + IndexedDB offline queue)
      if (clientSession) {
        try {
          const res = await saveSelectionAction(clientSession, nextArray, gallery, false);
          setClientSession(res.updatedSession);
          setAutoSaveStatus(res.status);
          if (res.status === 'saved') {
            setTimeout(() => setAutoSaveStatus('saved'), 1200);
          }
        } catch (err) {
          console.warn('Auto-save error:', err);
          setAutoSaveStatus('offline');
        }
      } else {
        // Fallback direct persistence
        try {
          const res = await updateCustomerSelections(token, nextArray, false);
          if (res.gallery) {
            setGallery(res.gallery);
          }
          setAutoSaveStatus('saved');
        } catch (err) {
          console.warn('Direct update error:', err);
          setAutoSaveStatus('offline');
        }
      }
    },
    [gallery, isReadOnly, selectedIds, token, clientSession]
  );

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

  // Start Selection Again (clears chosen photos safely without destroying session or gallery)
  const handleRestartSelections = async () => {
    if (!clientSession || !gallery) return;
    setIsRestarting(true);
    try {
      const res = await startSelectionAgain(clientSession, gallery);
      setClientSession(res.updatedSession);
      setSelectedIds(new Set());
      setShowRestartModal(false);
      setSelectionNotice('Selections reset. You can begin picking your photos again.');
      setTimeout(() => setSelectionNotice(null), 3500);
    } catch (err) {
      console.error('Error restarting selections:', err);
    } finally {
      setIsRestarting(false);
    }
  };

  // Edit Selection after submission (re-opens editor if admin enabled allowEditing)
  const handleStartEditing = () => {
    setIsSubmittedSuccess(false);
    setIsEditMode(true);
    if (clientSession) {
      setClientSession({ ...clientSession, status: 'editing' });
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

  // Submit Final Selection - all selections are already saved, this finalizes status
  const handleFinalSubmit = async () => {
    if (!gallery) return;
    setIsSubmitting(true);
    try {
      const photoIdsArray = Array.from(selectedIds);

      // Finalize session status
      if (clientSession) {
        await saveSelectionAction(clientSession, photoIdsArray, gallery, true);
      }

      const res = await updateCustomerSelections(
        token,
        photoIdsArray,
        true,
        customerNotes
      );

      if (res.success && res.gallery) {
        setGallery(res.gallery);
        setIsSubmittedSuccess(true);
        setIsSubmitModalOpen(false);
        setIsViewingSelectedOnly(false);
      } else {
        alert(res.error || 'Failed to submit selection. Please try again.');
      }
    } catch (err: any) {
      alert('Error submitting selection: ' + (err.message || 'Please check your connection'));
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
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-stone-200">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-serif font-bold text-2xl shadow-xl animate-pulse">
          RC
        </div>
        <p className="mt-4 text-xs font-mono text-stone-400 tracking-widest uppercase">
          Loading Customer Gallery...
        </p>
      </div>
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
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Your photo selection has already been submitted. The gallery is now in read-only mode.
              </span>
            </div>
            <button
              onClick={() => setIsViewingSelectedOnly(true)}
              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-medium transition shrink-0 ml-3"
            >
              View Selection ({selectedIds.size})
            </button>
          </div>
        )}

        {/* Search Bar & Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-stone-900/60 border border-stone-850 p-3 sm:p-4 rounded-2xl">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search photo number or filename (e.g. IMG_1023, 1023)"
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => {
                setActiveFilter('all');
                setIsViewingSelectedOnly(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                activeFilter === 'all' && !isViewingSelectedOnly
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-md'
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              All Photos ({allPhotos.length})
            </button>

            <button
              onClick={() => {
                setActiveFilter('selected');
                setIsViewingSelectedOnly(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'selected' || isViewingSelectedOnly
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-md'
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Selected ({selectedIds.size})</span>
            </button>

            <button
              onClick={() => {
                setActiveFilter('unselected');
                setIsViewingSelectedOnly(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                activeFilter === 'unselected'
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-md'
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              Unselected ({allPhotos.length - selectedIds.size})
            </button>
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

        {/* Photo Grid */}
        {filteredPhotos.length === 0 ? (
          <div className="py-20 text-center text-stone-400">
            <p className="text-sm">No photos found matching your search or filter.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
                setIsViewingSelectedOnly(false);
              }}
              className="mt-3 px-4 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-300 hover:text-stone-100 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {visiblePhotos.map((photo, index) => {
              const isSelected = selectedIds.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`group relative rounded-2xl overflow-hidden bg-stone-900 border transition-all duration-200 flex flex-col ${
                    isSelected
                      ? 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50'
                      : 'border-stone-850 hover:border-stone-700'
                  }`}
                >
                  {/* Image Container with Lightbox Click */}
                  <div
                    onClick={() => setLightboxPhoto(photo)}
                    className="relative aspect-3/4 sm:aspect-square bg-stone-950 overflow-hidden cursor-pointer"
                  >
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-stone-950/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Selected Badge Indicator (Top Right) */}
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center shadow-lg font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}

                    {/* Preview Button on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="px-3 py-1.5 rounded-full bg-stone-900/90 text-stone-200 text-[11px] font-medium backdrop-blur-md flex items-center gap-1.5 shadow-xl">
                        <Eye className="w-3 h-3 text-amber-400" />
                        <span>Preview</span>
                      </span>
                    </div>

                    {/* Photo Number Pill (Top Left) */}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-950/70 text-[10px] font-mono text-stone-300 backdrop-blur-xs">
                      #{index + 1}
                    </span>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePhotoSelection(photo.id);
                      }}
                      disabled={isReadOnly}
                      className={`w-full py-1.5 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-stone-950 shadow-sm hover:bg-amber-300'
                          : 'bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-800'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Selected</span>
                        </>
                      ) : (
                        <span>Select</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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

          <div className="flex items-center justify-end gap-2 sm:gap-3">
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

            {/* Large Image */}
            <img
              src={lightboxPhoto.previewUrl || lightboxPhoto.thumbnailUrl}
              alt={lightboxPhoto.name}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
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
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2.5 text-stone-400 hover:text-stone-200 text-xs font-medium transition cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:opacity-95 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Selection'}</span>
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
                onClick={() => setShowRestartModal(false)}
                className="px-4 py-2 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-300 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                Keep Current
              </button>
              <button
                type="button"
                onClick={handleRestartSelections}
                disabled={isRestarting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {isRestarting ? 'Clearing...' : 'Clear Selections'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
