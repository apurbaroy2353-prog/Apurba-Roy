import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Download,
  Lock,
  Unlock,
  AlertCircle,
  Smartphone,
  Eye,
  Sliders,
  DollarSign,
  Zap,
} from 'lucide-react';
import { Album, PhotoPaymentRequest, PaymentStatus, DrivePhoto, PaymentGatewaySettings } from '../types';
import {
  PAYMENT_ACCOUNTS,
  WHATSAPP_SUPPORT_NUMBER,
  WHATSAPP_LINK,
  updatePaymentRequestStatus,
  isPhotoApprovedForClient,
  grantDirectPhotoDownload,
  revokeDirectPhotoDownload,
  togglePhotoPaidStatus,
  togglePhotoDownloadPermission,
  toggleAlbumClientDownloadPermission,
  getPaymentGatewaySettings,
} from '../services/albumStorage';
import { IntegratePaymentGatewayModal } from './IntegratePaymentGatewayModal';

interface AdminPaymentVerificationPanelProps {
  albums: Album[];
  paymentRequests: PhotoPaymentRequest[];
  onRefreshData: () => void;
  onSelectAlbum?: (album: Album) => void;
  onOpenGatewayModal?: () => void;
}

export const AdminPaymentVerificationPanel: React.FC<AdminPaymentVerificationPanelProps> = ({
  albums,
  paymentRequests,
  onRefreshData,
  onSelectAlbum,
  onOpenGatewayModal,
}) => {
  const [internalGatewayModalOpen, setInternalGatewayModalOpen] = useState(false);
  const gatewaySettings = getPaymentGatewaySettings();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTrxId, setCopiedTrxId] = useState<string | null>(null);

  // Filtered requests
  const filteredRequests = paymentRequests.filter((req) => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesAlbum = selectedAlbumId === 'all' || req.albumId === selectedAlbumId;
    const matchesSearch =
      searchQuery === '' ||
      req.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.senderNumber.includes(searchQuery) ||
      req.clientPhone.includes(searchQuery);

    return matchesStatus && matchesAlbum && matchesSearch;
  });

  const pendingCount = paymentRequests.filter((r) => r.status === 'pending').length;
  const approvedCount = paymentRequests.filter((r) => r.status === 'approved').length;
  const totalRevenue = paymentRequests
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const handleCopyTrx = (trx: string) => {
    navigator.clipboard.writeText(trx);
    setCopiedTrxId(trx);
    setTimeout(() => setCopiedTrxId(null), 2500);
  };

  const handleApprove = (req: PhotoPaymentRequest) => {
    updatePaymentRequestStatus(req.id, 'approved', 'Approved by Admin');
    onRefreshData();
  };

  const handleReject = (req: PhotoPaymentRequest) => {
    const reason = prompt('বাতিলের কারণ লিখুন (Reason for rejection, optional):', 'Transaction not found or incorrect amount');
    updatePaymentRequestStatus(req.id, 'rejected', reason || 'Rejected by Admin');
    onRefreshData();
  };

  // Find photo by ID across albums
  const findPhoto = (albumId: string, photoId: string): { photo?: DrivePhoto; album?: Album } => {
    const targetAlbum = albums.find((a) => a.id === albumId);
    const photo = targetAlbum?.cachedPhotos?.find((p) => p.id === photoId);
    return { photo, album: targetAlbum };
  };

  // Direct Permission Toggle
  const handleToggleDirectPermission = (albumId: string, photoId: string, currentlyApproved: boolean) => {
    if (currentlyApproved) {
      revokeDirectPhotoDownload(albumId, photoId);
    } else {
      grantDirectPhotoDownload(albumId, photoId);
    }
    onRefreshData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900/60 p-5 rounded-3xl border border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CreditCard className="w-5 h-5" />
            </span>
            <h2 className="font-serif text-xl font-medium text-stone-100">
              পেমেন্ট ভেরিফিকেশন ও ডাউনলোড পারমিশন
            </h2>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500 text-stone-950 animate-pulse">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-1 max-w-xl">
            ক্লায়েন্টের bKash, Nagad ও Rocket এর Transaction ID যাচাই করুন, অনুমোদন (Approve) দিন এবং ডাউনলোড পারমিশন পরিচালনা করুন।
          </p>
        </div>

        {/* Actions & WhatsApp Support */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              if (onOpenGatewayModal) {
                onOpenGatewayModal();
              } else {
                setInternalGatewayModalOpen(true);
              }
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold transition flex items-center gap-2 shadow-md shadow-amber-950/20"
          >
            <CreditCard className="w-4 h-4" />
            <span>Integrate Payment Gateway</span>
          </button>

          {/* WhatsApp Support info */}
          <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-stone-950 border border-stone-800 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs">
              <p className="text-stone-400 text-[10px]">WhatsApp Helpline:</p>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>{WHATSAPP_SUPPORT_NUMBER}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-stone-100">{pendingCount}</p>
            <p className="text-xs text-stone-400">অপেক্ষমাণ ভেরিফিকেশন (Pending)</p>
            <p className="text-[10px] text-amber-400 mt-0.5 font-mono">
              যাচাইয়ের অপেক্ষায় রয়েছে
            </p>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-stone-100">{approvedCount}</p>
            <p className="text-xs text-stone-400">অনুমোদিত পেমেন্ট (Approved)</p>
            <p className="text-[10px] text-stone-500 mt-0.5 font-mono">
              ডাউনলোড আনলক করা হয়েছে
            </p>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-stone-100">৳{totalRevenue}</p>
            <p className="text-xs text-stone-400">মোট সংগৃহীত পেমেন্ট (BDT)</p>
            <p className="text-[10px] text-emerald-400 mt-0.5 font-mono">
              bKash / Nagad / Cards / Stripe
            </p>
          </div>
        </div>
      </div>

      {/* Payment Gateway Integration Status Banner */}
      <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-stone-200">Online Gateways:</span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border ${
                  gatewaySettings.stripe.enabled
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    : 'bg-stone-800 text-stone-500 border-stone-750'
                }`}
              >
                Stripe: {gatewaySettings.stripe.enabled ? gatewaySettings.stripe.mode.toUpperCase() : 'Disabled'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border ${
                  gatewaySettings.sslcommerz.enabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-stone-800 text-stone-500 border-stone-750'
                }`}
              >
                SSLCommerz: {gatewaySettings.sslcommerz.enabled ? gatewaySettings.sslcommerz.mode.toUpperCase() : 'Disabled'}
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Routing: {gatewaySettings.activeGateway === 'all' ? 'Stripe & SSLCommerz' : gatewaySettings.activeGateway.toUpperCase()}
              {gatewaySettings.allowManualFallback && ' • Manual bKash/Nagad TrxID fallback active'}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (onOpenGatewayModal) {
              onOpenGatewayModal();
            } else {
              setInternalGatewayModalOpen(true);
            }
          }}
          className="px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-850 border border-stone-800 text-amber-300 text-xs font-medium transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
        >
          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
          <span>Configure Gateways</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-stone-900/80 border border-stone-800 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-stone-800 text-stone-100 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              All ({paymentRequests.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <span>Pending ({pendingCount})</span>
              {pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Rejected
            </button>
          </div>

          {/* Album Selector */}
          <select
            value={selectedAlbumId}
            onChange={(e) => setSelectedAlbumId(e.target.value)}
            className="bg-stone-950 border border-stone-800 text-stone-200 text-xs rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-amber-400/50 cursor-pointer"
          >
            <option value="all">All Albums ({albums.length})</option>
            {albums.map((alb) => (
              <option key={alb.id} value={alb.id}>
                {alb.title} ({alb.coupleNames})
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search TrxID or Client Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50 font-mono"
          />
        </div>
      </div>

      {/* Payment Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-stone-900/40 rounded-3xl border border-stone-850">
            <CreditCard className="w-12 h-12 stroke-1 text-stone-700 mx-auto" />
            <h4 className="font-serif text-base text-stone-300">কোনো পেমেন্ট রিকোয়েস্ট পাওয়া যায়নি</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              ক্লায়েন্ট পেইড ছবি সিলেক্ট করে Transaction ID প্রদান করলে এখানে প্রদর্শিত হবে।
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const album = albums.find((a) => a.id === req.albumId);
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            const isRejected = req.status === 'rejected';

            // WhatsApp link to contact client
            const clientWaUrl = `https://wa.me/88${req.clientPhone.replace(/^0+/, '')}?text=${encodeURIComponent(
              `Hello ${req.clientName}, regarding your photo payment (TrxID: ${req.transactionId}) for "${
                album?.title || 'Wedding Gallery'
              }" - `
            )}`;

            return (
              <div
                key={req.id}
                className={`p-4 sm:p-5 rounded-3xl border transition duration-200 ${
                  isPending
                    ? 'bg-stone-900/90 border-amber-500/40 shadow-lg shadow-amber-950/20'
                    : isApproved
                    ? 'bg-stone-950/80 border-emerald-500/30'
                    : 'bg-stone-950/60 border-stone-850 opacity-75'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Client & Payment Details */}
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-base font-semibold text-stone-100">
                        {req.clientName}
                      </span>
                      <span className="text-xs text-stone-400 font-mono">
                        ({req.clientPhone})
                      </span>
                      <span className="text-stone-500">•</span>
                      <span className="text-xs text-amber-300 truncate max-w-xs">
                        {album?.title || req.albumId}
                      </span>
                    </div>

                    {/* Method, TrxID & Amount Pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Payment Method Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-lg font-bold font-mono text-[11px] border ${
                          req.paymentMethod === 'bKash'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : req.paymentMethod === 'Nagad'
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}
                      >
                        {req.paymentMethod}
                      </span>

                      {/* Transaction ID Pill with Copy button */}
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stone-950 border border-stone-800">
                        <span className="text-stone-500 text-[10px]">TrxID:</span>
                        <span className="font-mono font-bold text-amber-300 tracking-wider">
                          {req.transactionId}
                        </span>
                        <button
                          onClick={() => handleCopyTrx(req.transactionId)}
                          className="hover:text-white text-stone-400 p-0.5 rounded transition"
                          title="Copy TrxID"
                        >
                          {copiedTrxId === req.transactionId ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Amount */}
                      <div className="px-3 py-1 rounded-xl bg-stone-950 border border-stone-800 font-mono font-bold text-emerald-400">
                        ৳{req.totalAmount}
                      </div>

                      {/* Status */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                          isPending
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : isApproved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {req.status}
                      </span>

                      {/* Date */}
                      <span className="text-[10px] text-stone-500 font-mono">
                        {new Date(req.submittedAt).toLocaleString()}
                      </span>
                    </div>

                    {req.adminNotes && (
                      <p className="text-[11px] text-stone-400 italic">
                        নোট: "{req.adminNotes}"
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* WhatsApp Client Button */}
                    <a
                      href={clientWaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-emerald-400 border border-stone-750 text-xs font-medium transition flex items-center gap-1.5"
                      title="Chat with client on WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>

                    {/* Approve Button */}
                    {!isApproved && (
                      <button
                        onClick={() => handleApprove(req)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-md"
                        title="Approve transaction & unlock photo downloads"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve (অনুমোদন)</span>
                      </button>
                    )}

                    {/* Reject Button */}
                    {!isRejected && (
                      <button
                        onClick={() => handleReject(req)}
                        className="px-3 py-2 rounded-xl bg-stone-850 hover:bg-rose-950/60 hover:border-rose-500/50 text-stone-400 hover:text-rose-300 border border-stone-750 text-xs font-medium transition flex items-center gap-1"
                        title="Reject transaction"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Requested Photos Thumbnails Strip */}
                <div className="mt-3.5 pt-3 border-t border-stone-850 flex flex-wrap items-center gap-2.5">
                  <span className="text-[11px] text-stone-500 font-medium">আবেদনকৃত ফটো:</span>
                  {req.photoIds.map((pId) => {
                    const { photo } = findPhoto(req.albumId, pId);
                    const isApprovedForDownload = isPhotoApprovedForClient(req.albumId, pId);

                    return (
                      <div
                        key={pId}
                        className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs"
                      >
                        {photo?.thumbnailLink ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-stone-900 shrink-0">
                            <img src={photo.thumbnailLink} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 text-stone-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono text-stone-200 truncate max-w-[140px]">
                            {photo?.name || pId}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-amber-400 font-mono">
                              ৳{photo?.price || 100}
                            </span>
                            <span className="text-stone-600">•</span>
                            <button
                              onClick={() => handleToggleDirectPermission(req.albumId, pId, isApprovedForDownload)}
                              className={`text-[10px] font-medium transition hover:underline flex items-center gap-0.5 ${
                                isApprovedForDownload ? 'text-emerald-400' : 'text-stone-500'
                              }`}
                              title="Toggle client download permission for this photo"
                            >
                              {isApprovedForDownload ? (
                                <>
                                  <Unlock className="w-2.5 h-2.5" />
                                  <span>Permission ON</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Permission OFF</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Album Photo Pricing & Permission Quick Manager */}
      <div className="p-5 rounded-3xl bg-stone-900/60 border border-stone-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div>
            <h3 className="font-serif text-base font-semibold text-stone-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>ফটোর দাম নির্ধারণ ও পারমিশন কন্ট্রোল (Photo Pricing & Permissions)</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              যেকোনো ফটো Free বা Paid হিসেবে সেট করুন, দাম পরিবর্তন করুন এবং ক্লায়েন্টের ডাউনলোড পারমিশন অন/অফ করুন।
            </p>
          </div>
          <span className="text-xs text-stone-400 font-mono">
            {albums.length} Active Galleries
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {albums.map((alb) => {
            const isClientAllowed = alb.clientDownloadAllowed !== false;

            return (
              <div
                key={alb.id}
                className="bg-stone-950 p-4 rounded-2xl border border-stone-850 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-serif text-sm font-semibold text-stone-100">{alb.title}</h4>
                    <p className="text-[11px] text-stone-400">{alb.coupleNames}</p>
                  </div>
                  {/* Master Album Download Toggle */}
                  <button
                    onClick={() => {
                      toggleAlbumClientDownloadPermission(alb.id, !isClientAllowed);
                      onRefreshData();
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border ${
                      isClientAllowed
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                    title="Toggle client downloads for entire album"
                  >
                    {isClientAllowed ? (
                      <>
                        <Unlock className="w-3 h-3 text-emerald-400" />
                        <span>Client Download ON</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-rose-400" />
                        <span>Client Download OFF</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Photo Items Mini Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {alb.cachedPhotos?.map((p) => {
                    const isPaid = Boolean(p.isPaid);
                    const isPhotoDisabled = Boolean(p.downloadDisabled);
                    const price = p.price || alb.defaultPhotoPrice || 100;

                    return (
                      <div
                        key={p.id}
                        className="p-2 rounded-xl bg-stone-900 border border-stone-800 space-y-1.5 text-[11px]"
                      >
                        <p className="font-mono text-[10px] text-stone-300 truncate" title={p.name}>
                          {p.name}
                        </p>
                        <div className="flex items-center justify-between">
                          {/* Toggle Paid/Free button */}
                          <button
                            onClick={() => {
                              const newPaid = !isPaid;
                              let newPrice = price;
                              if (newPaid) {
                                const input = prompt(`Enter price in BDT (৳) for ${p.name}:`, String(price));
                                if (input) newPrice = Number(input) || price;
                              }
                              togglePhotoPaidStatus(alb.id, p.id, newPaid, newPrice);
                              onRefreshData();
                            }}
                            className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] transition ${
                              isPaid
                                ? 'bg-amber-500 text-stone-950 hover:bg-amber-400'
                                : 'bg-emerald-500 text-stone-950 hover:bg-emerald-400'
                            }`}
                            title="Click to toggle Paid/Free & Price"
                          >
                            {isPaid ? `PAID ৳${price}` : 'FREE'}
                          </button>

                          {/* Toggle Photo Download Disabled button */}
                          <button
                            onClick={() => {
                              togglePhotoDownloadPermission(alb.id, p.id, !isPhotoDisabled);
                              onRefreshData();
                            }}
                            className={`p-1 rounded hover:bg-stone-800 transition ${
                              isPhotoDisabled ? 'text-rose-400' : 'text-stone-400 hover:text-stone-200'
                            }`}
                            title={isPhotoDisabled ? 'Photo download blocked' : 'Photo download allowed'}
                          >
                            {isPhotoDisabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integrate Payment Gateway Modal fallback */}
      <IntegratePaymentGatewayModal
        isOpen={internalGatewayModalOpen}
        onClose={() => setInternalGatewayModalOpen(false)}
        onSettingsSaved={() => onRefreshData()}
      />
    </div>
  );
};
