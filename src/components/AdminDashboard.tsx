import React, { useState } from 'react';
import {
  FolderPlus,
  HardDrive,
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
  LogIn,
  LogOut,
  Camera,
  Archive,
  Loader2,
  CheckCircle2,
  Hourglass,
  MessageSquare,
  Mail,
  Clock,
  ArrowRight,
  ArrowUpDown,
  Filter,
  ChevronRight,
  BarChart3,
  X,
  CreditCard,
  Sliders,
  DollarSign,
  ShieldCheck,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Album, ClientSelectionSubmission, SubmissionStatus, CustomerGallery } from '../types';
import { CreateAlbumModal } from './CreateAlbumModal';
import { CreateCustomerGalleryModal } from './CreateCustomerGalleryModal';
import { CustomerGalleriesPanel } from './CustomerGalleriesPanel';
import { ClientSubmissionsViewer } from './ClientSubmissionsViewer';
import { AnalyticsPanel } from './AnalyticsPanel';
import { AdminPaymentVerificationPanel } from './AdminPaymentVerificationPanel';
import { SendEmailNotificationModal, EmailTemplateType } from './SendEmailNotificationModal';
import { IntegratePaymentGatewayModal } from './IntegratePaymentGatewayModal';
import { listPhotosInFolder } from '../services/drive';
import {
  saveAlbum,
  updateSubmissionStatus,
  getStoredPaymentRequests,
  toggleAlbumClientDownloadPermission,
} from '../services/albumStorage';
import {
  downloadSubmissionAsZip,
  exportSelectionToJSON,
  exportSelectionToCSV,
} from '../services/zipDownloader';

