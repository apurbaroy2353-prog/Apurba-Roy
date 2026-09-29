import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  Share2,
  Eye,
  Trash2,
  Calendar,
  Check,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Users,
  Download,
  FileCheck,
  Search,
  Lock,
  Unlock,
  AlertCircle,
  Copy,
  Clock,
  MoreVertical,
  Filter,
  CheckCircle2,
  Shield,
  Edit,
  RotateCcw,
  Ban,
  Archive,
  HardDrive,
  Package,
  X,
  Link2,
} from 'lucide-react';
import {
  CustomerGallery,
  CustomerGalleryStatus,
} from '../types';
import {
  getCustomerGalleries,
  subscribeToCustomerGalleries,
  deleteCustomerGallery,
  updateCustomerGalleryStatus,
  resetCustomerSelections,
  getRelativeTimeFormatted,
  fulfillProjectZip,
} from '../services/customerGalleryService';
import { CreateCustomerGalleryModal } from './CreateCustomerGalleryModal';
import { CustomerSelectedPhotosModal } from './CustomerSelectedPhotosModal';
import { ShareCustomerGalleryModal } from './ShareCustomerGalleryModal';
import { EditCustomerGalleryModal } from './EditCustomerGalleryModal';

interface CustomerGalleriesPanelProps {
  accessToken: string | null;
  onNeedGoogleSignIn: () => void;
  onOpenCustomerView: (gallery: CustomerGallery) => void;
}

