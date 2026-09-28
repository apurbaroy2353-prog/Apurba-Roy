import React, { useState, useEffect } from 'react';
import {
  User,
  Heart,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  Edit3,
  Save,
  X,
  Check,
  CheckCircle2,
  Hourglass,
  AlertCircle,
  Copy,
  ExternalLink,
  Sparkles,
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  CreditCard,
  Send,
  MessageCircle,
  ShieldCheck,
  Share2,
  Package,
  Layers,
  ChevronRight,
  Info,
  Building,
  Home,
  FileText,
  BadgeCheck,
  Activity,
  Eye,
  Download,
  Smartphone,
  Monitor,
  RefreshCw,
} from 'lucide-react';
import {
  Album,
  DrivePhoto,
  ClientSelectionSubmission,
  PhotoPaymentRequest,
  ClientProfileData,
  SubmissionStatus,
  ClientActivityLogEntry,
  ClientActivityType,
} from '../types';
import {
  getClientProfile,
  saveClientProfile,
  getSubmissionsForAlbum,
  getPaymentRequestsForAlbum,
  getApprovedDownloads,
  getClientActivityLogs,
  WHATSAPP_SUPPORT_NUMBER,
  WHATSAPP_LINK,
} from '../services/albumStorage';
import { exportFilenamesForLightroom } from '../services/zipDownloader';

interface ClientProfileViewProps {
  album: Album;
  photos: DrivePhoto[];
  selectedIds: Set<string>;
  onBackToGallery: () => void;
  onViewSelectedInGallery: () => void;
  onOpenFaceSearch: () => void;
  onOpenPaymentModal?: () => void;
}

