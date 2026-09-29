import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Lock,
  Calendar,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { CustomerGallery } from '../types';

interface ShareCustomerGalleryModalProps {
  gallery: CustomerGallery;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareCustomerGalleryModal: React.FC<ShareCustomerGalleryModalProps> = ({
  gallery,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const galleryUrl = `${window.location.origin}/gallery/${gallery.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(galleryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${gallery.customerName} - Wedding Photo Selection`,
          text: `Hi ${gallery.customerName}, here is your private photo selection gallery for ${gallery.eventName}. Please review and select your favorite photos!`,
          url: galleryUrl,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  const cleanPhone = (gallery.customerPhone || '').replace(/[^0-9]/g, '');
  const whatsAppText = encodeURIComponent(
    `Hello ${gallery.customerName},\n\nHere is your private photo selection gallery for ${gallery.eventName}:\n${galleryUrl}\n\nPlease select your favorite photos${
      gallery.maxSelections ? ` (up to ${gallery.maxSelections} photos)` : ''
    }${gallery.selectionDeadline ? ` before ${gallery.selectionDeadline}` : ''}.\n\nThank you for choosing RC Foto!`
  );
  const whatsAppLink = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${whatsAppText}`
    : `https://wa.me/?text=${whatsAppText}`;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-semibold text-stone-100">
                Share Customer Link
              </h2>
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

        {/* Link Box */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-stone-300 block">
            Direct Customer URL
          </label>
          <div className="flex items-center gap-2 bg-stone-950 border border-stone-800 rounded-xl p-2.5">
            <input
              type="text"
              readOnly
              value={galleryUrl}
              className="bg-transparent text-xs text-amber-300 font-mono flex-1 outline-hidden select-all"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="space-y-2.5">
          {/* WhatsApp Direct Share */}
          <a
            href={whatsAppLink}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-md"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Share via WhatsApp</span>
          </a>

          {/* Web Share API */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Share to Other Apps</span>
            </button>
          )}

          {/* Open Gallery */}
          <a
            href={`/select/${gallery.secureToken}`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-stone-950 hover:bg-stone-850 border border-stone-800 text-stone-300 hover:text-stone-100 font-semibold text-xs flex items-center justify-center gap-2 transition"
          >
            <ExternalLink className="w-4 h-4 text-amber-400" />
            <span>Open Gallery View</span>
          </a>
        </div>

        {/* Info Footnote */}
        <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-850 text-[11px] text-stone-400 space-y-1">
          <p className="flex items-center gap-1.5 text-stone-300">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>No login required for client.</span>
          </p>
          {gallery.pinEnabled && (
            <p className="text-amber-400/90">
              PIN Protection is enabled on this gallery. Ensure you provide the PIN to your client.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