interface AdminDashboardProps {
  user: User | null;
  accessToken: string | null;
  albums: Album[];
  submissions: ClientSelectionSubmission[];
  onSignIn: () => void;
  onSignOut: () => void;
  onCreateAlbum: (album: Album) => void;
  onDeleteAlbum: (albumId: string) => void;
  onViewAsClient: (album: Album) => void;
  onOpenCustomerGalleryView?: (gallery: CustomerGallery) => void;
  onRefreshData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  accessToken,
  albums,
  submissions,
  onSignIn,
  onSignOut,
  onCreateAlbum,
  onDeleteAlbum,
  onViewAsClient,
  onOpenCustomerGalleryView,
  onRefreshData,
}) => {
  const [selectedAlbumForDetails, setSelectedAlbumForDetails] = useState<Album | null>(
    albums.length > 0 ? albums[0] : null
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateCustomerGalleryModalOpen, setIsCreateCustomerGalleryModalOpen] = useState(false);
  const [copiedAlbumId, setCopiedAlbumId] = useState<string | null>(null);
  const [syncingAlbumId, setSyncingAlbumId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'customer_galleries' | 'albums' | 'submissions' | 'payments' | 'analytics'>('customer_galleries');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [downloadingSubId, setDownloadingSubId] = useState<string | null>(null);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);

  // Payment Requests data
  const paymentRequests = getStoredPaymentRequests();
  const pendingPaymentsCount = paymentRequests.filter((p) => p.status === 'pending').length;
  const approvedPaymentsRevenue = paymentRequests
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + p.totalAmount, 0);
  const [downloadProgress, setDownloadProgress] = useState<{
    completed: number;
    total: number;
    filename: string;
  } | null>(null);

  // Export to JSON / CSV feedback
  const [exportedFeedback, setExportedFeedback] = useState<{
    subId: string;
    format: 'json' | 'csv';
  } | null>(null);

  const handleExportJSON = (sub: ClientSelectionSubmission, album?: Album | null) => {
    exportSelectionToJSON(sub, album);
    setExportedFeedback({ subId: sub.id, format: 'json' });
    setTimeout(() => setExportedFeedback(null), 2500);
  };

  const handleExportCSV = (sub: ClientSelectionSubmission, album?: Album | null) => {
    exportSelectionToCSV(sub, album);
    setExportedFeedback({ subId: sub.id, format: 'csv' });
    setTimeout(() => setExportedFeedback(null), 2500);
  };

  // Email Notification Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTargetAlbum, setEmailTargetAlbum] = useState<Album | null>(null);
  const [emailInitialTemplate, setEmailInitialTemplate] = useState<EmailTemplateType>('album_ready');
  const [syncToast, setSyncToast] = useState<{
    album: Album;
    count: number;
  } | null>(null);

  const handleOpenEmailModal = (
    album: Album,
    template: EmailTemplateType = 'album_ready',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setEmailTargetAlbum(album);
    setEmailInitialTemplate(template);
    setIsEmailModalOpen(true);
  };

  const handleNotificationSent = (updatedAlbum: Album) => {
    saveAlbum(updatedAlbum);
    onRefreshData();
    if (selectedAlbumForDetails?.id === updatedAlbum.id) {
      setSelectedAlbumForDetails(updatedAlbum);
    }
  };

  const handleBulkDownloadSubmissionZip = async (sub: ClientSelectionSubmission, album?: Album) => {
    const targetAlbum = album || albums.find((a) => a.id === sub.albumId);
    if (!targetAlbum) {
      alert('Could not locate associated album for this submission.');
      return;
    }
    if (downloadingSubId) return;

    setDownloadingSubId(sub.id);
    setDownloadProgress({ completed: 0, total: sub.selectedPhotoIds.length, filename: 'Preparing...' });

    try {
      await downloadSubmissionAsZip(sub, targetAlbum, accessToken, (completed, total, filename) => {
        setDownloadProgress({ completed, total, filename });
      });
    } catch (err) {
      console.error('Download error:', err);
      alert('Error creating zip bundle: ' + (err as Error).message);
    } finally {
      setDownloadingSubId(null);
      setDownloadProgress(null);
    }
  };

  const handleToggleSubmissionStatus = (subId: string, currentStatus: SubmissionStatus | undefined) => {
    const newStatus: SubmissionStatus = currentStatus === 'in_progress' ? 'completed' : 'in_progress';
    updateSubmissionStatus(subId, newStatus);
    onRefreshData();
  };

  const handleCopyLink = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?album=${album.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedAlbumId(album.id);
    setTimeout(() => setCopiedAlbumId(null), 2500);
  };

  const handleSyncDrivePhotos = async (album: Album, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken) {
      onSignIn();
      return;
    }
    if (!album.driveFolderId || album.driveFolderId.startsWith('sample')) {
      alert('This is a demo album. Create a new album with your Google Drive folder to test live syncing.');
      return;
    }

    setSyncingAlbumId(album.id);
    try {
      const photos = await listPhotosInFolder(accessToken, album.driveFolderId);
      const updatedAlbum: Album = {
        ...album,
        cachedPhotos: photos,
        coverPhotoUrl: photos[0]?.thumbnailLink || album.coverPhotoUrl,
        updatedAt: new Date().toISOString(),
      };
      saveAlbum(updatedAlbum);
      onRefreshData();
      if (selectedAlbumForDetails?.id === album.id) {
        setSelectedAlbumForDetails(updatedAlbum);
      }
      setSyncToast({
        album: updatedAlbum,
        count: photos.length,
      });
      setTimeout(() => {
        setSyncToast((prev) => (prev?.album.id === updatedAlbum.id ? null : prev));
      }, 7000);
    } catch (err: any) {
      console.error(err);
      alert('Drive Sync Failed: ' + err.message);
    } finally {
      setSyncingAlbumId(null);
    }
  };

  const filteredAlbums = albums.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.coupleNames.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubmissions = submissions.filter((sub) => {
    const album = albums.find((a) => a.id === sub.albumId);
    const matchesSearch =
      sub.clientName.toLowerCase().includes(submissionSearch.toLowerCase()) ||
      (sub.clientEmail && sub.clientEmail.toLowerCase().includes(submissionSearch.toLowerCase())) ||
      (album && album.title.toLowerCase().includes(submissionSearch.toLowerCase())) ||
      (album && album.coupleNames.toLowerCase().includes(submissionSearch.toLowerCase()));

    const matchesStatus =
      submissionStatusFilter === 'all' ||
      (submissionStatusFilter === 'completed' && sub.status !== 'in_progress') ||
      (submissionStatusFilter === 'in_progress' && sub.status === 'in_progress');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-stone-850 bg-stone-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-rose-500 flex items-center justify-center text-stone-950 font-serif font-bold text-xl shadow-md">
              র
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-medium text-lg text-stone-100">রম্যছবি - RamyaChobi</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Studio Admin
                </span>
              </div>
              <p className="text-[11px] text-stone-400">Wedding Client Proofing, AI Face Search & Payments</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Google Drive Connection Badge / Button */}
            {user && accessToken ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Google Drive Connected ({user.email || user.displayName})</span>
                </div>
                <button
                  onClick={onSignOut}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Disconnect Google Drive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : user && !accessToken ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={onSignIn}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-amber-300 text-xs font-medium flex items-center gap-2 transition cursor-pointer"
                  title="Your Google Drive access token expired. Click to reconnect without losing your account."
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reconnect Drive</span>
                </button>
                <button
                  onClick={onSignOut}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="gsi-material-button px-4 py-2 rounded-xl bg-stone-900 border border-amber-500/40 hover:border-amber-400 text-stone-100 text-xs font-medium transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <div className="w-4 h-4 shrink-0">
                  <svg viewBox="0 0 48 48" className="w-full h-full">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span>Connect Google Drive</span>
              </button>
            )}

            {/* Integrate Payment Gateway Button */}
            <button
              onClick={() => setIsGatewayModalOpen(true)}
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-850 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-2"
              title="Configure Stripe or SSLCommerz payment gateways"
            >
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Integrate Payment Gateway</span>
              <span className="sm:hidden">Gateway</span>
            </button>

            {/* Create Customer Gallery Button */}
            <button
              onClick={() => setIsCreateCustomerGalleryModalOpen(true)}
              className="px-4 py-2 bg-linear-to-r from-amber-500 to-amber-600 hover:opacity-95 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Create Gallery</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-850 border border-stone-750 text-stone-300 hover:text-stone-100 font-semibold text-xs rounded-xl transition flex items-center gap-2"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Create Album</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col gap-8">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div
            onClick={() => setActiveTab('customer_galleries')}
            className={`p-4 rounded-2xl flex items-center gap-3 cursor-pointer transition border ${
              activeTab === 'customer_galleries'
                ? 'bg-stone-850 border-amber-500/60 shadow-lg'
                : 'bg-stone-900/60 border-stone-800 hover:bg-stone-900/90'
            }`}
            title="Click to view Customer Photo Selection Galleries"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-semibold font-serif text-stone-100">Customer</p>
              <p className="text-xs text-stone-400">Galleries & Selection</p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('albums')}
            className={`p-4 rounded-2xl flex items-center gap-3 cursor-pointer transition border ${
              activeTab === 'albums'
                ? 'bg-stone-850 border-amber-500/60 shadow-lg'
                : 'bg-stone-900/60 border-stone-800 hover:bg-stone-900/90'
            }`}
            title="Click to view all galleries"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-semibold font-serif text-stone-100">{albums.length}</p>
              <p className="text-xs text-stone-400">Client Galleries</p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('submissions')}
            className={`p-4 rounded-2xl flex items-center gap-3 cursor-pointer transition border ${
              activeTab === 'submissions'
                ? 'bg-stone-850 border-rose-500/60 shadow-lg'
                : 'bg-stone-900/60 border-stone-800 hover:bg-stone-900/90'
            }`}
            title="Click to view all submissions and bulk download ZIP archives"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-semibold font-serif text-stone-100">{submissions.length}</p>
              <p className="text-xs text-stone-400 flex items-center gap-1">
                <span>Submissions</span>
                <span className="text-[10px] text-rose-400 font-mono">→</span>
              </p>
            </div>
          </div>

          {/* Payment Requests & Verification Shortcut Card */}
          <div
            onClick={() => setActiveTab('payments')}
            className={`p-4 rounded-2xl flex items-center gap-3 cursor-pointer transition border ${
              activeTab === 'payments'
                ? 'bg-stone-850 border-amber-500/60 shadow-lg'
                : 'bg-stone-900/60 border-stone-800 hover:bg-stone-900/90'
            }`}
            title="Click to verify bKash/Nagad/Rocket payments and manage download permissions"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 relative">
              <CreditCard className="w-5 h-5" />
              {pendingPaymentsCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5 animate-ping" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xl font-semibold font-serif text-stone-100">{paymentRequests.length}</p>
                {pendingPaymentsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-stone-950">
                    {pendingPaymentsCount} Pnd
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 flex items-center gap-1">
                <span>পেমেন্ট ও পারমিশন</span>
                <span className="text-[10px] text-amber-400 font-mono">→</span>
              </p>
            </div>
          </div>

          <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-semibold font-serif text-stone-100">
                {albums.reduce((acc, curr) => acc + (curr.cachedPhotos?.length || 0), 0)}
              </p>
              <p className="text-xs text-stone-400">Synced Photos</p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('analytics')}
            className={`p-4 rounded-2xl flex items-center gap-3 cursor-pointer transition border ${
              activeTab === 'analytics'
                ? 'bg-stone-850 border-emerald-500/60 shadow-lg'
                : 'bg-stone-900/60 border-stone-800 hover:bg-stone-900/90'
            }`}
            title="Click to view photo popularity analytics & bar chart"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-semibold font-serif text-stone-100 flex items-center gap-1.5">
                <span>Analytics</span>
                <span className="text-[10px] text-emerald-400 font-mono">→</span>
              </p>
              <p className="text-xs text-stone-400">Popularity Insights</p>
            </div>
          </div>
        </div>

        {/* Workspace Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-850 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('customer_galleries')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'customer_galleries'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-md'
                  : 'text-stone-300 hover:text-stone-100 hover:bg-stone-900/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Customer Galleries</span>
            </button>

            <button
              onClick={() => setActiveTab('albums')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'albums'
                  ? 'bg-stone-800 text-stone-100 border border-stone-700 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>Galleries & Albums ({albums.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'submissions'
                  ? 'bg-stone-800 text-stone-100 border border-stone-700 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-rose-400" />
              <span>Client Submissions & Bulk ZIP ({submissions.length})</span>
              {submissions.some((s) => s.status === 'in_progress') && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'payments'
                  ? 'bg-stone-800 text-stone-100 border border-stone-700 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>পেমেন্ট ভেরিফিকেশন ও ডাউনলোড পারমিশন ({paymentRequests.length})</span>
              {pendingPaymentsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-stone-950 animate-pulse">
                  {pendingPaymentsCount} Pending
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'analytics'
                  ? 'bg-stone-800 text-stone-100 border border-stone-700 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Analytics & Popularity</span>
            </button>
          </div>

          <div className="text-xs text-stone-400">
            {activeTab === 'submissions'
              ? "Bulk export and download clients' selected photos as ZIP archives"
              : activeTab === 'payments'
              ? 'bKash, Nagad ও Rocket Transaction ID যাচাই, অনুমোদন এবং ফটো ডাউনলোড পারমিশন পরিচালনা'
              : activeTab === 'analytics'
              ? 'Visualize most selected photos, client preferences, and popularity rankings'
              : activeTab === 'customer_galleries'
              ? 'Create, manage and track customer wedding photo selection galleries with secure links'
              : 'Manage albums, Google Drive sync, and proofing limits'}
          </div>
        </div>

        {/* Dynamic View: Customer Galleries vs Payments vs Analytics vs Submissions vs Master-Detail Albums */}
        {activeTab === 'customer_galleries' ? (
          <CustomerGalleriesPanel
            accessToken={accessToken}
            onNeedGoogleSignIn={onSignIn}
            onOpenCustomerView={(gallery) => {
              if (onOpenCustomerGalleryView) {
                onOpenCustomerGalleryView(gallery);
              }
            }}
          />
        ) : activeTab === 'payments' ? (
          <AdminPaymentVerificationPanel
            albums={albums}
            paymentRequests={paymentRequests}
            onRefreshData={onRefreshData}
            onOpenGatewayModal={() => setIsGatewayModalOpen(true)}
            onSelectAlbum={(alb) => {
              setSelectedAlbumForDetails(alb);
              setActiveTab('albums');
            }}
          />
        ) : activeTab === 'analytics' ? (
          <AnalyticsPanel
            albums={albums}
            submissions={submissions}
            onViewAsClient={onViewAsClient}
            onSelectAlbum={(alb) => {
              setSelectedAlbumForDetails(alb);
              setActiveTab('albums');
            }}
          />
        ) : activeTab === 'submissions' ? (
          <div className="space-y-6">
            {/* Global Download Progress Toast/Banner if downloading */}
            {downloadingSubId && downloadProgress && (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 shadow-xl space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-200 font-medium flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>
                      Archiving ZIP: <strong className="font-mono text-amber-300">{downloadProgress.filename}</strong>{' '}
                      ({downloadProgress.completed}/{downloadProgress.total} photos)
                    </span>
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {Math.round((downloadProgress.completed / (downloadProgress.total || 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-amber-950">
                  <div
                    className="h-full bg-linear-to-r from-amber-500 to-rose-500 transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        (downloadProgress.completed / (downloadProgress.total || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Submissions Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-stone-900/60 border border-stone-800">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    placeholder="Search by client name, email, or album title..."
                    value={submissionSearch}
                    onChange={(e) => setSubmissionSearch(e.target.value)}
                    className="w-full bg-stone-950/80 border border-stone-800 text-xs rounded-xl pl-9 pr-3 py-2 text-stone-200 placeholder-stone-500 focus:outline-hidden focus:border-amber-400/50"
                  />
                </div>

                <div className="flex items-center gap-1 bg-stone-950/80 border border-stone-800 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setSubmissionStatusFilter('all')}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      submissionStatusFilter === 'all'
                        ? 'bg-stone-800 text-stone-100 shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    All ({submissions.length})
                  </button>
                  <button
                    onClick={() => setSubmissionStatusFilter('completed')}
                    className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                      submissionStatusFilter === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Completed ({submissions.filter((s) => s.status !== 'in_progress').length})</span>
                  </button>
                  <button
                    onClick={() => setSubmissionStatusFilter('in_progress')}
                    className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                      submissionStatusFilter === 'in_progress'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>In Progress ({submissions.filter((s) => s.status === 'in_progress').length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Submissions List */}
            {filteredSubmissions.length === 0 ? (
              <div className="p-16 text-center bg-stone-900/40 rounded-3xl border border-stone-800 text-stone-500 space-y-3">
                <FileCheck className="w-12 h-12 stroke-1 text-stone-600 mx-auto" />
                <h4 className="font-serif text-lg text-stone-300">No submissions found</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  {submissions.length === 0
                    ? 'When clients review and finalize their wedding selections, their submissions and one-click bulk ZIP download will appear here.'
                    : 'No submissions matched your search query or filter criteria.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredSubmissions.map((sub) => {
                  const album = albums.find((a) => a.id === sub.albumId);
                  const isCompleted = sub.status !== 'in_progress';
                  const isThisDownloading = downloadingSubId === sub.id;

                  // Resolve photo thumbnails
                  const allAlbumPhotos = album?.cachedPhotos || [];
                  const previewPhotos = sub.selectedPhotoIds
                    .map((id) => allAlbumPhotos.find((p) => p.id === id))
                    .filter(Boolean)
                    .slice(0, 8);

                  return (
                    <div
                      key={sub.id}
                      className="bg-stone-900/60 border border-stone-800 hover:border-stone-750 p-5 rounded-2xl transition space-y-4 shadow-lg"
                    >
                      {/* Top Row: Client & Album Info + Status */}
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="font-serif text-lg text-stone-100 font-medium">
                              {sub.clientName}
                            </h4>

                            {/* Status Badge with toggle */}
                            <button
                              onClick={() => handleToggleSubmissionStatus(sub.id, sub.status)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition ${
                                isCompleted
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                              }`}
                              title="Click to toggle between Completed and In Progress"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isCompleted ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                                }`}
                              />
                              {isCompleted ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Hourglass className="w-3 h-3 text-amber-400" />
                              )}
                              <span>{isCompleted ? 'Completed' : 'In Progress'}</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400 mt-1">
                            {sub.clientEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-stone-500" />
                                {sub.clientEmail}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-stone-500" />
                              {new Date(sub.submittedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {sub.clientIpOrDevice && (
                              <span className="text-stone-500 font-mono text-[11px]">
                                ({sub.clientIpOrDevice})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Associated Album Tag */}
                        {album && (
                          <div
                            onClick={() => {
                              setSelectedAlbumForDetails(album);
                              setActiveTab('albums');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-stone-950/70 border border-stone-850 hover:border-amber-500/40 cursor-pointer transition flex items-center gap-2 group"
                            title="Click to view album in Master-Detail"
                          >
                            <Camera className="w-3.5 h-3.5 text-amber-400" />
                            <div className="text-right">
                              <p className="text-xs font-medium text-stone-200 group-hover:text-amber-300 transition truncate max-w-[180px]">
                                {album.title}
                              </p>
                              <p className="text-[10px] text-stone-500 truncate">{album.coupleNames}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-stone-600 group-hover:text-amber-400 transition" />
                          </div>
                        )}
                      </div>

                      {/* Client Notes if any */}
                      {sub.clientNotes && (
                        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/30 text-xs text-amber-200/90 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <p className="italic">"{sub.clientNotes}"</p>
                        </div>
                      )}

                      {/* Photo Previews Row */}
                      {previewPhotos.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                          {previewPhotos.map((photo: any, idx: number) => (
                            <div
                              key={photo.id || idx}
                              className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-stone-800 bg-stone-950 relative"
                            >
                              <img
                                src={photo.thumbnailLink || photo.webViewLink}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {sub.selectedPhotoIds.length > previewPhotos.length && (
                            <div className="w-14 h-14 rounded-lg border border-stone-800 bg-stone-950 flex flex-col items-center justify-center text-stone-400 shrink-0 text-xs font-mono font-medium">
                              <span>+{sub.selectedPhotoIds.length - previewPhotos.length}</span>
                              <span className="text-[9px] text-stone-500">more</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bottom Action Bar: Prominent Bulk ZIP Download */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-850">
                        <div className="flex items-center gap-2 text-xs text-stone-400">
                          <FileCheck className="w-4 h-4 text-rose-400" />
                          <span>
                            <strong className="text-stone-200">{sub.selectedPhotoIds.length} Photos</strong>{' '}
                            selected for album proofing
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Lightroom Ingestion Export Buttons */}
                          <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
                            <span className="text-[10px] text-amber-400 font-mono font-semibold px-2 py-0.5 uppercase tracking-wider hidden sm:inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              Lightroom:
                            </span>

                            <button
                              onClick={() => handleExportJSON(sub, album)}
                              className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-850 hover:text-amber-300 text-stone-200 text-xs font-medium border border-stone-800 transition flex items-center gap-1.5 shadow-xs"
                              title="Export client selection as JSON manifest for Adobe Lightroom ingestion"
                            >
                              {exportedFeedback?.subId === sub.id && exportedFeedback.format === 'json' ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-medium">Exported JSON!</span>
                                </>
                              ) : (
                                <>
                                  <FileJson className="w-3.5 h-3.5 text-amber-400" />
                                  <span>JSON</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleExportCSV(sub, album)}
                              className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-850 hover:text-emerald-300 text-stone-200 text-xs font-medium border border-stone-800 transition flex items-center gap-1.5 shadow-xs"
                              title="Export client selection as CSV catalog spreadsheet for Lightroom ingestion"
                            >
                              {exportedFeedback?.subId === sub.id && exportedFeedback.format === 'csv' ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-medium">Exported CSV!</span>
                                </>
                              ) : (
                                <>
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>CSV</span>
                                </>
                              )}
                            </button>
                          </div>

                          {album && (
                            <button
                              onClick={() => onViewAsClient(album)}
                              className="px-3 py-1.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-medium transition flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Gallery</span>
                            </button>
                          )}

                          {/* Primary Bulk ZIP Download Button */}
                          <button
                            onClick={() => handleBulkDownloadSubmissionZip(sub, album)}
                            disabled={Boolean(downloadingSubId) || sub.selectedPhotoIds.length === 0}
                            className="px-4 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-semibold transition flex items-center gap-2 shadow-lg disabled:opacity-40"
                            title="Download all selected photos for this submission as a single ZIP file"
                          >
                            {isThisDownloading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>
                                  Archiving ZIP ({downloadProgress?.completed}/{downloadProgress?.total})...
                                </span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Bulk Download ZIP ({sub.selectedPhotoIds.length} Photos)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        /* Master Detail Section */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Albums List (Left 5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-medium text-stone-100">
                Albums & Galleries
              </h3>
              <div className="relative w-44 sm:w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                <input
                  type="text"
                  placeholder="Search albums..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 text-xs rounded-xl pl-8 pr-3 py-1.5 text-stone-200 placeholder-stone-500 focus:outline-hidden focus:border-amber-400/50"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredAlbums.length === 0 ? (
                <div className="p-8 text-center bg-stone-900/40 rounded-2xl border border-stone-800 text-stone-500 text-xs">
                  No albums found. Click "Create Album" to add one.
                </div>
              ) : (
                filteredAlbums.map((album) => {
                  const isSelected = selectedAlbumForDetails?.id === album.id;
                  const albumSubmissions = submissions.filter((s) => s.albumId === album.id);
                  const isSyncing = syncingAlbumId === album.id;

                  return (
                    <div
                      key={album.id}
                      onClick={() => setSelectedAlbumForDetails(album)}
                      className={`group p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-stone-900 border-amber-500/60 shadow-xl'
                          : 'bg-stone-900/50 border-stone-850 hover:bg-stone-900/80 hover:border-stone-750'
                      }`}
                    >
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-stone-950 overflow-hidden shrink-0 border border-stone-800 relative">
                          <img
                            src={
                              album.coverPhotoUrl ||
                              'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=300&q=80'
                            }
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          {albumSubmissions.length > 0 && (
                            <div className="absolute top-1 right-1 flex items-center gap-1">
                              {albumSubmissions.some((s) => s.status === 'in_progress') ? (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 font-mono text-[9px] font-bold shadow-xs flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-stone-950 animate-ping" />
                                  <span>{albumSubmissions.length}</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-stone-950 font-mono text-[9px] font-bold shadow-xs">
                                  {albumSubmissions.length}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-serif text-sm sm:text-base font-medium text-stone-100 truncate">
                                {album.title}
                              </h4>
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-stone-400 truncate mt-0.5">
                              {album.coupleNames}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-stone-850/60">
                            <div className="flex items-center gap-2 truncate">
                              <span className="truncate flex items-center gap-1">
                                <HardDrive className="w-3 h-3 text-stone-400" />
                                {album.cachedPhotos?.length || 0} photos
                              </span>
                              {album.selectionLimitEnabled && album.maxSelectionsAllowed ? (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono shrink-0">
                                  Cap: {album.maxSelectionsAllowed}
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Notify Client via Email */}
                              <button
                                onClick={(e) =>
                                  handleOpenEmailModal(
                                    album,
                                    album.lastNotifiedAt ? 'gallery_updated' : 'album_ready',
                                    e
                                  )
                                }
                                className="p-1 rounded-md hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition relative"
                                title={
                                  album.lastNotifiedAt
                                    ? `Email Client (Last sent ${new Date(album.lastNotifiedAt).toLocaleDateString()})`
                                    : 'Send Email Notification to Client'
                                }
                              >
                                <Mail className="w-3.5 h-3.5" />
                                {album.lastNotifiedAt && (
                                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                )}
                              </button>

                              {/* Sync Drive */}
                              <button
                                onClick={(e) => handleSyncDrivePhotos(album, e)}
                                className="p-1 rounded-md hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition"
                                title="Refresh / Resync photos from Google Drive"
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`}
                                />
                              </button>

                              {/* Copy Link */}
                              <button
                                onClick={(e) => handleCopyLink(album, e)}
                                className="p-1 rounded-md hover:bg-stone-800 text-stone-400 hover:text-white transition"
                                title="Copy private shareable link"
                              >
                                {copiedAlbumId === album.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Share2 className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* Client View */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewAsClient(album);
                                }}
                                className="p-1 rounded-md hover:bg-stone-800 text-stone-400 hover:text-white transition"
                                title="Preview gallery as client"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Album Details & Submissions Manager (Right 7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {selectedAlbumForDetails ? (
              <div className="space-y-6">
                {/* Album Header Card */}
                <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-mono tracking-wider text-amber-400 uppercase">
                        Active Album Details
                      </span>
                      <h2 className="font-serif text-2xl font-light text-stone-100">
                        {selectedAlbumForDetails.title}
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-stone-400 mt-1">
                        <span>{selectedAlbumForDetails.coupleNames}</span>
                        <span>•</span>
                        <span>{selectedAlbumForDetails.weddingDate}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          handleOpenEmailModal(
                            selectedAlbumForDetails,
                            selectedAlbumForDetails.lastNotifiedAt ? 'gallery_updated' : 'album_ready'
                          )
                        }
                        className="px-3.5 py-2 bg-linear-to-r from-amber-500/20 to-rose-500/20 hover:from-amber-500/30 hover:to-rose-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                        title="Send gallery invitation, update announcement, or selection reminder via email"
                      >
                        <Mail className="w-3.5 h-3.5 text-amber-400" />
                        <span>Notify Client</span>
                        {selectedAlbumForDetails.lastNotifiedAt && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Notified" />
                        )}
                      </button>

                      <button
                        onClick={() => onViewAsClient(selectedAlbumForDetails)}
                        className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Client View</span>
                      </button>
                      <button
                        onClick={(e) => handleCopyLink(selectedAlbumForDetails, e)}
                        className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                      >
                        {copiedAlbumId === selectedAlbumForDetails.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Link Copied</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Shareable Link Box */}
                  <div className="mt-5 p-3 rounded-2xl bg-stone-950/70 border border-stone-850 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-stone-500 uppercase font-mono shrink-0">
                        Private Link:
                      </span>
                      <span className="text-xs text-stone-300 font-mono truncate">
                        {window.location.origin}{window.location.pathname}?album={selectedAlbumForDetails.slug}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleCopyLink(selectedAlbumForDetails, e)}
                      className="text-xs text-amber-400 hover:underline shrink-0 font-medium"
                    >
                      Copy
                    </button>
                  </div>

                  {/* Folder, Limits, Client Email & Pricing info */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-stone-950/40 rounded-xl border border-stone-850/80">
                      <span className="text-stone-500 block mb-1">Google Drive Folder:</span>
                      <span className="text-stone-200 font-medium flex items-center gap-1.5 truncate">
                        <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">{selectedAlbumForDetails.driveFolderName || 'Demo Folder'}</span>
                      </span>
                    </div>

                    <div className="p-3 bg-stone-950/40 rounded-xl border border-stone-850/80">
                      <span className="text-stone-500 block mb-1">Photo Selection Limit:</span>
                      <span className="text-stone-200 font-medium flex items-center gap-1.5">
                        {selectedAlbumForDetails.selectionLimitEnabled && selectedAlbumForDetails.maxSelectionsAllowed ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>Capped at {selectedAlbumForDetails.maxSelectionsAllowed} photos</span>
                          </>
                        ) : selectedAlbumForDetails.maxSelectionsAllowed ? (
                          <span>Target: {selectedAlbumForDetails.maxSelectionsAllowed} photos</span>
                        ) : (
                          <span className="text-stone-400">Unlimited (No cap)</span>
                        )}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-950/40 rounded-xl border border-stone-850/80">
                      <div className="flex items-center justify-between text-stone-500 mb-1">
                        <span>Client Email & Notice:</span>
                        <button
                          onClick={() =>
                            handleOpenEmailModal(
                              selectedAlbumForDetails,
                              selectedAlbumForDetails.lastNotifiedAt ? 'gallery_updated' : 'album_ready'
                            )
                          }
                          className="text-[11px] text-amber-400 hover:underline font-medium"
                        >
                          {selectedAlbumForDetails.lastNotifiedAt ? 'Update' : 'Invite'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-200 font-medium flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{selectedAlbumForDetails.clientEmail || 'No email saved'}</span>
                        </span>
                        {selectedAlbumForDetails.lastNotifiedAt ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 ml-1">
                            Sent {selectedAlbumForDetails.notificationCount || 1}x
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-stone-800 text-stone-400 shrink-0 ml-1">
                            Unnotified
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-stone-950/40 rounded-xl border border-stone-850/80">
                      <div className="flex items-center justify-between text-stone-500 mb-1">
                        <span>Paid Download & Pricing:</span>
                        <button
                          onClick={() => setActiveTab('payments')}
                          className="text-[11px] text-amber-400 hover:underline font-medium"
                        >
                          Manage →
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-200 font-medium flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            {selectedAlbumForDetails.cachedPhotos?.filter((p) => p.isPaid).length || 0} Paid (৳
                            {selectedAlbumForDetails.defaultPhotoPrice || 100})
                          </span>
                        </span>
                        <button
                          onClick={() => {
                            const newStatus = selectedAlbumForDetails.clientDownloadAllowed === false;
                            toggleAlbumClientDownloadPermission(selectedAlbumForDetails.id, newStatus);
                            onRefreshData();
                            setSelectedAlbumForDetails({
                              ...selectedAlbumForDetails,
                              clientDownloadAllowed: newStatus,
                            });
                          }}
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border ${
                            selectedAlbumForDetails.clientDownloadAllowed !== false
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                          title="Click to toggle download permissions for clients"
                        >
                          {selectedAlbumForDetails.clientDownloadAllowed !== false ? 'Download ON' : 'Download OFF'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Danger zone delete */}
                  <div className="mt-4 pt-3 border-t border-stone-850 flex items-center justify-between text-xs">
                    <span className="text-stone-500">
                      Total Photos: {selectedAlbumForDetails.cachedPhotos?.length || 0}
                    </span>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Delete album "${selectedAlbumForDetails.title}" and its submissions?`
                          )
                        ) {
                          onDeleteAlbum(selectedAlbumForDetails.id);
                          setSelectedAlbumForDetails(null);
                        }
                      }}
                      className="text-rose-400/80 hover:text-rose-300 flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Album</span>
                    </button>
                  </div>
                </div>

                {/* Client Submissions & Download Selected Manager */}
                <ClientSubmissionsViewer
                  album={selectedAlbumForDetails}
                  submissions={submissions.filter(
                    (s) => s.albumId === selectedAlbumForDetails.id
                  )}
                  accessToken={accessToken}
                  onRefreshData={onRefreshData}
                  onNotifyClient={handleOpenEmailModal}
                />
              </div>
            ) : (
              <div className="p-16 text-center bg-stone-900/40 rounded-3xl border border-stone-800 text-stone-500 space-y-3">
                <Camera className="w-12 h-12 stroke-1 text-stone-600 mx-auto" />
                <h4 className="font-serif text-lg text-stone-300">No album selected</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Select an album from the left column to view client selections, copy shareable proofing links, or download the selected photo batch.
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Sync Drive Floating Toast Notification with Action to Email Client */}
      {syncToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 border border-amber-500/50 text-stone-100 p-4 rounded-2xl shadow-2xl flex items-center gap-3.5 animate-fade-in max-w-md">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-100">
              Photos Synced ({syncToast.count} photos)
            </p>
            <p className="text-[11px] text-stone-400 truncate">
              Notify {syncToast.album.coupleNames} of the updated gallery?
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                handleOpenEmailModal(syncToast.album, 'gallery_updated');
                setSyncToast(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold transition"
            >
              Email Client
            </button>
            <button
              onClick={() => setSyncToast(null)}
              className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Album Modal */}
      <CreateAlbumModal
        isOpen={isCreateModalOpen}
        accessToken={accessToken}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateAlbum={(album, sendEmailNotification) => {
          onCreateAlbum(album);
          setSelectedAlbumForDetails(album);
          if (sendEmailNotification) {
            handleOpenEmailModal(album, 'album_ready');
          }
        }}
        onNeedGoogleSignIn={onSignIn}
      />

      {/* Send Email Notification Modal */}
      <SendEmailNotificationModal
        isOpen={isEmailModalOpen}
        album={emailTargetAlbum}
        initialTemplate={emailInitialTemplate}
        senderName={user?.displayName || 'রম্যছবি - RamyaChobi Photography'}
        onClose={() => setIsEmailModalOpen(false)}
        onNotificationSent={handleNotificationSent}
      />

      {/* Create Customer Gallery Modal */}
      <CreateCustomerGalleryModal
        isOpen={isCreateCustomerGalleryModalOpen}
        onClose={() => setIsCreateCustomerGalleryModalOpen(false)}
        onCreated={() => {
          setIsCreateCustomerGalleryModalOpen(false);
          setActiveTab('customer_galleries');
        }}
        accessToken={accessToken}
        onNeedGoogleSignIn={onSignIn}
      />

      {/* Integrate Payment Gateway Modal (Stripe & SSLCommerz) */}
      <IntegratePaymentGatewayModal
        isOpen={isGatewayModalOpen}
        onClose={() => setIsGatewayModalOpen(false)}
        onSettingsSaved={() => {
          onRefreshData();
        }}
      />
    </div>
  );
};
