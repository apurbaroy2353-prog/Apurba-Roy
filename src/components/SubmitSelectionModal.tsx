import React, { useState } from 'react';
import {
  Heart,
  Send,
  Sparkles,
  CheckCircle2,
  X,
  User,
  Mail,
  MessageSquare,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Album } from '../types';
import { addSubmission } from '../services/albumStorage';

interface SubmitSelectionModalProps {
  album: Album;
  selectedPhotoIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onBackToSummary?: () => void;
  onViewProfile?: () => void;
}

export const SubmitSelectionModal: React.FC<SubmitSelectionModalProps> = ({
  album,
  selectedPhotoIds,
  isOpen,
  onClose,
  onSuccess,
  onBackToSummary,
  onViewProfile,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Please provide your name (or couple name)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      addSubmission({
        albumId: album.id,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientNotes: clientNotes.trim() || undefined,
        selectedPhotoIds,
        status: 'completed',
        clientIpOrDevice: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser',
      });

      setIsSubmitting(false);
      setIsSuccess(true);

      // Trigger wedding celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fb7185', '#e2e8f0', '#fbbf24'],
      });
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Failed to submit selection. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-full hover:bg-stone-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="font-serif text-2xl text-stone-100 font-medium">
                Selection Received!
              </h3>
              <p className="text-sm text-stone-400 mt-2">
                Thank you, <strong className="text-stone-200">{clientName}</strong>! Your {selectedPhotoIds.length} chosen favorites have been forwarded to your wedding photography team.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 text-xs text-stone-400 text-left space-y-1">
              <p className="font-medium text-stone-300">What happens next?</p>
              <p>1. Our retouching studio will pull these exact files from high-resolution archives.</p>
              <p>2. We'll start designing your album layout or fine-tuning high-resolution edits.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {onViewProfile && (
                <button
                  type="button"
                  onClick={() => {
                    onSuccess();
                    onClose();
                    onViewProfile();
                  }}
                  className="flex-1 py-3 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-amber-300 font-semibold text-xs sm:text-sm rounded-xl transition shadow-xs"
                >
                  View in My Profile & History →
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="flex-1 py-3 bg-linear-to-r from-amber-500 to-rose-500 text-stone-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg hover:opacity-95"
              >
                Back to Gallery
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <Heart className="w-5 h-5 fill-rose-500 stroke-rose-500" />
              </div>
              <div>
                <h3 className="font-serif text-xl font-medium text-stone-100">
                  Submit Album Selection
                </h3>
                <p className="text-xs text-stone-400">
                  You have favorited <strong className="text-rose-400">{selectedPhotoIds.length}</strong>
                  {album.selectionLimitEnabled && album.maxSelectionsAllowed
                    ? ` of ${album.maxSelectionsAllowed} allowed photos`
                    : ' photos'}{' '}
                  for {album.coupleNames}
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-400" />
                  Your Name(s) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sophie & Julian"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 text-sm rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-rose-400/50"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 text-sm rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-rose-400/50"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                  Notes / Requests for the Photographer
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Please use photo #05 for the main cover, or include black & white versions where possible..."
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 text-sm rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-rose-400/50"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onBackToSummary) {
                    onBackToSummary();
                  }
                }}
                className="flex-1 py-2.5 border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-sm font-medium rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Review Selection Grid</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedPhotoIds.length === 0}
                className="flex-1 py-2.5 bg-linear-to-r from-rose-500 to-amber-500 hover:opacity-95 text-stone-950 font-semibold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Submitting...' : 'Confirm & Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
