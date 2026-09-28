import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Heart,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Info,
  Calendar,
  Sparkles,
  Lock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Download,
  Loader2,
  Check,
} from 'lucide-react';
import { DrivePhoto } from '../types';
import { downloadSinglePhoto } from '../services/zipDownloader';

interface PhotoLightboxModalProps {
  photos: DrivePhoto[];
  initialIndex: number;
  selectedIds: Set<string>;
  selectionLimit?: number;
  isLimitReached?: boolean;
  onToggleSelect: (photoId: string) => void;
  onClose: () => void;
  onDownloadPhoto?: (photo: DrivePhoto) => void | Promise<void>;
  onPayForPhoto?: (photo: DrivePhoto) => void;
  isApprovedForDownload?: (photoId: string) => boolean;
  defaultPrice?: number;
  accessToken?: string | null;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photos,
  initialIndex,
  selectedIds,
  selectionLimit,
  isLimitReached = false,
  onToggleSelect,
  onClose,
  onDownloadPhoto,
  onPayForPhoto,
  isApprovedForDownload,
  defaultPrice = 100,
  accessToken,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDetails, setShowDetails] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Zoom & Pan state
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // References
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const posStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch gesture tracking for pinch-to-zoom & pan
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const lastTouchPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const currentPhoto = photos[currentIndex];
  if (!currentPhoto) return null;

  const isSelected = selectedIds.has(currentPhoto.id);

  // Reset zoom & pan when switching photo
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const goNext = () => {
    resetZoom();
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const goPrev = () => {
    resetZoom();
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  // Fullscreen support
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (modalContainerRef.current?.requestFullscreen) {
          await modalContainerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      if (onDownloadPhoto) {
        await onDownloadPhoto(currentPhoto);
      } else {
        await downloadSinglePhoto(currentPhoto, accessToken);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('Download photo error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (scale > 1) {
          resetZoom();
        } else {
          onClose();
        }
      }
      if (e.key === 'ArrowRight' && scale === 1) goNext();
      if (e.key === 'ArrowLeft' && scale === 1) goPrev();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-' || e.key === '_') handleZoomOut();
      if (e.key === '0') resetZoom();
      if (e.key === ' ' || e.key === 'f') {
        e.preventDefault();
        onToggleSelect(currentPhoto.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPhoto.id, onClose, scale]);

  // Image source resolution
  const imageSrc =
    currentPhoto.webViewLink ||
    currentPhoto.thumbnailLink ||
    `https://drive.google.com/uc?id=${currentPhoto.id}`;

  // Zoom helpers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(4, Number((prev + 0.5).toFixed(1))));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.3 : -0.3;
    setScale((prev) => {
      const next = Math.min(4, Math.max(1, Number((prev + delta).toFixed(2))));
      if (next === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  // Mouse drag to pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const maxPanX = (window.innerWidth * (scale - 1)) / 2;
    const maxPanY = (window.innerHeight * (scale - 1)) / 2;

    setPosition({
      x: Math.min(Math.max(posStartRef.current.x + dx, -maxPanX), maxPanX),
      y: Math.min(Math.max(posStartRef.current.y + dy, -maxPanY), maxPanY),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click / Double tap to toggle zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (scale > 1.2) {
      resetZoom();
    } else {
      const rect = imageContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const clickX = e.clientX - rect.left - rect.width / 2;
        const clickY = e.clientY - rect.top - rect.height / 2;
        setPosition({ x: -clickX * 1.2, y: -clickY * 1.2 });
      }
      setScale(2.5);
    }
  };

  // Multi-touch gestures: Pinch-to-zoom and Touch-pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2-finger pinch initiated
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      lastTouchPosRef.current = null;
    } else if (e.touches.length === 1) {
      // Check for double-tap
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        // Double-tap detected
        if (scale > 1.2) {
          resetZoom();
        } else {
          setScale(2.5);
          setPosition({ x: 0, y: 0 });
        }
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      // 1-finger drag start
      lastTouchPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      posStartRef.current = { ...position };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      // Pinching
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const nextScale = Math.min(4, Math.max(1, Number((pinchStartScaleRef.current * ratio).toFixed(2))));
      setScale(nextScale);
      if (nextScale <= 1.05) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && scale > 1 && lastTouchPosRef.current) {
      // Panning while zoomed
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchPosRef.current.x;
      const dy = touch.clientY - lastTouchPosRef.current.y;

      const maxPanX = (window.innerWidth * (scale - 1)) / 1.8;
      const maxPanY = (window.innerHeight * (scale - 1)) / 1.8;

      setPosition((prev) => ({
        x: Math.min(Math.max(prev.x + dx, -maxPanX), maxPanX),
        y: Math.min(Math.max(prev.y + dy, -maxPanY), maxPanY),
      }));

      lastTouchPosRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }
    if (e.touches.length === 0) {
      lastTouchPosRef.current = null;
      if (scale < 1.05) {
        resetZoom();
      }
    }
  };

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col backdrop-blur-md select-none touch-none"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-3 sm:px-6 z-30 bg-linear-to-b from-black/90 to-transparent shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-xs tracking-wider uppercase text-stone-400 font-mono shrink-0">
            {currentIndex + 1} / {photos.length}
          </span>
          <span className="text-stone-300 text-xs sm:text-sm font-medium truncate max-w-[140px] sm:max-w-md">
            {currentPhoto.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Native Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {/* Toggle details info */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`p-2 rounded-full transition ${
              showDetails ? 'bg-white/20 text-white' : 'text-stone-400 hover:text-white hover:bg-white/10'
            }`}
            title="Photo Info"
          >
            <Info className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Individual Photo Download or Paid Unlock Trigger */}
          {(() => {
            const isPaid = Boolean(currentPhoto.isPaid);
            const isApproved = isApprovedForDownload ? isApprovedForDownload(currentPhoto.id) : false;
            const price = currentPhoto.price || defaultPrice;

            if (isPaid && !isApproved) {
              return (
                <button
                  onClick={() => onPayForPhoto?.(currentPhoto)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 transition shadow-md"
                  title={`Paid Photo: Pay ৳${price} to unlock download`}
                >
                  <Lock className="w-3.5 h-3.5 text-stone-950" />
                  <span>পেমেন্ট করুন (৳{price})</span>
                </button>
              );
            }

            return (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  downloadSuccess
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/10 text-stone-200 hover:text-white hover:bg-white/20'
                }`}
                title={`Download ${currentPhoto.name}`}
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-amber-400" />
                ) : downloadSuccess ? (
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 stroke-[3]" />
                ) : (
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                )}
                <span className="hidden sm:inline">
                  {isDownloading ? 'Saving...' : downloadSuccess ? 'Saved' : isPaid ? 'Approved Download' : 'Free Download'}
                </span>
              </button>
            );
          })()}

          {/* Favourite / Select Button in top bar */}
          <button
            onClick={() => onToggleSelect(currentPhoto.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              isSelected
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-950/40'
                : isLimitReached
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isLimitReached && !isSelected ? (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Heart
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition ${
                  isSelected ? 'fill-white stroke-white' : 'stroke-white'
                }`}
              />
            )}
            <span className="hidden sm:inline">
              {isSelected
                ? 'Selected'
                : isLimitReached
                ? `Limit Reached (${selectionLimit})`
                : 'Favorite'}
            </span>
          </button>

          {/* Close Lightbox */}
          <button
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition ml-1"
            title="Close Lightbox (Esc)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Main View Area with Pinch-to-Zoom */}
      <div
        ref={imageContainerRef}
        className={`relative flex-1 flex items-center justify-center p-1 sm:p-4 overflow-hidden ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous Button (hidden when zoomed in to prevent conflict with panning) */}
        {scale === 1 && (
          <button
            onClick={goPrev}
            className="absolute left-2 sm:left-4 z-20 p-2 sm:p-3 rounded-full bg-black/50 hover:bg-white/20 text-white backdrop-blur-xs transition group"
            title="Previous Photo (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 group-hover:-translate-x-0.5 transition" />
          </button>
        )}

        {/* The Zoomable Image Container */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-75 ease-out select-none will-change-transform"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          onDoubleClick={handleDoubleClick}
        >
          <img
            key={currentPhoto.id}
            src={imageSrc}
            alt={currentPhoto.name}
            className="max-h-[80vh] max-w-[94vw] object-contain rounded-lg shadow-2xl pointer-events-none"
            loading="eager"
            draggable={false}
          />

          {/* Floating Heart Indicator Overlay on selected photo */}
          {isSelected && (
            <div className="absolute top-4 right-4 bg-rose-600/90 text-white p-2.5 rounded-full shadow-lg backdrop-blur-xs animate-bounce pointer-events-none">
              <Heart className="w-5 h-5 fill-white" />
            </div>
          )}
        </div>

        {/* Next Button (hidden when zoomed in) */}
        {scale === 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 sm:right-4 z-20 p-2 sm:p-3 rounded-full bg-black/50 hover:bg-white/20 text-white backdrop-blur-xs transition group"
            title="Next Photo (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:translate-x-0.5 transition" />
          </button>
        )}

        {/* Floating Interactive Zoom Controls Bar */}
        <div className="absolute bottom-4 z-30 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-black/75 border border-stone-800 text-stone-200 backdrop-blur-md shadow-2xl">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="p-1.5 rounded-full hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition text-stone-300 hover:text-white"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={resetZoom}
            className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold hover:bg-white/10 transition text-amber-300"
            title="Click to reset zoom (100%)"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="p-1.5 rounded-full hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition text-stone-300 hover:text-white"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {scale > 1 && (
            <>
              <div className="w-px h-4 bg-stone-700 mx-0.5" />
              <button
                onClick={resetZoom}
                className="p-1.5 rounded-full hover:bg-white/15 transition text-stone-300 hover:text-white"
                title="Reset Zoom (0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <div className="hidden sm:flex items-center text-[10px] text-stone-400 pl-1">
            <span>Pinch / Double-tap to zoom</span>
          </div>
        </div>
      </div>

      {/* Optional Metadata Drawer */}
      {showDetails && (
        <div className="bg-stone-900/95 border-t border-stone-800 text-stone-300 px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-4 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <span><strong>Filename:</strong> {currentPhoto.name}</span>
            {currentPhoto.size && (
              <span>
                <strong>Size:</strong> {(parseInt(currentPhoto.size, 10) / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
            {currentPhoto.createdTime && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(currentPhoto.createdTime).toLocaleDateString()}
              </span>
            )}
          </div>
          <span className="text-stone-500">Press Spacebar or Heart icon to select</span>
        </div>
      )}

      {/* Bottom Filmstrip Thumbnails Preview for fast switching on mobile/desktop */}
      <div className="px-4 py-2.5 bg-black/80 border-t border-stone-900 flex items-center gap-2 overflow-x-auto no-scrollbar justify-center shrink-0">
        {photos.map((p, idx) => {
          const isCurr = idx === currentIndex;
          const isFaved = selectedIds.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => {
                resetZoom();
                setCurrentIndex(idx);
              }}
              className={`relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden border-2 transition ${
                isCurr
                  ? 'border-amber-400 scale-105 opacity-100 shadow-md ring-1 ring-amber-400/50'
                  : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <img
                src={p.thumbnailLink || p.webViewLink}
                alt=""
                className="w-full h-full object-cover"
              />
              {isFaved && (
                <div className="absolute inset-0 bg-rose-500/30 flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 fill-rose-500 stroke-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
