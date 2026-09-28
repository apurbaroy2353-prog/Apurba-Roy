import React from 'react';
import {
  X,
  Heart,
  Send,
  Trash2,
  Maximize2,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Camera,
  AlertCircle,
  Download,
  CreditCard,
} from 'lucide-react';
import { Album, DrivePhoto } from '../types';

interface SelectionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album;
  selectedPhotos: DrivePhoto[];
  onRemovePhoto: (photoId: string) => void;
  onPhotoClick: (photoId: string) => void;
  onProceedToSubmit: () => void;
  onDownloadPhoto?: (photo: DrivePhoto) => void;
  onPayForPhotos?: (photos: DrivePhoto[]) => void;
  isPhotoApproved?: (photoId: string) => boolean;
  hasLimit?: boolean;
  selectionLimit?: number;
}

export const SelectionSummaryModal: React.FC<SelectionSummaryModalProps> = ({
  isOpen,
  onClose,
  album,
  selectedPhotos,
  onRemovePhoto,
  onPhotoClick,
  onProceedToSubmit,
  onDownloadPhoto,
  onPayForPhotos,
  isPhotoApproved,
  hasLimit = false,
  selectionLimit = 0,
}) => {
  if (!isOpen) return null;

  const count = selectedPhotos.length;
  const isLimitReached = hasLimit && count >= selectionLimit;
  const remaining = hasLimit ? Math.max(0, selectionLimit - count) : 0;

  // Unapproved paid photos in selection
  const unapprovedPaidPhotos = selectedPhotos.filter(
    (p) => p.isPaid && (!isPhotoApproved || !isPhotoApproved(p.id))
  );
  const unapprovedPaidTotal = unapprovedPaidPhotos.reduce(
    (sum, p) => sum + (p.price || album.defaultPhotoPrice || 100),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-stone-800 bg-stone-950/70 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-medium text-stone-100">
                  Selection Summary
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {count} {count === 1 ? 'Photo' : 'Photos'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Review your chosen photos for <span className="text-stone-200">{album.coupleNames}</span> before final submission
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition"
            title="Close summary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Limit Info & Status Banner (if selection cap is configured) */}
        {hasLimit && (
          <div className="px-5 sm:px-7 py-3 bg-stone-950/90 border-b border-stone-850 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-stone-300">
                Package Selection Cap:{' '}
                <strong className="text-amber-300 font-mono">{count} / {selectionLimit}</strong> photos chosen
              </span>
            </div>

            <div className="flex items-center gap-3">
              {isLimitReached ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Maximum limit reached</span>
                </span>
              ) : (
                <span className="text-stone-400">
                  You can still select <strong className="text-stone-200">{remaining}</strong> more photo{remaining === 1 ? '' : 's'}
                </span>
              )}

              {/* Progress bar */}
              <div className="w-24 h-2 bg-stone-800 rounded-full overflow-hidden border border-stone-750">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isLimitReached ? 'bg-amber-400' : 'bg-linear-to-r from-rose-500 to-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, (count / selectionLimit) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Selected Photos Grid Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {count === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-stone-800/80 text-stone-500 mx-auto flex items-center justify-center">
                <Heart className="w-7 h-7 stroke-1" />
              </div>
              <h4 className="font-serif text-lg text-stone-300">No photos selected yet</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Tap the heart icon on any photo in the gallery to select it for your wedding album proofing.
              </p>
              <button
                onClick={onClose}
                className="mt-3 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Gallery</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {selectedPhotos.map((photo, idx) => {
                const imgUrl = photo.thumbnailLink || photo.webViewLink;

                return (
                  <div
                    key={photo.id}
                    className="group relative aspect-4/5 rounded-2xl overflow-hidden bg-stone-950 border border-stone-800 hover:border-amber-500/60 transition-all duration-300 shadow-md"
                  >
                    {/* Thumbnail Image */}
                    <img
                      src={imgUrl}
                      alt={photo.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                    {/* Number Badge & Paid Indicator */}
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-black/70 backdrop-blur-xs text-[11px] font-mono text-stone-200 flex items-center justify-center font-bold border border-white/20">
                        {idx + 1}
                      </div>
                      {photo.isPaid ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-stone-950 text-[9px] font-mono font-bold shadow-xs">
                          ৳{photo.price || album.defaultPhotoPrice || 100}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-stone-950 text-[9px] font-mono font-bold shadow-xs">
                          FREE
                        </span>
                      )}
                    </div>

                    {/* Quick Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePhoto(photo.id);
                      }}
                      className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-black/60 hover:bg-rose-600 text-stone-300 hover:text-white backdrop-blur-xs transition shadow-md group/btn"
                      title="Remove from selection"
                    >
                      <Trash2 className="w-3.5 h-3.5 transition group-hover/btn:scale-110" />
                    </button>

                    {/* Quick Zoom / Lightbox Trigger */}
                    <button
                      onClick={() => onPhotoClick(photo.id)}
                      className="absolute inset-0 z-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-xs"
                      title="Click to view high-res photo"
                    >
                      <span className="px-3 py-1.5 rounded-xl bg-black/80 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg border border-white/10">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Enlarge</span>
                      </span>
                    </button>

                    {/* Individual Download Trigger Button */}
                    {onDownloadPhoto && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadPhoto(photo);
                        }}
                        className="absolute bottom-2.5 right-2.5 z-20 p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 transition shadow-lg flex items-center justify-center group/dl"
                        title={`Download photo (${photo.name})`}
                      >
                        <Download className="w-3.5 h-3.5 transition group-hover/dl:scale-110" />
                      </button>
                    )}

                    {/* Photo Filename Footer */}
                    <div className="absolute bottom-0 inset-x-0 p-2 sm:p-2.5 z-10 pointer-events-none pr-10">
                      <p className="text-[11px] font-mono text-stone-300 truncate drop-shadow-md">
                        {photo.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-7 py-4 border-t border-stone-850 bg-stone-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-semibold transition flex items-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Continue Browsing Gallery</span>
          </button>

          <div className="flex items-center gap-3">
            {unapprovedPaidPhotos.length > 0 && onPayForPhotos && (
              <button
                onClick={() => {
                  onClose();
                  onPayForPhotos(unapprovedPaidPhotos);
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-md"
                title="Pay for selected paid photos to unlock high-res downloads"
              >
                <CreditCard className="w-4 h-4" />
                <span>পেইড ছবির পেমেন্ট (৳{unapprovedPaidTotal})</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onProceedToSubmit();
              }}
              disabled={count === 0}
              className="px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-lg bg-linear-to-r from-rose-500 to-amber-500 hover:opacity-95 text-stone-950 shadow-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Proceed to Final Submission</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
