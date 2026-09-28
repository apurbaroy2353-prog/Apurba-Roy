import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Sparkles,
  Copy,
  Check,
  X,
  ExternalLink,
  Calendar,
  Camera,
  Layers,
  Clock,
  Heart,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { Album } from '../types';

export type EmailTemplateType = 'album_ready' | 'gallery_updated' | 'selection_reminder';

interface SendEmailNotificationModalProps {
  isOpen: boolean;
  album: Album | null;
  onClose: () => void;
  initialTemplate?: EmailTemplateType;
  senderName?: string;
  onNotificationSent?: (updatedAlbum: Album) => void;
}

export const SendEmailNotificationModal: React.FC<SendEmailNotificationModalProps> = ({
  isOpen,
  album,
  onClose,
  initialTemplate = 'album_ready',
  senderName = 'রম্যছবি - RamyaChobi Photography',
  onNotificationSent,
}) => {
  if (!isOpen || !album) return null;

  const [template, setTemplate] = useState<EmailTemplateType>(initialTemplate);
  const [recipientEmail, setRecipientEmail] = useState(album.clientEmail || '');
  const [ccEmail, setCcEmail] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyMessage, setBodyMessage] = useState('');
  const [studioSignature, setStudioSignature] = useState(senderName);

  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
  const [copiedText, setCopiedText] = useState(false);
  const [isSendingIntegrated, setIsSendingIntegrated] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Gallery URL
  const galleryUrl = `${window.location.origin}${window.location.pathname}?album=${album.slug}`;
  const photoCount = album.cachedPhotos?.length || 0;

  // Build default content according to template
  useEffect(() => {
    if (!album) return;

    const couple = album.coupleNames || 'there';
    const title = album.title;
    const limitInfo =
      album.selectionLimitEnabled && album.maxSelectionsAllowed
        ? `• Selection Allowance: Up to ${album.maxSelectionsAllowed} favorite photos included in your album package.`
        : album.maxSelectionsAllowed
        ? `• Recommended Selects: Around ${album.maxSelectionsAllowed} favorite photos for your album layout.`
        : `• Selection: Heart all of your favorite photos across the gallery.`;

    if (template === 'album_ready') {
      setSubject(`Your Wedding Photography Gallery is Ready! 💍 - ${title}`);
      setBodyMessage(
        `Dear ${couple},\n\n` +
          `Congratulations! We are absolutely thrilled to share that your private wedding photo gallery for "${title}" is now published and ready for your review!\n\n` +
          `✨ Access Your Private Gallery:\n` +
          `${galleryUrl}\n\n` +
          `Gallery Highlights:\n` +
          `• Total Photographs: ${photoCount} high-resolution proofing photos\n` +
          `• Wedding Date: ${album.weddingDate || 'Your Special Day'}\n` +
          `${limitInfo}\n\n` +
          `How to Make Your Selections:\n` +
          `1. Click the link above to enter your gallery.\n` +
          `2. Tap the Heart (♡) icon on any photo to add it to your shortlist.\n` +
          `3. Review your favorites anytime, and tap "Submit Selection" when you're finished.\n\n` +
          (album.notesForClient ? `A note from your photographer:\n"${album.notesForClient}"\n\n` : '') +
          `Take your time enjoying the memories. Please don't hesitate to reach out if you have any questions!\n\n` +
          `Warmest congratulations,\n` +
          `${studioSignature}`
      );
    } else if (template === 'gallery_updated') {
      setSubject(`Updated: New Photos Added to Your Wedding Gallery 📸 - ${title}`);
      setBodyMessage(
        `Hi ${couple},\n\n` +
          `Great news! We have just updated your private wedding gallery for "${title}" with newly edited and enhanced photographs.\n\n` +
          `✨ View Your Updated Gallery:\n` +
          `${galleryUrl}\n\n` +
          `Current Gallery Status:\n` +
          `• Total Photographs Now Available: ${photoCount} photos\n` +
          `${limitInfo}\n\n` +
          `You can view the latest uploads, filter by date or moment, and update or continue building your favorite shortlist.\n\n` +
          `Warmest regards,\n` +
          `${studioSignature}`
      );
    } else if (template === 'selection_reminder') {
      setSubject(`Gentle Reminder: Photo Selection for Your Wedding Album ⏳ - ${title}`);
      setBodyMessage(
        `Hi ${couple},\n\n` +
          `We hope you are having a wonderful week! This is a gentle reminder regarding the photo selections for your wedding album ("${title}").\n\n` +
          `✨ Link to Your Proofing Gallery:\n` +
          `${galleryUrl}\n\n` +
          `${limitInfo}\n\n` +
          `Once your selections are submitted, our design team will begin curating your custom heirloom album layouts and master retouching. If you need any assistance or have questions about choosing your spreads, just reply to this email!\n\n` +
          `With warmest regards,\n` +
          `${studioSignature}`
      );
    }
  }, [template, album, galleryUrl, photoCount, studioSignature]);

  // Generate mailto link
  const buildMailtoUrl = () => {
    let url = `mailto:${encodeURIComponent(recipientEmail.trim())}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(bodyMessage)}`;
    if (ccEmail.trim()) {
      url += `&cc=${encodeURIComponent(ccEmail.trim())}`;
    }
    return url;
  };

  // Launch Default Mail Client via mailto:
  const handleLaunchMailto = () => {
    const mailto = buildMailtoUrl();
    window.location.href = mailto;
    recordNotificationSent();
  };

  // Open Gmail Web Compose
  const handleOpenGmail = () => {
    let url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      recipientEmail.trim()
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyMessage)}`;
    if (ccEmail.trim()) {
      url += `&cc=${encodeURIComponent(ccEmail.trim())}`;
    }
    window.open(url, '_blank');
    recordNotificationSent();
  };

  // Open Outlook Web Compose
  const handleOpenOutlook = () => {
    let url = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(
      recipientEmail.trim()
    )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyMessage)}`;
    window.open(url, '_blank');
    recordNotificationSent();
  };

  // Copy Complete Text
  const handleCopyText = () => {
    const fullText = `Subject: ${subject}\n\n${bodyMessage}`;
    navigator.clipboard.writeText(fullText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // Integrated Notification Service simulation
  const handleSendIntegrated = async () => {
    if (!recipientEmail.trim()) {
      alert('Please enter a recipient email address.');
      return;
    }
    setIsSendingIntegrated(true);
    // Simulate integrated email dispatch
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSendingIntegrated(false);
    setSendSuccess(true);
    recordNotificationSent();
    setTimeout(() => {
      setSendSuccess(false);
      onClose();
    }, 1800);
  };

  const recordNotificationSent = () => {
    const updatedAlbum: Album = {
      ...album,
      clientEmail: recipientEmail.trim() || album.clientEmail,
      lastNotifiedAt: new Date().toISOString(),
      notificationCount: (album.notificationCount || 0) + 1,
    };
    if (onNotificationSent) {
      onNotificationSent(updatedAlbum);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-100 flex items-center gap-2">
                <span>Notify Client via Email</span>
                {album.lastNotifiedAt && (
                  <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-stone-800 text-stone-400">
                    Notified {album.notificationCount || 1}x
                  </span>
                )}
              </h3>
              <p className="text-xs text-stone-400">
                Send gallery invitation, updates, or selection reminders to {album.coupleNames}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Selector Bar */}
        <div className="px-6 py-3 bg-stone-950/70 border-b border-stone-850 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-medium">Notification Type:</span>
            <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
              <button
                type="button"
                onClick={() => setTemplate('album_ready')}
                className={`px-3 py-1 rounded-lg transition font-medium ${
                  template === 'album_ready'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                💍 Album Ready
              </button>
              <button
                type="button"
                onClick={() => setTemplate('gallery_updated')}
                className={`px-3 py-1 rounded-lg transition font-medium ${
                  template === 'gallery_updated'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                📸 Photos Updated
              </button>
              <button
                type="button"
                onClick={() => setTemplate('selection_reminder')}
                className={`px-3 py-1 rounded-lg transition font-medium ${
                  template === 'selection_reminder'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                ⏳ Reminder
              </button>
            </div>
          </div>

          {/* Tab Toggle: Compose vs Live Preview */}
          <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition ${
                activeTab === 'compose'
                  ? 'bg-stone-800 text-stone-200'
                  : 'text-stone-400 hover:text-stone-300'
              }`}
            >
              Compose
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition ${
                activeTab === 'preview'
                  ? 'bg-stone-800 text-stone-200'
                  : 'text-stone-400 hover:text-stone-300'
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sendSuccess ? (
            <div className="py-12 text-center space-y-3 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-serif text-xl text-stone-100 font-medium">Notification Dispatched!</h4>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                Email notification logged and sent to <span className="text-amber-300 font-mono">{recipientEmail}</span> for gallery "{album.title}".
              </p>
            </div>
          ) : activeTab === 'compose' ? (
            <div className="space-y-4 text-xs">
              {/* Recipient Email & CC */}
              <div className="space-y-3 p-4 rounded-2xl bg-stone-950/60 border border-stone-850">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-stone-300 font-medium flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      <span>Recipient Email (Client) *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCc(!showCc)}
                      className="text-[11px] text-stone-500 hover:text-stone-300 transition"
                    >
                      {showCc ? '- Hide CC' : '+ Add CC'}
                    </button>
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="e.g. sophie.julian@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50 text-xs font-mono"
                  />
                </div>

                {showCc && (
                  <div>
                    <label className="text-stone-400 font-medium block mb-1">
                      CC (Optional):
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. planner@wedding.com, partner@example.com"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50 text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Subject Line */}
              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  Subject Line:
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 rounded-xl px-3.5 py-2 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50 text-xs font-medium"
                />
              </div>

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-stone-300 font-medium">
                    Email Message Body:
                  </label>
                  <span className="text-[10px] text-stone-500">
                    Includes direct gallery link & proofing instructions
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={bodyMessage}
                  onChange={(e) => setBodyMessage(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 rounded-xl p-3 text-stone-200 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50 text-xs font-mono leading-relaxed resize-y"
                />
              </div>

              {/* Gallery Link preview info card */}
              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-amber-300 font-medium">Target Private Gallery Link</p>
                    <p className="text-[11px] text-stone-400 font-mono truncate">{galleryUrl}</p>
                  </div>
                </div>
                <a
                  href={galleryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-amber-400 transition shrink-0"
                  title="Test gallery link in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            /* Live Email Client Preview */
            <div className="space-y-4 animate-fade-in">
              <div className="bg-stone-950 rounded-2xl border border-stone-850 p-6 space-y-5 text-stone-200">
                {/* Header Mockup */}
                <div className="border-b border-stone-800 pb-4 flex items-center justify-between">
                  <div>
                    <p className="font-serif text-lg font-light text-stone-100 tracking-wide">
                      LUMIÈRE STUDIO
                    </p>
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-mono">
                      Fine Art Wedding Photography
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-900 text-stone-400 border border-stone-800">
                    Client Invitation
                  </span>
                </div>

                {/* Email Metadata Header */}
                <div className="text-xs space-y-1 text-stone-400 font-mono pb-2 border-b border-stone-850">
                  <p>
                    <span className="text-stone-500">To:</span> {recipientEmail || '(Client Email)'}
                  </p>
                  <p>
                    <span className="text-stone-500">Subject:</span>{' '}
                    <span className="text-stone-200 font-medium">{subject}</span>
                  </p>
                </div>

                {/* Message Body Styled Preview */}
                <div className="text-xs leading-relaxed space-y-3 whitespace-pre-wrap font-sans text-stone-300">
                  {bodyMessage}
                </div>

                {/* Big Call-to-action Button Mockup */}
                <div className="pt-3 text-center">
                  <a
                    href={galleryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs transition shadow-lg"
                  >
                    <span>Open Private Gallery</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-stone-800 bg-stone-950/80 flex flex-wrap items-center justify-between gap-3">
          {/* Secondary Tools: Copy text */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                copiedText
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                  : 'bg-stone-900 hover:bg-stone-850 border-stone-800 text-stone-300'
              }`}
              title="Copy email subject and formatted body to clipboard"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            {/* Webmail Quick Launchers */}
            <button
              type="button"
              onClick={handleOpenGmail}
              className="px-2.5 py-2 rounded-xl text-xs font-medium bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-300 transition flex items-center gap-1.5"
              title="Open draft in Gmail web app"
            >
              <span>Gmail</span>
              <ExternalLink className="w-3 h-3 text-stone-500" />
            </button>

            <button
              type="button"
              onClick={handleOpenOutlook}
              className="px-2.5 py-2 rounded-xl text-xs font-medium bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-300 transition flex items-center gap-1.5 hidden sm:flex"
              title="Open draft in Outlook web app"
            >
              <span>Outlook</span>
              <ExternalLink className="w-3 h-3 text-stone-500" />
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-200 transition"
            >
              Cancel
            </button>

            {/* Launch Native Mail Client mailto: */}
            <button
              type="button"
              onClick={handleLaunchMailto}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              title="Open in your default desktop or mobile mail application"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Launch Mail App</span>
            </button>

            {/* Integrated Notification Service Trigger */}
            <button
              type="button"
              disabled={isSendingIntegrated}
              onClick={handleSendIntegrated}
              className="px-4 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-semibold transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
              title="Dispatch notification via integrated notification service"
            >
              <Send className={`w-3.5 h-3.5 ${isSendingIntegrated ? 'animate-bounce' : ''}`} />
              <span>{isSendingIntegrated ? 'Sending...' : 'Send Notification'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