export const CustomerGalleriesPanel: React.FC<CustomerGalleriesPanelProps> = ({
  accessToken,
  onNeedGoogleSignIn,
  onOpenCustomerView,
}) => {
  const [galleries, setGalleries] = useState<CustomerGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerGalleryStatus>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGalleryForViewPhotos, setSelectedGalleryForViewPhotos] = useState<CustomerGallery | null>(null);
  const [selectedGalleryForShare, setSelectedGalleryForShare] = useState<CustomerGallery | null>(null);
  const [selectedGalleryForEdit, setSelectedGalleryForEdit] = useState<CustomerGallery | null>(null);
  const [selectedGalleryForZipFulfill, setSelectedGalleryForZipFulfill] = useState<CustomerGallery | null>(null);
  const [zipDownloadUrlInput, setZipDownloadUrlInput] = useState('');
  const [zipAdminNotesInput, setZipAdminNotesInput] = useState('');
  const [isFulfillingZip, setIsFulfillingZip] = useState(false);

  // Load and listen in real-time
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCustomerGalleries((list) => {
      setGalleries(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtered galleries
  const filteredGalleries = galleries.filter((g) => {
    const matchesSearch =
      g.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.galleryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.customerEmail && g.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (g.customerPhone && g.customerPhone.includes(searchQuery));

    const matchesStatus = statusFilter === 'all' || g.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCopyLink = (token: string, galleryId?: string) => {
    const url = `${window.location.origin}/gallery/${galleryId || token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete customer gallery "${name}"? This cannot be undone.`)) {
      await deleteCustomerGallery(id);
    }
  };

  const handleToggleLock = async (gallery: CustomerGallery) => {
    const newStatus: CustomerGalleryStatus = gallery.status === 'locked' ? 'active' : 'locked';
    await updateCustomerGalleryStatus(gallery.id, newStatus);
  };

  const handleToggleDisable = async (gallery: CustomerGallery) => {
    const newStatus: CustomerGalleryStatus = gallery.status === 'disabled' ? 'active' : 'disabled';
    await updateCustomerGalleryStatus(gallery.id, newStatus);
  };

  const handleResetSelections = async (gallery: CustomerGallery) => {
    if (confirm(`Reset all client photo selections for "${gallery.customerName}"? Current selections will be cleared.`)) {
      await resetCustomerSelections(gallery.id);
    }
  };

  const handleOpenFulfillZip = (gallery: CustomerGallery) => {
    setSelectedGalleryForZipFulfill(gallery);
    setZipDownloadUrlInput(gallery.zipDownloadUrl || '');
    setZipAdminNotesInput(gallery.zipAdminNotes || '');
  };

  const handleSaveFulfillZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGalleryForZipFulfill) return;
    setIsFulfillingZip(true);
    try {
      await fulfillProjectZip(selectedGalleryForZipFulfill.id, zipDownloadUrlInput, zipAdminNotesInput);
      setGalleries((prev) =>
        prev.map((g) =>
          g.id === selectedGalleryForZipFulfill.id
            ? {
                ...g,
                zipDownloadUrl: zipDownloadUrlInput,
                zipRequestStatus: 'ready' as const,
                zipAdminNotes: zipAdminNotesInput,
              }
            : g
        )
      );
      setSelectedGalleryForZipFulfill(null);
    } catch (err: any) {
      alert('Error updating ZIP fulfillment: ' + (err.message || 'Please try again.'));
    } finally {
      setIsFulfillingZip(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: CustomerGalleryStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Active
          </span>
        );
      case 'selection_in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            In Progress
          </span>
        );
      case 'submitted':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Submitted</span>
          </span>
        );
      case 'locked':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Locked</span>
          </span>
        );
      case 'expired':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-800 text-stone-400 border border-stone-700">
            Expired
          </span>
        );
      case 'disabled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            Disabled
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-850 text-stone-300 border border-stone-800">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Strip with Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900/60 border border-stone-800 p-5 rounded-3xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-serif font-semibold text-stone-100">
              Customer Galleries
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Direct Client Selection
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Generate secure links for couples and event clients. Clients select photos immediately with no login required.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:opacity-95 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <FolderPlus className="w-4 h-4" />
          <span>+ Create Gallery</span>
        </button>
      </div>

      {/* Stats Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800">
          <p className="text-stone-400 text-xs font-medium">Total Galleries</p>
          <p className="text-2xl font-serif font-bold text-stone-100 mt-1">
            {galleries.length}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800">
          <p className="text-amber-400 text-xs font-medium">In Progress</p>
          <p className="text-2xl font-serif font-bold text-amber-400 mt-1">
            {galleries.filter((g) => g.status === 'selection_in_progress').length}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800">
          <p className="text-emerald-400 text-xs font-medium">Submitted</p>
          <p className="text-2xl font-serif font-bold text-emerald-400 mt-1">
            {galleries.filter((g) => g.status === 'submitted').length}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800">
          <p className="text-stone-400 text-xs font-medium">Curated Photos</p>
          <p className="text-2xl font-serif font-bold text-stone-100 mt-1">
            {galleries.reduce((acc, g) => acc + (g.selectedCount || 0), 0)}
          </p>
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/40 border border-stone-800 p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, event, or gallery name..."
            className="w-full pl-10 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder:text-stone-500 focus:border-amber-400 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'selection_in_progress', 'submitted', 'locked', 'expired', 'disabled'] as const).map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {st === 'all'
                  ? 'All'
                  : st === 'selection_in_progress'
                  ? 'In Progress'
                  : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Galleries List Table / Cards */}
      {filteredGalleries.length === 0 ? (
        <div className="p-12 text-center bg-stone-900/30 border border-stone-800 rounded-3xl text-stone-400 space-y-3">
          <p className="text-sm">No customer galleries found matching criteria.</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-stone-850 hover:bg-stone-800 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition"
          >
            Create Your First Customer Gallery
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredGalleries.map((gallery) => {
            const isCopied = copiedToken === gallery.secureToken;
            const progressPercent = gallery.maxSelections > 0
              ? Math.min(100, Math.round((gallery.selectedCount / gallery.maxSelections) * 100))
              : 0;

            return (
              <div
                key={gallery.id}
                className="bg-stone-900/80 border border-stone-800 hover:border-stone-750 p-5 rounded-3xl transition shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                {/* Left: Customer & Event info */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Cover thumbnail */}
                  <div className="w-16 h-16 rounded-2xl bg-stone-950 border border-stone-800 overflow-hidden shrink-0 shadow-md">
                    {gallery.coverPhotoUrl ? (
                      <img
                        src={gallery.coverPhotoUrl}
                        alt={gallery.customerName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-amber-400 font-serif font-bold text-lg">
                        RC
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-base font-serif font-semibold text-stone-100 truncate">
                        {gallery.customerName}
                      </h3>
                      {renderStatusBadge(gallery.status)}
                      {gallery.zipRequested && (
                        <button
                          type="button"
                          onClick={() => handleOpenFulfillZip(gallery)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 cursor-pointer hover:bg-purple-500/30 transition"
                          title="Click to fulfill / view High-Res ZIP request"
                        >
                          <Archive className="w-3 h-3 text-purple-400" />
                          <span>{gallery.zipRequestStatus === 'ready' && gallery.zipDownloadUrl ? 'ZIP Ready' : 'ZIP Requested'}</span>
                        </button>
                      )}
                      {gallery.pinEnabled && (
                        <span className="px-2 py-0.2 rounded-md bg-stone-850 text-stone-400 border border-stone-750 text-[10px] flex items-center gap-1 font-mono">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>PIN</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-stone-300">
                      {gallery.eventName} • <span className="text-stone-400">{gallery.galleryName}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-400 mt-2">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-stone-500" />
                        <span className="truncate max-w-[180px]">{gallery.driveFolderName}</span>
                      </span>
                      <span>•</span>
                      <span>{(gallery.totalPhotos || 0).toLocaleString()} Photos</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-stone-500" />
                        <span>Deadline: {gallery.selectionDeadline || 'None'}</span>
                      </span>
                      <span>•</span>
                      <span className="text-stone-500">
                        Active: {getRelativeTimeFormatted(gallery.updatedAt || gallery.createdAt)}
                      </span>
                    </div>

                    {/* High-Res ZIP Request Alert for Admin */}
                    {gallery.zipRequested && (
                      <div className="mt-3 p-2.5 rounded-xl bg-purple-950/25 border border-purple-800/40 flex flex-wrap items-center justify-between gap-2 text-xs text-purple-200">
                        <div className="flex items-center gap-2">
                          <Archive className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="text-[11px]">
                            <strong>High-Res ZIP Requested:</strong> {gallery.zipRequestedCount || gallery.selectedCount} photos
                            {gallery.zipRequestEmail ? ` • Email: ${gallery.zipRequestEmail}` : ''}
                            {gallery.zipRequestNotes ? ` • "${gallery.zipRequestNotes}"` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenFulfillZip(gallery)}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition shrink-0 cursor-pointer shadow-xs"
                        >
                          {gallery.zipDownloadUrl ? 'Edit ZIP Link' : 'Fulfill ZIP'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle: Selection Progress Bar */}
                <div className="w-full md:w-56 shrink-0 bg-stone-950/60 p-3.5 rounded-2xl border border-stone-850 flex flex-col justify-center">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-stone-400 font-medium">Selected</span>
                    <span className="font-mono font-bold text-amber-400">
                      {gallery.selectedCount} / {gallery.maxSelections}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-850 overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1.5 flex items-center justify-between">
                    <span>{progressPercent}% Complete</span>
                    {gallery.allowEditing && <span className="text-emerald-400">Editing Allowed</span>}
                  </p>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Open Gallery */}
                  <button
                    onClick={() => onOpenCustomerView(gallery)}
                    className="p-2.5 bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200 text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Open customer view"
                  >
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span className="hidden lg:inline">Open</span>
                  </button>

                  {/* Copy Link */}
                  <button
                    onClick={() => handleCopyLink(gallery.secureToken, gallery.id)}
                    className="p-2.5 bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200 text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Copy direct customer link"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold hidden lg:inline">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-amber-400" />
                        <span className="hidden lg:inline">Copy</span>
                      </>
                    )}
                  </button>

                  {/* Share Link */}
                  <button
                    onClick={() => setSelectedGalleryForShare(gallery)}
                    className="p-2.5 bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200 text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Share to WhatsApp or Messenger"
                  >
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span className="hidden lg:inline">Share</span>
                  </button>

                  {/* View Selected Photos */}
                  <button
                    onClick={() => setSelectedGalleryForViewPhotos(gallery)}
                    className="px-3 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="View selected photos, export filenames, or collect in Google Drive"
                  >
                    <FileCheck className="w-4 h-4 text-amber-400" />
                    <span>View Selections ({gallery.selectedCount})</span>
                  </button>

                  {/* Edit Gallery */}
                  <button
                    onClick={() => setSelectedGalleryForEdit(gallery)}
                    className="p-2.5 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-300 hover:text-stone-100 text-xs rounded-xl transition"
                    title="Edit settings, deadline, limits"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {/* Lock / Unlock */}
                  <button
                    onClick={() => handleToggleLock(gallery)}
                    className={`p-2.5 border rounded-xl text-xs transition ${
                      gallery.status === 'locked'
                        ? 'bg-purple-950/40 border-purple-800 text-purple-300'
                        : 'bg-stone-850 hover:bg-stone-800 border-stone-750 text-stone-400'
                    }`}
                    title={gallery.status === 'locked' ? 'Unlock Selection' : 'Lock Selection'}
                  >
                    {gallery.status === 'locked' ? (
                      <Lock className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                  </button>

                  {/* Reset Selections */}
                  <button
                    onClick={() => handleResetSelections(gallery)}
                    className="p-2.5 bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-400 hover:text-amber-400 rounded-xl transition"
                    title="Reset selections"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Disable Gallery */}
                  <button
                    onClick={() => handleToggleDisable(gallery)}
                    className={`p-2.5 border rounded-xl text-xs transition ${
                      gallery.status === 'disabled'
                        ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                        : 'bg-stone-850 hover:bg-stone-800 border-stone-750 text-stone-400'
                    }`}
                    title={gallery.status === 'disabled' ? 'Enable Gallery' : 'Disable Gallery'}
                  >
                    <Ban className="w-4 h-4" />
                  </button>

                  {/* Delete Gallery */}
                  <button
                    onClick={() => handleDelete(gallery.id, gallery.customerName)}
                    className="p-2.5 bg-stone-850 hover:bg-rose-950/40 border border-stone-750 hover:border-rose-800/60 text-stone-400 hover:text-rose-400 rounded-xl transition"
                    title="Delete gallery"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateCustomerGalleryModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(newG) => {
            setGalleries((prev) => [newG, ...prev]);
            setIsCreateModalOpen(false);
          }}
          accessToken={accessToken}
          onNeedGoogleSignIn={onNeedGoogleSignIn}
        />
      )}

      {selectedGalleryForViewPhotos && (
        <CustomerSelectedPhotosModal
          gallery={selectedGalleryForViewPhotos}
          isOpen={Boolean(selectedGalleryForViewPhotos)}
          onClose={() => setSelectedGalleryForViewPhotos(null)}
          accessToken={accessToken}
          onNeedGoogleSignIn={onNeedGoogleSignIn}
          onUpdated={(updated) => {
            setGalleries((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
            setSelectedGalleryForViewPhotos(updated);
          }}
        />
      )}

      {selectedGalleryForShare && (
        <ShareCustomerGalleryModal
          gallery={selectedGalleryForShare}
          isOpen={Boolean(selectedGalleryForShare)}
          onClose={() => setSelectedGalleryForShare(null)}
        />
      )}

      {selectedGalleryForEdit && (
        <EditCustomerGalleryModal
          gallery={selectedGalleryForEdit}
          isOpen={Boolean(selectedGalleryForEdit)}
          onClose={() => setSelectedGalleryForEdit(null)}
          onUpdated={(updated) => {
            setGalleries((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
            setSelectedGalleryForEdit(null);
          }}
        />
      )}

      {/* Admin High-Resolution ZIP Fulfillment Modal */}
      {selectedGalleryForZipFulfill && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-semibold text-stone-100">
                    Fulfill High-Res ZIP Request
                  </h3>
                  <p className="text-xs text-stone-400">
                    {selectedGalleryForZipFulfill.customerName} • {selectedGalleryForZipFulfill.eventName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGalleryForZipFulfill(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Client Request Details Box */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-xs space-y-2">
              <div className="flex justify-between text-stone-400">
                <span>Selected Count:</span>
                <span className="font-semibold text-amber-400">
                  {selectedGalleryForZipFulfill.zipRequestedCount || selectedGalleryForZipFulfill.selectedCount} photos
                </span>
              </div>
              {selectedGalleryForZipFulfill.zipRequestEmail && (
                <div className="flex justify-between text-stone-400">
                  <span>Client Email:</span>
                  <span className="text-stone-200 font-mono">
                    {selectedGalleryForZipFulfill.zipRequestEmail}
                  </span>
                </div>
              )}
              {selectedGalleryForZipFulfill.zipRequestPhone && (
                <div className="flex justify-between text-stone-400">
                  <span>Client Phone:</span>
                  <span className="text-stone-200">
                    {selectedGalleryForZipFulfill.zipRequestPhone}
                  </span>
                </div>
              )}
              {selectedGalleryForZipFulfill.zipRequestNotes && (
                <div className="pt-2 border-t border-stone-850">
                  <span className="text-stone-500 block mb-1">Client Notes:</span>
                  <p className="text-stone-300 italic bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                    "{selectedGalleryForZipFulfill.zipRequestNotes}"
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveFulfillZip} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  High-Res ZIP Download URL (Google Drive / WeTransfer / Cloud link) <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    required
                    value={zipDownloadUrlInput}
                    onChange={(e) => setZipDownloadUrlInput(e.target.value)}
                    placeholder="https://drive.google.com/file/d/... or download URL"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-purple-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 font-mono transition"
                  />
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Once saved, the client gallery will immediately display a direct "Download High-Res ZIP Archive" button.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Studio Admin Notes (Optional)
                </label>
                <input
                  type="text"
                  value={zipAdminNotesInput}
                  onChange={(e) => setZipAdminNotesInput(e.target.value)}
                  placeholder="e.g. Exported 300DPI Print RAW, Google Drive archive link generated"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-purple-400 focus:outline-hidden text-xs text-stone-200 placeholder:text-stone-600 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-850">
                <button
                  type="button"
                  onClick={() => setSelectedGalleryForZipFulfill(null)}
                  className="px-4 py-2.5 text-stone-400 hover:text-stone-200 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFulfillingZip || !zipDownloadUrlInput.trim()}
                  className="px-5 py-2.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:opacity-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                  <span>{isFulfillingZip ? 'Saving & Notifying...' : 'Save & Fulfill ZIP'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
