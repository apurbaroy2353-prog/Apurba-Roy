import React, { useState } from 'react';
import {
  X,
  FolderPlus,
  HardDrive,
  Check,
  Calendar,
  Lock,
  Download,
  Edit3,
  Sparkles,
  AlertCircle,
  Copy,
  ExternalLink,
  Share2,
  RefreshCw,
  Eye,
  Info,
  Ban,
} from 'lucide-react';
import {
  CustomerGallery,
  CustomerGalleryStatus,
  CustomerGalleryPhoto,
  DrivePhoto,
} from '../types';
import {
  generateSecureToken,
  hashPin,
  saveCustomerGallery,
  generateDriveThumbnailUrl,
  generateDrivePreviewUrl,
} from '../services/customerGalleryService';
import { DriveFolderPickerModal, DriveFolderSelectionResult } from './DriveFolderPickerModal';
import { listPhotosInFolder } from '../services/drive';

interface CreateCustomerGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (gallery: CustomerGallery) => void;
  accessToken: string | null;
  onNeedGoogleSignIn: () => void;
}

export const CreateCustomerGalleryModal: React.FC<CreateCustomerGalleryModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  accessToken,
  onNeedGoogleSignIn,
}) => {
  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [eventName, setEventName] = useState('');
  const [galleryName, setGalleryName] = useState('Photo Selection');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [maxSelections, setMaxSelections] = useState('100');
  const [selectionDeadline, setSelectionDeadline] = useState(
    new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
  );
  const [pinProtection, setPinProtection] = useState(false);
  const [pin, setPin] = useState('');
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowEditing, setAllowEditing] = useState(false);
  const [askCustomerName, setAskCustomerName] = useState(false);
  const [askCustomerPhone, setAskCustomerPhone] = useState(false);
  const [status, setStatus] = useState<CustomerGalleryStatus>('active');
  const [notesForCustomer, setNotesForCustomer] = useState(
    'Please select your favorite photos for your album. Click any photo to preview in high quality.'
  );

  // Google Drive folder selection
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [selectedFolderResult, setSelectedFolderResult] = useState<DriveFolderSelectionResult | null>(null);

  // Submission state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGallery, setCreatedGallery] = useState<CustomerGallery | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

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
    if (!customerName.trim()) {
      setError('Please provide the Customer Name (e.g. Rahim & Ayesha).');
      return;
    }
    if (!eventName.trim()) {
      setError('Please provide the Event Name (e.g. Wedding Photography).');
      return;
    }
    if (!selectedFolderResult) {
      setError('Please select a Google Drive folder for this gallery.');
      return;
    }
    if (pinProtection && (!pin.trim() || pin.trim().length < 4)) {
      setError('Please enter a 4-to-6 digit PIN for PIN Protection.');
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      // 1. Fetch live photos from Drive if not already scanned
      let fetchedPhotos: DrivePhoto[] = selectedFolderResult.previewPhotos || [];
      if (fetchedPhotos.length === 0 && accessToken && selectedFolderResult.folder.id) {
        try {
          fetchedPhotos = await listPhotosInFolder(accessToken, selectedFolderResult.folder.id, {
            includeSubfolders: selectedFolderResult.includeSubfolders,
            folderName: selectedFolderResult.folder.name,
          });
        } catch (fetchErr) {
          console.warn('Could not auto-fetch photos from drive folder:', fetchErr);
        }
      }

      // Convert DrivePhotos to CustomerGalleryPhotos with reliable high-res image URLs
      const mappedPhotos: CustomerGalleryPhoto[] = fetchedPhotos.map((p) => ({
        id: p.id,
        driveFileId: p.id,
        name: p.name,
        thumbnailUrl: generateDriveThumbnailUrl(p.id, p.thumbnailLink),
        previewUrl: generateDrivePreviewUrl(p.id, p.thumbnailLink),
        mimeType: p.mimeType,
        size: p.size ? `${(parseInt(p.size, 10) / (1024 * 1024)).toFixed(1)} MB` : undefined,
        createdTime: p.createdTime,
        folderId: p.folderId,
      }));

      // Generate secure random token e.g. A8kP9mQ72xRt4Lw
      const secureToken = generateSecureToken(15);

      // Compute PIN hash if PIN is enabled
      const pinHash = pinProtection && pin ? await hashPin(pin) : undefined;

      const nowIso = new Date().toISOString();
      const parsedMax = parseInt(maxSelections, 10);
      const maxVal = !isNaN(parsedMax) && parsedMax > 0 ? parsedMax : 100;

      const newGallery: CustomerGallery = {
        id: 'cg_' + Math.random().toString(36).substring(2, 9),
        customerName: customerName.trim(),
        eventName: eventName.trim(),
        galleryName: galleryName.trim() || 'Master Photo Selection',
        customerPhone: customerMobile.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        driveFolderId: selectedFolderResult.folder.id,
        driveFolderName: selectedFolderResult.folder.name,
        secureToken,
        pinEnabled: pinProtection,
        pinHash,
        maxSelections: maxVal,
        selectionDeadline,
        allowDownloads: allowDownload,
        allowEditing,
        askCustomerName,
        askCustomerPhone,
        status,
        totalPhotos: mappedPhotos.length || 0,
        selectedCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        photos: mappedPhotos,
        coverPhotoUrl: mappedPhotos[0]?.thumbnailUrl,
        notesForCustomer: notesForCustomer.trim(),
        includeSubfolders: selectedFolderResult.includeSubfolders,
        lastActivity: 'Gallery created',
      };

      await saveCustomerGallery(newGallery);
      setCreatedGallery(newGallery);
      onCreated(newGallery);
    } catch (err: any) {
      console.error('Error creating customer gallery:', err);
      setError(err.message || 'Failed to create customer gallery');
    } finally {
      setIsCreating(false);
    }
  };

  const getShareUrl = (token: string) => {
    return `${window.location.origin}/gallery/${createdGallery?.id || token}`;
  };

  const handleCopyLink = () => {
    if (!createdGallery) return;
    const url = getShareUrl(createdGallery.secureToken);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareCreated = async () => {
    if (!createdGallery) return;
    const url = getShareUrl(createdGallery.secureToken);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${createdGallery.customerName} - Photo Selection`,
          text: `Hi ${createdGallery.customerName}, please review and select your photos for ${createdGallery.eventName}:`,
          url,
        });
      } catch {}
    } else {
      const cleanPhone = (createdGallery.customerPhone || '').replace(/[^0-9]/g, '');
      const whatsAppText = encodeURIComponent(
        `Hi ${createdGallery.customerName}, here is your photo selection gallery for ${createdGallery.eventName}:\n${url}`
      );
      const whatsAppLink = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${whatsAppText}`
        : `https://wa.me/?text=${whatsAppText}`;
      window.open(whatsAppLink, '_blank');
    }
  };

  const handleToggleDisableCreated = async () => {
    if (!createdGallery) return;
    const nextStatus: CustomerGalleryStatus =
      createdGallery.status === 'disabled' ? 'active' : 'disabled';
    const updated: CustomerGallery = {
      ...createdGallery,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    await saveCustomerGallery(updated);
    setCreatedGallery(updated);
    onCreated(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-serif font-bold text-lg">
              RC
            </div>
            <div>
              <h2 className="text-lg font-serif font-semibold text-stone-100">
                {createdGallery ? 'Gallery Created Successfully!' : 'Create Customer Gallery'}
              </h2>
              <p className="text-xs text-stone-400">
                {createdGallery
                  ? 'Share the secure customer link directly with your client'
                  : 'Generate a secure customer link for direct photo selection with no login required'}
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

        {/* If Created -> Show Generated Link and Actions */}
        {createdGallery ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-3 text-emerald-300 text-xs">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  {createdGallery.customerName} • {createdGallery.eventName}
                </p>
                <p className="text-emerald-400/80">
                  {createdGallery.totalPhotos} photos loaded from {createdGallery.driveFolderName}
                </p>
              </div>
            </div>

            {/* Generated Secure Link Card */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-300 block">
                Secure Customer Link (No Login Required)
              </label>
              <div className="flex items-center gap-2 bg-stone-950 border border-stone-800 rounded-xl p-2.5">
                <input
                  type="text"
                  readOnly
                  value={getShareUrl(createdGallery.secureToken)}
                  className="bg-transparent text-xs text-amber-300 font-mono flex-1 outline-hidden select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Copied!</span>
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

            {/* Gallery Info Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-stone-950/60 p-4 rounded-xl border border-stone-850">
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-mono">Max Selection</span>
                <span className="text-stone-200 font-semibold">{createdGallery.maxSelections} Photos</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-mono">Deadline</span>
                <span className="text-stone-200 font-semibold">{createdGallery.selectionDeadline}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-mono">PIN Protection</span>
                <span className="text-stone-200 font-semibold">{createdGallery.pinEnabled ? 'Enabled' : 'OFF'}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-mono">Download</span>
                <span className="text-stone-200 font-semibold">{createdGallery.allowDownloads ? 'Allowed' : 'Disabled'}</span>
              </div>
            </div>

            {/* Actions: Copy Link, Share Link, Open Gallery, Disable Link */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-800">
              <button
                type="button"
                onClick={handleToggleDisableCreated}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                  createdGallery.status === 'disabled'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : 'bg-stone-900 border-stone-800 text-rose-400 hover:bg-rose-950/30'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{createdGallery.status === 'disabled' ? 'Enable Link' : 'Disable Link'}</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareCreated}
                  className="px-3.5 py-2 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Share Link</span>
                </button>

                <a
                  href={`/select/${createdGallery.secureToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open Gallery</span>
                </a>

                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Create Form */
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Customer & Event Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Customer Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahim & Ayesha"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Event Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Wedding Photography"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Gallery Name
                </label>
                <input
                  type="text"
                  value={galleryName}
                  onChange={(e) => setGalleryName(e.target.value)}
                  placeholder="e.g. Master Photo Selection"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Customer Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  placeholder="e.g. +8801776044951"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Customer Email (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g. rahim.ayesha@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition"
                />
              </div>
            </div>

            {/* Google Drive Folder Connection */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-stone-850 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-stone-200">
                    Google Drive Folder <span className="text-amber-400">*</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenDrivePicker}
                  className="px-3 py-1.5 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-amber-400 hover:text-amber-300 text-xs font-medium rounded-xl transition flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{selectedFolderResult ? 'Change Folder' : 'Select Drive Folder'}</span>
                </button>
              </div>

              {selectedFolderResult ? (
                <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-stone-200">
                      {selectedFolderResult.folder.name}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      Folder ID: <span className="font-mono">{selectedFolderResult.folder.id}</span>
                      {selectedFolderResult.includeSubfolders && ' • Recursive Scan (Subfolders Included)'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                    ✓ Connected
                  </span>
                </div>
              ) : (
                <p className="text-xs text-stone-500">
                  Choose a Google Drive wedding folder (e.g. Wedding &gt; Rahim Wedding &gt; Preview) to import photos.
                </p>
              )}
            </div>

            {/* Selection Limits & Deadlines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Maximum Photo Selection
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 transition font-mono"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Customer will be capped at this selection count.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Selection Deadline
                </label>
                <input
                  type="date"
                  value={selectionDeadline}
                  onChange={(e) => setSelectionDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 transition"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Gallery automatically expires after this date.
                </span>
              </div>
            </div>

            {/* Gallery Status */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Gallery Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerGalleryStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-400 focus:outline-hidden text-xs text-stone-200 transition"
              >
                <option value="active">Active (Available for customer selection)</option>
                <option value="draft">Draft</option>
                <option value="selection_in_progress">Selection In Progress</option>
                <option value="submitted">Submitted</option>
                <option value="locked">Locked</option>
                <option value="expired">Expired</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            {/* PIN Protection & Permissions Toggles */}
            <div className="space-y-3 pt-2">
              {/* PIN Toggle */}
              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>PIN Protection</span>
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Require customer to enter a PIN to open the gallery (default is OFF)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={pinProtection}
                  onChange={(e) => setPinProtection(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {pinProtection && (
                <div className="p-3.5 rounded-xl bg-stone-900 border border-amber-500/30 space-y-2">
                  <label className="block text-xs font-medium text-amber-300">
                    Set 4-to-6 Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="e.g. 1234"
                    className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-100 font-mono tracking-widest focus:border-amber-400 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-stone-400">
                    PIN will be securely hashed with SHA-256 before storage.
                  </p>
                </div>
              )}

              {/* Allow Customer Download */}
              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-stone-400" />
                    <span>Allow Customer Download</span>
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Allow customer to download individual preview photos
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Allow Selection Editing After Submit */}
              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-stone-400" />
                    <span>Allow Selection Editing After Submit</span>
                  </p>
                  <p className="text-[11px] text-stone-400">
                    If disabled, gallery becomes read-only once submitted
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowEditing}
                  onChange={(e) => setAllowEditing(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Ask Customer Name Toggle */}
              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ask Customer Name</span>
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Prompt client for their name on first visit (no account required)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={askCustomerName}
                  onChange={(e) => setAskCustomerName(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Ask Mobile Number Toggle */}
              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-850 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ask Mobile Number</span>
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Prompt client for their phone number on first visit to identify session
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={askCustomerPhone}
                  onChange={(e) => setAskCustomerPhone(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-stone-400 hover:text-stone-200 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !selectedFolderResult}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Gallery & Loading Photos...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Customer Link</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Embedded Drive Picker Modal */}
      {isDrivePickerOpen && accessToken && (
        <DriveFolderPickerModal
          accessToken={accessToken}
          isOpen={isDrivePickerOpen}
          onClose={() => setIsDrivePickerOpen(false)}
          onSelectFolder={(result) => {
            setSelectedFolderResult(result);
            setIsDrivePickerOpen(false);
          }}
          modalTitle="Select Google Drive Wedding Folder for Customer Gallery"
          confirmButtonLabel="Import Photos From This Folder"
        />
      )}
    </div>
  );
};