export const ClientProfileView: React.FC<ClientProfileViewProps> = ({
  album,
  photos,
  selectedIds,
  onBackToGallery,
  onViewSelectedInGallery,
  onOpenFaceSearch,
  onOpenPaymentModal,
}) => {
  // Active Profile Section Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'activity_log' | 'timeline' | 'submissions' | 'payments'>('overview');

  // Client Profile state
  const [profile, setProfile] = useState<ClientProfileData>(() => getClientProfile(album));
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<ClientProfileData>(profile);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Submissions, Payments, and Activity Logs
  const [submissions, setSubmissions] = useState<ClientSelectionSubmission[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PhotoPaymentRequest[]>([]);
  const [activityLogs, setActivityLogs] = useState<ClientActivityLogEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'views' | 'selections' | 'payments' | 'downloads'>('all');
  const [copiedSubId, setCopiedSubId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadData = () => {
    setSubmissions(getSubmissionsForAlbum(album.id));
    setPaymentRequests(getPaymentRequestsForAlbum(album.id));
    setActivityLogs(getClientActivityLogs(album.id));
    setProfile(getClientProfile(album));
  };

  // Reload history items
  useEffect(() => {
    loadData();
  }, [album.id]);

  const approvedPhotos = getApprovedDownloads()[album.id] || [];

  // Handle Edit Profile Save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    saveClientProfile(editForm);
    setProfile(editForm);
    setIsEditing(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // Copy Lightroom Filenames helper
  const handleCopyLightroomFilenames = (sub: ClientSelectionSubmission) => {
    const matchedPhotos: DrivePhoto[] = sub.selectedPhotoIds.map((id) => {
      const p = photos.find((photo) => photo.id === id);
      return (
        p || {
          id,
          name: `Photo_${id}.jpg`,
          mimeType: 'image/jpeg',
        }
      );
    });

    const exportText = exportFilenamesForLightroom(matchedPhotos);
    navigator.clipboard.writeText(exportText);
    setCopiedSubId(sub.id);
    setTimeout(() => {
      setCopiedSubId(null);
    }, 2500);
  };

  // Format Date Helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not Specified';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Calculate Days until or since wedding
  const getWeddingTimeLabel = () => {
    const targetDate = profile.weddingDate || album.weddingDate;
    if (!targetDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const wDate = new Date(targetDate);
    wDate.setHours(0, 0, 0, 0);
    const diffTime = wDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today is your Wedding Day! 🎉';
    if (diffDays > 0) return `${diffDays} days until Wedding Day`;
    return `Celebrated ${Math.abs(diffDays)} days ago`;
  };

  // Selection Quota
  const hasLimit = Boolean(album.selectionLimitEnabled && album.maxSelectionsAllowed && album.maxSelectionsAllowed > 0);
  const selectionLimit = album.maxSelectionsAllowed || 0;

  // Build unified chronological timeline of interactions
  interface TimelineEvent {
    id: string;
    date: Date;
    dateFormatted: string;
    type: 'booking' | 'gallery_created' | 'submission' | 'payment' | 'face_search';
    title: string;
    description: string;
    badge: string;
    badgeColor: string;
    extra?: any;
  }

  const timelineEvents: TimelineEvent[] = [];

  // 1. Wedding event / booking
  if (album.weddingDate) {
    timelineEvents.push({
      id: 'event-wedding',
      date: new Date(album.weddingDate),
      dateFormatted: formatDate(album.weddingDate),
      type: 'booking',
      title: 'Wedding Celebration Day',
      description: `Wedding ceremony & celebration for ${profile.coupleNames || album.coupleNames} at ${profile.venue || 'Venue'}.`,
      badge: 'Wedding Day',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    });
  }

  // 2. Album created / gallery uploaded
  if (album.createdAt) {
    timelineEvents.push({
      id: 'event-gallery-created',
      date: new Date(album.createdAt),
      dateFormatted: formatDateTime(album.createdAt),
      type: 'gallery_created',
      title: 'Master Selection Gallery Published',
      description: `RamyaChobi photography team published ${photos.length} master photographs for client review and selection.`,
      badge: `${photos.length} Photos Ready`,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    });
  }

  // 3. Submissions
  submissions.forEach((sub, idx) => {
    timelineEvents.push({
      id: `event-sub-${sub.id}`,
      date: new Date(sub.submittedAt || Date.now()),
      dateFormatted: formatDateTime(sub.submittedAt),
      type: 'submission',
      title: `Photo Selection Submitted (#${submissions.length - idx})`,
      description: `${sub.clientName || 'Client'} submitted ${sub.selectedPhotoIds.length} chosen favorites for album printing and retouching.${
        sub.clientNotes ? ` Note: "${sub.clientNotes}"` : ''
      }`,
      badge: sub.status === 'in_progress' ? 'Draft In Progress' : 'Selection Finalized',
      badgeColor:
        sub.status === 'in_progress'
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      extra: sub,
    });
  });

  // 4. Payments
  paymentRequests.forEach((pay) => {
    timelineEvents.push({
      id: `event-pay-${pay.id}`,
      date: new Date(pay.submittedAt || Date.now()),
      dateFormatted: formatDateTime(pay.submittedAt),
      type: 'payment',
      title: `Photo Payment Order (${pay.paymentMethod})`,
      description: `Payment of ৳${pay.totalAmount} submitted via ${pay.paymentMethod} (TrxID: ${pay.transactionId}) for ${pay.photoIds.length} premium high-res photos. Status: ${pay.status.toUpperCase()}.${
        pay.adminNotes ? ` Note: "${pay.adminNotes}"` : ''
      }`,
      badge: pay.status === 'approved' ? 'Payment Approved' : pay.status === 'pending' ? 'Pending Review' : 'Rejected',
      badgeColor:
        pay.status === 'approved'
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          : pay.status === 'pending'
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          : 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      extra: pay,
    });
  });

  // Relative Time helper for activity logs
  const getRelativeTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Activity stats
  const viewsCount = activityLogs.filter((a) => a.activityType === 'view_gallery').length;
  const selectionsCount = activityLogs.filter(
    (a) =>
      a.activityType === 'select_photo' ||
      a.activityType === 'unselect_photo' ||
      a.activityType === 'submit_selection'
  ).length;
  const paymentsCount = activityLogs.filter((a) => a.activityType === 'make_payment').length;
  const downloadsCount = activityLogs.filter((a) => a.activityType === 'download_photo').length;

  const filteredActivityLogs = activityLogs.filter((log) => {
    if (activityFilter === 'views') return log.activityType === 'view_gallery';
    if (activityFilter === 'selections') {
      return (
        log.activityType === 'select_photo' ||
        log.activityType === 'unselect_photo' ||
        log.activityType === 'submit_selection'
      );
    }
    if (activityFilter === 'payments') return log.activityType === 'make_payment';
    if (activityFilter === 'downloads') return log.activityType === 'download_photo';
    return true;
  });

  // Sort timeline newest first
  timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-24">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="sticky top-0 z-30 bg-stone-950/95 backdrop-blur-md border-b border-stone-850 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={onBackToGallery}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-medium transition"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Back to Photo Gallery</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-stone-400 bg-stone-900/60 px-3 py-1 rounded-xl border border-stone-800">
              <BadgeCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Verified Client Portal</span>
            </span>

            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition"
              title="Chat with Photography Studio"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Studio Support</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Success Alert if profile was saved */}
        {saveSuccessNotice && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in shadow-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Client profile and delivery details updated successfully!</span>
          </div>
        )}

        {/* Hero Client Profile Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-stone-900 border border-stone-800 shadow-2xl">
          {/* Background image overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src={album.coverPhotoUrl || photos[0]?.thumbnailLink || photos[0]?.webViewLink || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80'}
              alt="Wedding Cover"
              className="w-full h-full object-cover opacity-25 filter blur-xs scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-stone-950 via-stone-950/80 to-stone-950/40" />
          </div>

          <div className="relative z-10 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              {/* Couple Info */}
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold backdrop-blur-xs">
                  <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                  <span>{profile.packageType || 'Wedding Client Profile'}</span>
                </div>

                <h1 className="font-serif text-2xl sm:text-4xl text-stone-100 font-medium tracking-tight">
                  {profile.coupleNames || album.coupleNames}
                </h1>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-stone-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{formatDate(profile.weddingDate || album.weddingDate)}</span>
                  </div>

                  {profile.venue && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      <span>{profile.venue}{profile.city ? `, ${profile.city}` : ''}</span>
                    </div>
                  )}

                  {getWeddingTimeLabel() && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[11px]">
                      {getWeddingTimeLabel()}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-200 text-xs font-semibold transition flex items-center gap-2 shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Contact Details</span>
                </button>

                <button
                  onClick={onBackToGallery}
                  className="px-4 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-bold transition flex items-center gap-2 shadow-lg"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Open Gallery ({photos.length})</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-stone-800/80">
              <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-850 backdrop-blur-xs">
                <span className="text-[11px] text-stone-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Total Photos</span>
                </span>
                <p className="text-xl font-serif font-bold text-stone-100 mt-1">{photos.length}</p>
                <p className="text-[10px] text-stone-500">In wedding album</p>
              </div>

              <div
                onClick={onViewSelectedInGallery}
                className="p-3 rounded-2xl bg-stone-950/60 border border-stone-850 backdrop-blur-xs hover:border-rose-500/40 cursor-pointer transition group"
                title="Click to view selected photos in gallery"
              >
                <span className="text-[11px] text-stone-400 flex items-center gap-1.5 group-hover:text-rose-300">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/50" />
                  <span>Selected Favorites</span>
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <p className="text-xl font-serif font-bold text-stone-100 group-hover:text-rose-300">{selectedIds.size}</p>
                  {hasLimit && (
                    <span className="text-xs text-stone-500">/ {selectionLimit}</span>
                  )}
                </div>
                <p className="text-[10px] text-rose-400/80">Click to review in gallery →</p>
              </div>

              <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-850 backdrop-blur-xs">
                <span className="text-[11px] text-stone-400 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Submissions</span>
                </span>
                <p className="text-xl font-serif font-bold text-stone-100 mt-1">{submissions.length}</p>
                <p className="text-[10px] text-stone-500">
                  {submissions.filter(s => s.status !== 'in_progress').length} finalized batches
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-850 backdrop-blur-xs">
                <span className="text-[11px] text-stone-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>Orders & Payments</span>
                </span>
                <p className="text-xl font-serif font-bold text-stone-100 mt-1">{paymentRequests.length}</p>
                <p className="text-[10px] text-stone-500">
                  {paymentRequests.filter(p => p.status === 'approved').length} approved requests
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-850 pb-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Personal Details & Contact</span>
          </button>

          <button
            onClick={() => setActiveTab('activity_log')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'activity_log'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activity Log ({activityLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Interaction History Timeline ({timelineEvents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'submissions'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Selection Submissions ({submissions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payments & Receipts ({paymentRequests.length})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW / PERSONAL DETAILS */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Left 2 Cols: Client Profile & Event Details Card */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif text-base font-semibold text-stone-100">
                        Client Information & Event Venue
                      </h3>
                      <p className="text-[11px] text-stone-400">
                        Used for wedding album proofing, physical print deliveries, and notifications.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-amber-300 text-xs font-medium transition flex items-center gap-1.5 border border-stone-700"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Couple Names</span>
                    <p className="font-medium text-stone-200 text-sm">{profile.coupleNames || album.coupleNames}</p>
                    <p className="text-[11px] text-stone-400">{profile.partner1Name} & {profile.partner2Name}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Contact Email</span>
                    <p className="font-medium text-stone-200 text-sm flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      <span>{profile.email || album.clientEmail || 'None provided'}</span>
                    </p>
                    <p className="text-[10px] text-stone-500">Official gallery updates sent here</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Phone / WhatsApp</span>
                    <p className="font-medium text-stone-200 text-sm flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{profile.phone || '+880 1712-345678'}</span>
                    </p>
                    <p className="text-[10px] text-stone-500">For SMS/WhatsApp album updates</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Wedding Celebration Date</span>
                    <p className="font-medium text-stone-200 text-sm flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-400" />
                      <span>{formatDate(profile.weddingDate || album.weddingDate)}</span>
                    </p>
                    <p className="text-[10px] text-stone-500">{getWeddingTimeLabel()}</p>
                  </div>

                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Event Venue & Location</span>
                    <p className="font-medium text-stone-200 text-sm flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      <span>{profile.venue || 'Villa Corsini a Mezzomonte'} {profile.city ? `(${profile.city})` : ''}</span>
                    </p>
                  </div>

                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Album Physical Delivery Address</span>
                    <p className="font-medium text-stone-200 text-sm flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-amber-400" />
                      <span>{profile.deliveryAddress || 'House 42, Road 11, Banani, Dhaka-1213'}</span>
                    </p>
                    <p className="text-[10px] text-stone-500">Heirloom leather album, photo prints, and USB keepsake box will be dispatched here</p>
                  </div>

                  {profile.clientNotes && (
                    <div className="sm:col-span-2 p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-1">
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Special Client Instructions for Studio</span>
                      <p className="text-stone-300 italic text-xs leading-relaxed">
                        "{profile.clientNotes}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Photographer Notes & Package Details */}
              <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-stone-800">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-semibold text-stone-100">
                      Photographer Instructions & Studio Policy
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      Message from RamyaChobi Studio for this wedding
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-850 text-xs text-stone-300 leading-relaxed space-y-2">
                  <p className="font-semibold text-rose-300">
                    Note for {profile.coupleNames || album.coupleNames}:
                  </p>
                  <p>
                    {album.notesForClient ||
                      'Please heart your favorite photographs for your heirloom wedding album cover, hero spread, and prints. Once satisfied, click "Review & Submit" to lock in your selections for professional color grading.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-stone-950/40 border border-stone-850">
                    <p className="text-[10px] text-stone-500 uppercase font-semibold">Selection Limit</p>
                    <p className="font-semibold text-stone-200 mt-0.5">
                      {hasLimit ? `${selectionLimit} Photos Quota` : 'Unlimited Selections'}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">Current selection: {selectedIds.size} photos</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-stone-950/40 border border-stone-850">
                    <p className="text-[10px] text-stone-500 uppercase font-semibold">High-Res Downloads</p>
                    <p className="font-semibold text-emerald-400 mt-0.5">
                      {album.clientDownloadAllowed !== false ? 'Enabled for Clients' : 'Admin Restricted'}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">{approvedPhotos.length} approved direct downloads</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Quick Actions & Studio Support Card */}
            <div className="space-y-6">
              {/* Studio Support Card */}
              <div className="p-6 rounded-3xl bg-linear-to-b from-stone-900 to-stone-950 border border-stone-800 shadow-xl space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-amber-500/20 to-rose-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Camera className="w-6 h-6 text-amber-400" />
                </div>

                <div>
                  <h3 className="font-serif text-lg font-semibold text-stone-100">
                    রম্যছবি Studio
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Premium Wedding Photography & Heirloom Albums
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-stone-800 text-xs">
                  <div className="flex items-center justify-between text-stone-300">
                    <span className="text-stone-500">Helpline / WhatsApp:</span>
                    <span className="font-mono font-medium">{WHATSAPP_SUPPORT_NUMBER}</span>
                  </div>

                  <div className="flex items-center justify-between text-stone-300">
                    <span className="text-stone-500">Gallery Slug:</span>
                    <span className="font-mono text-[11px] text-amber-300 bg-stone-900 px-2 py-0.5 rounded-md border border-stone-800">
                      {album.slug}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-stone-300">
                    <span className="text-stone-500">Drive Folder:</span>
                    <span className="truncate max-w-[150px] font-medium text-stone-400" title={album.driveFolderName}>
                      {album.driveFolderName}
                    </span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <a
                    href={WHATSAPP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp Direct Support</span>
                  </a>

                  <button
                    onClick={onOpenFaceSearch}
                    className="w-full py-2.5 rounded-2xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-amber-300 font-semibold text-xs transition flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>AI Face Search Self-Finder</span>
                  </button>

                  <button
                    onClick={onViewSelectedInGallery}
                    className="w-full py-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-semibold text-xs transition flex items-center justify-center gap-2"
                  >
                    <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                    <span>View {selectedIds.size} Selected in Gallery</span>
                  </button>
                </div>
              </div>

              {/* Data & Privacy Guarantee */}
              <div className="p-5 rounded-3xl bg-stone-950/80 border border-stone-850 text-xs text-stone-400 space-y-2">
                <div className="flex items-center gap-2 text-stone-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Privacy & Heirlooms Guarantee</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your wedding gallery is privately protected. Selections and notes saved here are synced directly with the photographer's Lightroom production suite.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CLIENT ACTIVITY LOG */}
        {activeTab === 'activity_log' && (
          <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-stone-100 flex items-center gap-2">
                    <span>Client Activity Log</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Live Audit Trail
                    </span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Comprehensive log tracking every time the gallery is viewed, photos are selected, and payments are made.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-850 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-medium transition flex items-center gap-1.5 shadow-xs"
                  title="Reload activity logs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Refresh Log</span>
                </button>
                <span className="text-xs font-mono text-stone-400 bg-stone-950 px-2.5 py-1.5 rounded-xl border border-stone-800">
                  {activityLogs.length} Events Logged
                </span>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                onClick={() => setActivityFilter('views')}
                className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                  activityFilter === 'views'
                    ? 'bg-cyan-500/15 border-cyan-500/50 shadow-md'
                    : 'bg-stone-950/60 border-stone-850 hover:border-cyan-500/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Gallery Visits</span>
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">Total Views</span>
                </div>
                <p className="text-2xl font-serif font-bold text-stone-100 mt-1">{viewsCount}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">Gallery page visits</p>
              </div>

              <div
                onClick={() => setActivityFilter('selections')}
                className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                  activityFilter === 'selections'
                    ? 'bg-rose-500/15 border-rose-500/50 shadow-md'
                    : 'bg-stone-950/60 border-stone-850 hover:border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="flex items-center gap-1.5 text-rose-300 font-medium">
                    <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/40" />
                    <span>Selections</span>
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">Favorites</span>
                </div>
                <p className="text-2xl font-serif font-bold text-stone-100 mt-1">{selectionsCount}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">Hearting & submissions</p>
              </div>

              <div
                onClick={() => setActivityFilter('payments')}
                className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                  activityFilter === 'payments'
                    ? 'bg-amber-500/15 border-amber-500/50 shadow-md'
                    : 'bg-stone-950/60 border-stone-850 hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    <span>Payments</span>
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">bKash/Nagad</span>
                </div>
                <p className="text-2xl font-serif font-bold text-stone-100 mt-1">{paymentsCount}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">Orders & approvals</p>
              </div>

              <div
                onClick={() => setActivityFilter('downloads')}
                className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                  activityFilter === 'downloads'
                    ? 'bg-purple-500/15 border-purple-500/50 shadow-md'
                    : 'bg-stone-950/60 border-stone-850 hover:border-purple-500/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="flex items-center gap-1.5 text-purple-300 font-medium">
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span>Downloads</span>
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">High-Res</span>
                </div>
                <p className="text-2xl font-serif font-bold text-stone-100 mt-1">{downloadsCount}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">Direct photo downloads</p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-800 text-xs">
              <span className="text-stone-500 font-medium mr-1">Filter Log:</span>
              <button
                onClick={() => setActivityFilter('all')}
                className={`px-3 py-1 rounded-xl font-medium transition ${
                  activityFilter === 'all'
                    ? 'bg-stone-800 text-stone-100 shadow-xs'
                    : 'bg-stone-950/60 text-stone-400 hover:text-stone-200 border border-stone-850'
                }`}
              >
                All Activities ({activityLogs.length})
              </button>

              <button
                onClick={() => setActivityFilter('views')}
                className={`px-3 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
                  activityFilter === 'views'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'bg-stone-950/60 text-stone-400 hover:text-stone-200 border border-stone-850'
                }`}
              >
                <Eye className="w-3 h-3 text-cyan-400" />
                <span>Gallery Views ({viewsCount})</span>
              </button>

              <button
                onClick={() => setActivityFilter('selections')}
                className={`px-3 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
                  activityFilter === 'selections'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                    : 'bg-stone-950/60 text-stone-400 hover:text-stone-200 border border-stone-850'
                }`}
              >
                <Heart className="w-3 h-3 text-rose-400" />
                <span>Selections ({selectionsCount})</span>
              </button>

              <button
                onClick={() => setActivityFilter('payments')}
                className={`px-3 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
                  activityFilter === 'payments'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'bg-stone-950/60 text-stone-400 hover:text-stone-200 border border-stone-850'
                }`}
              >
                <CreditCard className="w-3 h-3 text-amber-400" />
                <span>Payments ({paymentsCount})</span>
              </button>

              <button
                onClick={() => setActivityFilter('downloads')}
                className={`px-3 py-1 rounded-xl font-medium transition flex items-center gap-1.5 ${
                  activityFilter === 'downloads'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                    : 'bg-stone-950/60 text-stone-400 hover:text-stone-200 border border-stone-850'
                }`}
              >
                <Download className="w-3 h-3 text-purple-400" />
                <span>Downloads ({downloadsCount})</span>
              </button>
            </div>

            {/* Activity Stream List */}
            {filteredActivityLogs.length === 0 ? (
              <div className="py-12 text-center bg-stone-950/40 rounded-2xl border border-stone-850 space-y-3">
                <Activity className="w-12 h-12 stroke-1 text-stone-600 mx-auto" />
                <h4 className="font-serif text-base text-stone-300">No activities found</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  {activityFilter === 'all'
                    ? 'As the client visits the gallery, selects photographs, and submits payments, activity records will be tracked here.'
                    : `No activities matched the "${activityFilter}" filter.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActivityLogs.map((log) => {
                  // Resolve activity styling
                  let icon = <Eye className="w-4 h-4 text-cyan-400" />;
                  let badge = 'Gallery View';
                  let badgeClass = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
                  let iconBg = 'bg-cyan-500/10 border-cyan-500/20';

                  if (log.activityType === 'select_photo') {
                    icon = <Heart className="w-4 h-4 text-rose-400 fill-rose-400/40" />;
                    badge = 'Photo Selected';
                    badgeClass = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
                    iconBg = 'bg-rose-500/10 border-rose-500/20';
                  } else if (log.activityType === 'unselect_photo') {
                    icon = <Heart className="w-4 h-4 text-stone-400" />;
                    badge = 'Selection Removed';
                    badgeClass = 'bg-stone-800 text-stone-400 border-stone-700';
                    iconBg = 'bg-stone-800 border-stone-700';
                  } else if (log.activityType === 'submit_selection') {
                    icon = <Send className="w-4 h-4 text-emerald-400" />;
                    badge = 'Selection Submitted';
                    badgeClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                    iconBg = 'bg-emerald-500/10 border-emerald-500/20';
                  } else if (log.activityType === 'make_payment') {
                    icon = <CreditCard className="w-4 h-4 text-amber-400" />;
                    badge = 'Payment Order';
                    badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                    iconBg = 'bg-amber-500/10 border-amber-500/20';
                  } else if (log.activityType === 'download_photo') {
                    icon = <Download className="w-4 h-4 text-purple-400" />;
                    badge = 'High-Res Download';
                    badgeClass = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
                    iconBg = 'bg-purple-500/10 border-purple-500/20';
                  } else if (log.activityType === 'face_search') {
                    icon = <Sparkles className="w-4 h-4 text-amber-400" />;
                    badge = 'AI Face Search';
                    badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                    iconBg = 'bg-amber-500/10 border-amber-500/20';
                  }

                  // Photo thumbnail if photoId matches
                  const matchedPhoto = log.metadata?.photoId
                    ? photos.find((p) => p.id === log.metadata?.photoId)
                    : null;

                  return (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl bg-stone-950/70 border border-stone-850 hover:border-stone-750 transition flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${iconBg}`}
                        >
                          {icon}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-serif text-sm font-semibold text-stone-200">
                              {log.title}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass}`}>
                              {badge}
                            </span>
                            {log.clientName && (
                              <span className="text-[11px] text-stone-400 font-medium">
                                by <strong className="text-stone-300">{log.clientName}</strong>
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-stone-300 leading-relaxed max-w-2xl">
                            {log.description}
                          </p>

                          {/* Metadata Pills */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                            {log.metadata?.device && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-stone-400">
                                {log.metadata.device.toLowerCase().includes('mobile') ? (
                                  <Smartphone className="w-3 h-3 text-stone-500" />
                                ) : (
                                  <Monitor className="w-3 h-3 text-stone-500" />
                                )}
                                <span>{log.metadata.device}</span>
                              </span>
                            )}

                            {log.metadata?.paymentMethod && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-medium">
                                <span>{log.metadata.paymentMethod}</span>
                                {log.metadata.amount && <span>৳{log.metadata.amount}</span>}
                              </span>
                            )}

                            {log.metadata?.transactionId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-stone-400 font-mono">
                                <span>TrxID:</span>
                                <strong className="text-amber-300">{log.metadata.transactionId}</strong>
                              </span>
                            )}

                            {log.metadata?.selectionCount !== undefined && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium">
                                <Heart className="w-2.5 h-2.5 fill-rose-400" />
                                <span>{log.metadata.selectionCount} Selected</span>
                              </span>
                            )}

                            {log.metadata?.photoName && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-stone-400 font-mono">
                                <span>File:</span>
                                <span className="text-stone-300">{log.metadata.photoName}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Timestamp & relative time + optional thumbnail */}
                      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-900 text-right">
                        <div>
                          <p className="text-xs font-mono font-medium text-stone-300">
                            {formatDateTime(log.timestamp)}
                          </p>
                          <p className="text-[10px] text-amber-400/90 font-mono">
                            {getRelativeTime(log.timestamp)}
                          </p>
                        </div>

                        {matchedPhoto?.thumbnailLink && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-stone-800 bg-stone-900 shadow-xs">
                            <img
                              src={matchedPhoto.thumbnailLink}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INTERACTION TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-stone-100">
                    Client & Studio Interaction History
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    A comprehensive chronicle of all touchpoints, submissions, payments, and milestones.
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono text-stone-400 bg-stone-950 px-2.5 py-1 rounded-xl border border-stone-800">
                {timelineEvents.length} Events Logged
              </span>
            </div>

            {timelineEvents.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Clock className="w-12 h-12 text-stone-600 mx-auto" />
                <h4 className="font-serif text-base text-stone-300">No interaction events yet</h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  When you select photos or submit requests, your complete history will be displayed in this timeline.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2.5 sm:before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-800">
                {timelineEvents.map((event) => (
                  <div key={event.id} className="relative group">
                    {/* Bullet marker */}
                    <div className="absolute -left-6 sm:-left-8 top-1.5 w-5 h-5 rounded-full bg-stone-950 border-2 border-amber-400 flex items-center justify-center shadow-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl bg-stone-950/70 border border-stone-850 hover:border-stone-750 transition space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif text-sm sm:text-base font-semibold text-stone-200">
                            {event.title}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${event.badgeColor}`}>
                            {event.badge}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-stone-400">
                          {event.dateFormatted}
                        </span>
                      </div>

                      <p className="text-xs text-stone-300 leading-relaxed">
                        {event.description}
                      </p>

                      {/* If event is submission, offer quick action to copy filenames */}
                      {event.type === 'submission' && event.extra && (
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleCopyLightroomFilenames(event.extra)}
                            className="px-3 py-1 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[11px] text-amber-300 font-medium transition flex items-center gap-1.5"
                          >
                            {copiedSubId === event.extra.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Copied Lightroom Filenames</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Lightroom Names</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SELECTION SUBMISSIONS */}
        {activeTab === 'submissions' && (
          <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-stone-100">
                    Photo Selection Submissions History
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Batches of photographs you have submitted for wedding album curation and album design.
                  </p>
                </div>
              </div>

              <button
                onClick={onViewSelectedInGallery}
                className="px-3 py-1.5 rounded-xl bg-linear-to-r from-rose-500 to-amber-500 text-stone-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md"
              >
                <Heart className="w-3.5 h-3.5 fill-stone-950" />
                <span>Current Selection ({selectedIds.size})</span>
              </button>
            </div>

            {submissions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Send className="w-12 h-12 text-stone-600 mx-auto" />
                <h4 className="font-serif text-base text-stone-300">No submissions finalized yet</h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Heart your favorite pictures in the gallery, then click "Review & Submit" to submit your selection batch to the photographer.
                </p>
                <button
                  onClick={onBackToGallery}
                  className="mt-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-amber-300 text-xs font-semibold transition"
                >
                  Go to Gallery to Pick Favorites →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((sub, idx) => {
                  const isCompleted = sub.status !== 'in_progress';
                  const subPhotos = sub.selectedPhotoIds.map((id) => {
                    const found = photos.find((p) => p.id === id);
                    return (
                      found || {
                        id,
                        name: `Photo_${id}.jpg`,
                        mimeType: 'image/jpeg',
                        webViewLink: `https://drive.google.com/uc?id=${id}`,
                      }
                    );
                  });

                  return (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl bg-stone-950/70 border border-stone-850 hover:border-stone-750 transition space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center font-mono font-bold text-amber-400">
                            #{submissions.length - idx}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-serif text-sm sm:text-base font-semibold text-stone-200">
                                {sub.clientName || profile.coupleNames || 'Client Selection'}
                              </h4>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                                  isCompleted
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {isCompleted ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Completed</span>
                                  </>
                                ) : (
                                  <>
                                    <Hourglass className="w-3 h-3 text-amber-400" />
                                    <span>In Progress</span>
                                  </>
                                )}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                              <span>Submitted: {formatDateTime(sub.submittedAt)}</span>
                              <span>•</span>
                              <span className="font-semibold text-amber-300">
                                {sub.selectedPhotoIds.length} Photos
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Export & Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyLightroomFilenames(sub)}
                            className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-xs font-medium text-stone-200 hover:text-amber-300 transition flex items-center gap-1.5"
                            title="Copy list of filenames for Lightroom search"
                          >
                            {copiedSubId === sub.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copied Names</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-amber-400" />
                                <span>Copy Lightroom Names</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {sub.clientNotes && (
                        <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-850 text-xs text-stone-300">
                          <span className="font-semibold text-amber-400">Client Note: </span>
                          <span>"{sub.clientNotes}"</span>
                        </div>
                      )}

                      {/* Photo Thumbnail Strip */}
                      <div>
                        <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-2">
                          Selected Photos in this batch:
                        </p>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                          {subPhotos.map((photo) => (
                            <div
                              key={photo.id}
                              className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-stone-900 border border-stone-800 shadow-xs group"
                              title={photo.name}
                            >
                              <img
                                src={photo.thumbnailLink || photo.webViewLink}
                                alt={photo.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                                loading="lazy"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-0.5 text-[8px] text-stone-300 truncate font-mono">
                                {photo.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PAYMENTS & RECEIPTS */}
        {activeTab === 'payments' && (
          <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-stone-100">
                    Payment Orders & Download Receipts
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Payment verifications for additional paid downloads, canvas prints, or album upgrades.
                  </p>
                </div>
              </div>

              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-xs text-stone-300 hover:text-white transition flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Payment Assistance</span>
              </a>
            </div>

            {paymentRequests.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <CreditCard className="w-12 h-12 text-stone-600 mx-auto" />
                <h4 className="font-serif text-base text-stone-300">No payment requests yet</h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  When you request paid photo downloads via bKash, Nagad, or Rocket, your transaction receipts and approval status will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentRequests.map((pay) => {
                  const isApproved = pay.status === 'approved';
                  const isPending = pay.status === 'pending';

                  return (
                    <div
                      key={pay.id}
                      className="p-5 rounded-2xl bg-stone-950/70 border border-stone-850 hover:border-stone-750 transition space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center font-bold text-emerald-400">
                            ৳
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-serif text-base font-bold text-stone-100">
                                ৳{pay.totalAmount}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-stone-850 text-stone-300 text-xs font-mono font-medium border border-stone-750">
                                {pay.paymentMethod}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                                  isApproved
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : isPending
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                }`}
                              >
                                {isApproved ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Download Unlocked</span>
                                  </>
                                ) : isPending ? (
                                  <>
                                    <Hourglass className="w-3 h-3 text-amber-400" />
                                    <span>Verification Pending</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-3 h-3 text-rose-400" />
                                    <span>Rejected</span>
                                  </>
                                )}
                              </span>
                            </div>

                            <p className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                              <span>TrxID: <strong className="font-mono text-amber-300">{pay.transactionId}</strong></span>
                              <span>•</span>
                              <span>Sender: {pay.senderNumber}</span>
                              <span>•</span>
                              <span>{formatDateTime(pay.submittedAt)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-stone-400">
                            {pay.photoIds.length} {pay.photoIds.length === 1 ? 'Photo' : 'Photos'} in Order
                          </span>
                        </div>
                      </div>

                      {pay.adminNotes && (
                        <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-850 text-xs text-stone-300">
                          <span className="font-semibold text-emerald-400">Studio Verification Note: </span>
                          <span>"{pay.adminNotes}"</span>
                        </div>
                      )}

                      {/* Purchased Photos preview */}
                      {pay.photoIds.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {pay.photoIds.map((id) => {
                            const photo = photos.find((p) => p.id === id);
                            return (
                              <div
                                key={id}
                                className="relative w-14 h-14 rounded-lg overflow-hidden bg-stone-900 border border-stone-800 shrink-0"
                                title={photo?.name || id}
                              >
                                {photo?.thumbnailLink ? (
                                  <img
                                    src={photo.thumbnailLink}
                                    alt={photo.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-500 font-mono">
                                    {id}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT CLIENT PROFILE MODAL */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold text-stone-100">
                    Edit Client & Delivery Details
                  </h3>
                  <p className="text-xs text-stone-400">
                    Update your contact numbers and physical album delivery address
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Partner 1 Full Name
                  </label>
                  <input
                    type="text"
                    value={editForm.partner1Name || ''}
                    onChange={(e) => setEditForm({ ...editForm, partner1Name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                    placeholder="Sophie"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Partner 2 Full Name
                  </label>
                  <input
                    type="text"
                    value={editForm.partner2Name || ''}
                    onChange={(e) => setEditForm({ ...editForm, partner2Name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                    placeholder="Julian Vance"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Combined Couple Display Name
                  </label>
                  <input
                    type="text"
                    value={editForm.coupleNames || ''}
                    onChange={(e) => setEditForm({ ...editForm, coupleNames: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                    placeholder="Sophie & Julian Vance"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Contact Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                    placeholder="client@example.com"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                    placeholder="+880 1712-345678"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Wedding Celebration Date
                  </label>
                  <input
                    type="date"
                    value={editForm.weddingDate || ''}
                    onChange={(e) => setEditForm({ ...editForm, weddingDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Event Venue / Location
                  </label>
                  <input
                    type="text"
                    value={editForm.venue || ''}
                    onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                    placeholder="Villa Corsini a Mezzomonte, Tuscany"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Physical Heirloom Album Delivery Address
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.deliveryAddress || ''}
                    onChange={(e) => setEditForm({ ...editForm, deliveryAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                    placeholder="House, Road, Area, City, Postcode for physical album delivery"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-stone-400 mb-1">
                    Special Client Notes for Photography Team
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.clientNotes || ''}
                    onChange={(e) => setEditForm({ ...editForm, clientNotes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:outline-hidden focus:border-amber-400"
                    placeholder="Specific requests for album cover foil stamping, retouching, etc."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 font-bold transition flex items-center gap-1.5 shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Client Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
