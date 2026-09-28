import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Trophy,
  Flame,
  Award,
  Sparkles,
  Download,
  Copy,
  Check,
  Filter,
  Camera,
  Users,
  Calendar,
  Layers,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Percent,
  Eye,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Album, ClientSelectionSubmission, DrivePhoto } from '../types';

interface AnalyticsPanelProps {
  albums: Album[];
  submissions: ClientSelectionSubmission[];
  onViewAsClient?: (album: Album) => void;
  onSelectAlbum?: (album: Album) => void;
}

export interface PhotoPopularityStat {
  photoId: string;
  name: string;
  photo?: DrivePhoto;
  album?: Album;
  albumId: string;
  albumTitle: string;
  coupleNames: string;
  count: number;
  percentage: number;
  selectedByClients: {
    clientName: string;
    clientEmail?: string;
    submittedAt: string;
    status?: string;
  }[];
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  albums,
  submissions,
  onViewAsClient,
  onSelectAlbum,
}) => {
  // Filter States
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [topLimit, setTopLimit] = useState<number>(10);
  const [metricMode, setMetricMode] = useState<'count' | 'percentage'>('count');
  const [copiedShotList, setCopiedShotList] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<DrivePhoto | null>(null);

  // 1. Filter submissions based on album & status
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchesAlbum = selectedAlbumId === 'all' || sub.albumId === selectedAlbumId;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' && sub.status !== 'in_progress') ||
        (statusFilter === 'in_progress' && sub.status === 'in_progress');
      return matchesAlbum && matchesStatus;
    });
  }, [submissions, selectedAlbumId, statusFilter]);

  // 2. Build dictionary of all available photos across relevant albums
  const photoLookup = useMemo(() => {
    const map = new Map<string, { photo: DrivePhoto; album: Album }>();
    albums.forEach((album) => {
      if (album.cachedPhotos) {
        album.cachedPhotos.forEach((photo) => {
          map.set(photo.id, { photo, album });
        });
      }
    });
    return map;
  }, [albums]);

  // 3. Compute popularity statistics
  const { popularityList, totalSelectionsCount, maxCount, uniquePhotosCount } = useMemo(() => {
    const statsMap = new Map<string, PhotoPopularityStat>();
    let totalPicks = 0;

    filteredSubmissions.forEach((sub) => {
      const album = albums.find((a) => a.id === sub.albumId);
      sub.selectedPhotoIds.forEach((photoId) => {
        totalPicks++;
        const lookedUp = photoLookup.get(photoId);
        const photo = lookedUp?.photo;
        const resolvedAlbum = album || lookedUp?.album;

        const current = statsMap.get(photoId);
        if (current) {
          current.count++;
          current.selectedByClients.push({
            clientName: sub.clientName,
            clientEmail: sub.clientEmail,
            submittedAt: sub.submittedAt,
            status: sub.status,
          });
        } else {
          statsMap.set(photoId, {
            photoId,
            name: photo?.name || `Photo ${photoId}`,
            photo,
            album: resolvedAlbum,
            albumId: resolvedAlbum?.id || sub.albumId,
            albumTitle: resolvedAlbum?.title || 'Unknown Gallery',
            coupleNames: resolvedAlbum?.coupleNames || '',
            count: 1,
            percentage: 0,
            selectedByClients: [
              {
                clientName: sub.clientName,
                clientEmail: sub.clientEmail,
                submittedAt: sub.submittedAt,
                status: sub.status,
              },
            ],
          });
        }
      });
    });

    const totalSubmissionsCount = filteredSubmissions.length || 1;
    const list: PhotoPopularityStat[] = Array.from(statsMap.values()).map((item) => ({
      ...item,
      percentage: Math.round((item.count / totalSubmissionsCount) * 100),
    }));

    // Sort descending by count, then alphabetically by name
    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    const max = list.length > 0 ? list[0].count : 1;

    return {
      popularityList: list,
      totalSelectionsCount: totalPicks,
      maxCount: max,
      uniquePhotosCount: list.length,
    };
  }, [filteredSubmissions, albums, photoLookup]);

  // Sliced list for display
  const displayedPhotos = useMemo(() => {
    if (topLimit === 0) return popularityList;
    return popularityList.slice(0, topLimit);
  }, [popularityList, topLimit]);

  // Overall Catalog Photos in current scope
  const totalCatalogPhotos = useMemo(() => {
    if (selectedAlbumId === 'all') {
      return albums.reduce((acc, curr) => acc + (curr.cachedPhotos?.length || 0), 0);
    }
    const target = albums.find((a) => a.id === selectedAlbumId);
    return target?.cachedPhotos?.length || 0;
  }, [albums, selectedAlbumId]);

  const avgSelectionsPerClient =
    filteredSubmissions.length > 0
      ? (totalSelectionsCount / filteredSubmissions.length).toFixed(1)
      : '0';

  const catalogCoveragePct =
    totalCatalogPhotos > 0
      ? Math.round((uniquePhotosCount / totalCatalogPhotos) * 100)
      : 0;

  // Category / Moment distribution insights
  const momentInsights = useMemo(() => {
    const momentKeywords = [
      { key: 'First Look', pattern: /firstlook|first_look|first-look/i },
      { key: 'Ceremony & Vows', pattern: /ceremony|vows|aisle|ring|altar/i },
      { key: 'Golden Hour / Portraits', pattern: /portrait|golden|sunset|hills|embrace|kiss/i },
      { key: 'Reception & Dance', pattern: /dance|reception|cake|champagne|toast/i },
      { key: 'Night & Sparklers', pattern: /sparkler|exit|night|fireworks/i },
    ];

    const distribution = momentKeywords.map((mk) => {
      let count = 0;
      popularityList.forEach((item) => {
        if (mk.pattern.test(item.name)) {
          count += item.count;
        }
      });
      return {
        label: mk.key,
        count,
        percentage: totalSelectionsCount > 0 ? Math.round((count / totalSelectionsCount) * 100) : 0,
      };
    });

    return distribution.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  }, [popularityList, totalSelectionsCount]);

  // Export CSV
  const handleExportCSV = () => {
    if (popularityList.length === 0) return;
    const headers = ['Rank', 'Photo Name', 'Photo ID', 'Gallery Name', 'Couple Names', 'Selections Count', 'Popularity Rate (%)', 'Selected By Clients'];
    const rows = popularityList.map((item, index) => {
      const clients = item.selectedByClients.map((c) => c.clientName).join('; ');
      return [
        index + 1,
        `"${item.name.replace(/"/g, '""')}"`,
        item.photoId,
        `"${item.albumTitle.replace(/"/g, '""')}"`,
        `"${item.coupleNames.replace(/"/g, '""')}"`,
        item.count,
        `${item.percentage}%`,
        `"${clients.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lumiere_photo_popularity_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Lightroom Filter Shot List
  const handleCopyLightroomFilenames = () => {
    if (popularityList.length === 0) return;
    const names = popularityList.map((p) => p.name.replace(/\.[^/.]+$/, '')).join(', ');
    navigator.clipboard.writeText(names);
    setCopiedShotList(true);
    setTimeout(() => setCopiedShotList(false), 2500);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header & Analytics Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900/60 p-5 rounded-3xl border border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h2 className="font-serif text-xl font-medium text-stone-100">
              Photo Selection Analytics
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live Popularity
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1 max-w-xl">
            Visualizing the most requested, hearted, and shortlisted photographs across client galleries to reveal couple favorites and editorial insights.
          </p>
        </div>

        {/* Action Buttons: Export CSV & Lightroom Shotlist */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyLightroomFilenames}
            disabled={popularityList.length === 0}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
              copiedShotList
                ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                : 'bg-stone-850 hover:bg-stone-800 border-stone-750 text-stone-300'
            }`}
            title="Copy popular photo filenames for Lightroom Library filter"
          >
            {copiedShotList ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied for Lightroom!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copy Lightroom Selects</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            disabled={popularityList.length === 0}
            className="px-3.5 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-semibold transition flex items-center gap-1.5 shadow-md"
            title="Export full popularity data as CSV spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Most Popular Photo Card */}
        <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-2xl flex items-center gap-3.5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          {popularityList.length > 0 && popularityList[0].photo ? (
            <div
              className="w-14 h-14 rounded-xl overflow-hidden bg-stone-950 border border-amber-500/40 shrink-0 cursor-pointer relative group/img shadow-md"
              onClick={() => setPreviewPhoto(popularityList[0].photo || null)}
              title="Click to preview #1 favorite photo"
            >
              <img
                src={popularityList[0].photo.thumbnailLink || popularityList[0].photo.webViewLink}
                alt=""
                className="w-full h-full object-cover group-hover/img:scale-110 transition duration-300"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                <Eye className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              #1 Top Favorite
            </span>
            <p className="text-sm font-semibold text-stone-100 truncate font-mono">
              {popularityList.length > 0 ? popularityList[0].name : 'No selections'}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              {popularityList.length > 0
                ? `${popularityList[0].count} picks (${popularityList[0].percentage}% of couples)`
                : 'Awaiting submissions'}
            </p>
          </div>
        </div>

        {/* Total Picks Card */}
        <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-stone-100">{totalSelectionsCount}</p>
            <p className="text-xs text-stone-400">Total Selections Made</p>
            <p className="text-[10px] text-stone-500 mt-0.5 font-mono">
              across {filteredSubmissions.length} client submissions
            </p>
          </div>
        </div>

        {/* Avg Selections per Client */}
        <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-stone-100">{avgSelectionsPerClient}</p>
            <p className="text-xs text-stone-400">Avg. Photos / Client</p>
            <p className="text-[10px] text-stone-500 mt-0.5 font-mono">
              per proofing shortlist
            </p>
          </div>
        </div>

        {/* Unique Photos Selected / Coverage */}
        <div className="bg-stone-900/60 border border-stone-800 p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-stone-100">
              {uniquePhotosCount}{' '}
              <span className="text-xs font-normal text-stone-400 font-sans">
                / {totalCatalogPhotos}
              </span>
            </p>
            <p className="text-xs text-stone-400">Catalog Coverage</p>
            <p className="text-[10px] text-emerald-400 mt-0.5 font-mono font-medium">
              {catalogCoveragePct}% of gallery selected
            </p>
          </div>
        </div>
      </div>

      {/* Filter and View Customization Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-stone-900/80 border border-stone-800 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Gallery Scope Dropdown */}
          <div className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              className="bg-stone-950 border border-stone-800 hover:border-stone-750 text-stone-200 text-xs rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-amber-400/50 cursor-pointer"
            >
              <option value="all">All Galleries ({albums.length})</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title} ({album.coupleNames})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-stone-950 border border-stone-800 hover:border-stone-750 text-stone-200 text-xs rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-amber-400/50 cursor-pointer"
            >
              <option value="all">All Submissions</option>
              <option value="completed">Completed Only</option>
              <option value="in_progress">In Progress Drafts</option>
            </select>
          </div>

          {/* Top Limit Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400">Show:</span>
            <select
              value={topLimit}
              onChange={(e) => setTopLimit(Number(e.target.value))}
              className="bg-stone-950 border border-stone-800 hover:border-stone-750 text-stone-200 text-xs rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-amber-400/50 cursor-pointer"
            >
              <option value={5}>Top 5 Photos</option>
              <option value={10}>Top 10 Photos</option>
              <option value={20}>Top 20 Photos</option>
              <option value={0}>All Selected Photos ({popularityList.length})</option>
            </select>
          </div>
        </div>

        {/* Metric Toggle: Count vs % */}
        <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800">
          <button
            onClick={() => setMetricMode('count')}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              metricMode === 'count'
                ? 'bg-stone-800 text-stone-100 shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Selection Count
          </button>
          <button
            onClick={() => setMetricMode('percentage')}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              metricMode === 'percentage'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Percent className="w-3 h-3" />
            <span>Popularity %</span>
          </button>
        </div>
      </div>

      {/* Main Bar Chart Section */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-3xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
          <div>
            <h3 className="font-serif text-lg font-medium text-stone-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <span>Most Selected Photographs</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Ranked by frequency across client proofing shortlists. Bar length represents relative popularity.
            </p>
          </div>
          <div className="text-xs text-stone-400 font-mono">
            Showing {displayedPhotos.length} of {popularityList.length} shortlisted photos
          </div>
        </div>

        {displayedPhotos.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Camera className="w-12 h-12 stroke-1 text-stone-700 mx-auto" />
            <h4 className="font-serif text-base text-stone-400">No photo selection data recorded</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Once clients heart and submit selections from their galleries, popularity rankings and bar chart metrics will populate here automatically.
            </p>
          </div>
        ) : (
          /* The Bar Chart Visualization */
          <div className="space-y-4">
            {displayedPhotos.map((item, index) => {
              const rank = index + 1;
              const barWidthPercent = Math.max(10, Math.round((item.count / maxCount) * 100));

              // Colors based on rank
              const isGold = rank === 1;
              const isSilver = rank === 2;
              const isBronze = rank === 3;

              return (
                <div
                  key={item.photoId}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition duration-200 hover:border-stone-700 group ${
                    isGold
                      ? 'bg-stone-900/90 border-amber-500/30 shadow-md shadow-amber-950/20'
                      : 'bg-stone-950/70 border-stone-850'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                    {/* Left: Rank Badge + Thumbnail + Details */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank Indicator */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          isGold
                            ? 'bg-amber-400 text-stone-950 shadow-sm shadow-amber-500/50'
                            : isSilver
                            ? 'bg-stone-300 text-stone-950'
                            : isBronze
                            ? 'bg-amber-700/80 text-stone-100'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                        title={`Rank #${rank}`}
                      >
                        {isGold ? <Trophy className="w-3.5 h-3.5" /> : `#${rank}`}
                      </div>

                      {/* Photo Thumbnail */}
                      <div
                        onClick={() => item.photo && setPreviewPhoto(item.photo)}
                        className="w-12 h-12 rounded-xl overflow-hidden bg-stone-900 border border-stone-800 shrink-0 cursor-pointer relative group/img shadow-sm"
                        title="Click to view large preview"
                      >
                        {item.photo?.thumbnailLink || item.photo?.webViewLink ? (
                          <img
                            src={item.photo.thumbnailLink || item.photo.webViewLink}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover/img:scale-110 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-600">
                            <Camera className="w-5 h-5" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                          <Eye className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>

                      {/* Title & Album Pill */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono font-semibold text-stone-100 truncate group-hover:text-amber-300 transition">
                            {item.name}
                          </p>
                          {isGold && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 text-[10px] font-medium border border-amber-400/30">
                              Top Pick
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mt-0.5">
                          {item.album && (
                            <span
                              onClick={() => onSelectAlbum && onSelectAlbum(item.album!)}
                              className="hover:text-amber-300 cursor-pointer transition truncate max-w-[200px]"
                              title={`Gallery: ${item.albumTitle}`}
                            >
                              {item.albumTitle}
                            </span>
                          )}
                          {item.coupleNames && (
                            <span className="text-stone-500">• {item.coupleNames}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Numerical Metrics Badge */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold font-mono text-stone-100">
                            {metricMode === 'count' ? item.count : `${item.percentage}%`}
                          </span>
                          <span className="text-xs text-stone-400">
                            {metricMode === 'count'
                              ? item.count === 1
                                ? 'selection'
                                : 'selections'
                              : 'of couples'}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 font-mono">
                          {metricMode === 'count'
                            ? `${item.percentage}% pick rate`
                            : `${item.count} total selections`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* The Horizontal Bar Track */}
                  <div className="w-full h-3 bg-stone-900 rounded-full overflow-hidden border border-stone-800/80 relative">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isGold
                          ? 'bg-linear-to-r from-amber-400 via-rose-400 to-amber-500 shadow-sm shadow-amber-500/40'
                          : isSilver
                          ? 'bg-linear-to-r from-stone-300 to-amber-300'
                          : isBronze
                          ? 'bg-linear-to-r from-amber-600 to-amber-400'
                          : 'bg-linear-to-r from-stone-600 to-amber-500/70'
                      }`}
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>

                  {/* Client Breakdown Tagline */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
                    <span className="text-stone-500 font-medium">Selected by:</span>
                    {item.selectedByClients.slice(0, 4).map((c, cIdx) => (
                      <span
                        key={cIdx}
                        className="px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-stone-300 text-[10px] font-sans"
                      >
                        {c.clientName}
                      </span>
                    ))}
                    {item.selectedByClients.length > 4 && (
                      <span className="text-[10px] text-stone-500">
                        +{item.selectedByClients.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Podium Top 3 Visual Gallery & Category Breakdown Grid */}
      {popularityList.length >= 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top 3 Podium Highlights */}
          <div className="lg:col-span-2 bg-stone-900/60 border border-stone-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-serif text-base font-medium text-stone-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Client Choice Podium (Top 3)</span>
              </h3>
              <span className="text-xs text-stone-400 font-mono">Gold • Silver • Bronze</span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {popularityList.slice(0, 3).map((item, idx) => {
                const medals = [
                  { label: 'Gold Favorite', color: 'border-amber-400/60 bg-amber-400/10 text-amber-300', badge: '1st' },
                  { label: 'Silver Select', color: 'border-stone-400/60 bg-stone-400/10 text-stone-300', badge: '2nd' },
                  { label: 'Bronze Select', color: 'border-amber-700/60 bg-amber-700/10 text-amber-400', badge: '3rd' },
                ];
                const medal = medals[idx];

                return (
                  <div
                    key={item.photoId}
                    className="bg-stone-950 rounded-2xl border border-stone-850 p-2.5 flex flex-col group relative overflow-hidden"
                  >
                    <div
                      onClick={() => item.photo && setPreviewPhoto(item.photo)}
                      className="aspect-4/5 rounded-xl overflow-hidden bg-stone-900 relative cursor-pointer"
                    >
                      {item.photo?.thumbnailLink || item.photo?.webViewLink ? (
                        <img
                          src={item.photo.thumbnailLink || item.photo.webViewLink}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-700">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono border backdrop-blur-md z-10 shadow-sm" style={{ backgroundColor: idx === 0 ? 'rgba(251, 191, 36, 0.9)' : idx === 1 ? 'rgba(214, 211, 209, 0.9)' : 'rgba(180, 83, 9, 0.9)', color: '#0c0a09' }}>
                        {medal.badge}
                      </div>
                    </div>

                    <div className="mt-2.5 px-0.5 space-y-0.5">
                      <p className="text-[11px] font-mono font-medium text-stone-200 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-amber-400 font-semibold font-mono">
                        {item.count} picks ({item.percentage}%)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Wedding Moment Popularity Distribution */}
          <div className="bg-stone-900/60 border border-stone-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-serif text-base font-medium text-stone-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-400" />
                <span>Favorite Moments</span>
              </h3>
              <span className="text-[11px] text-stone-500 font-mono">Phase Breakdown</span>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              Distribution of client shortlists across key wedding photography milestones:
            </p>

            <div className="space-y-3">
              {momentInsights.map((moment, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-300 font-medium">{moment.label}</span>
                    <span className="text-stone-400 font-mono">
                      {moment.count} picks ({moment.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-850">
                    <div
                      className="h-full bg-linear-to-r from-amber-500 to-rose-500 rounded-full"
                      style={{ width: `${moment.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Lightbox Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] bg-stone-950 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-stone-850 flex items-center justify-between bg-stone-900/80">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono font-semibold text-stone-200 truncate">
                  {previewPhoto.name}
                </span>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2 flex items-center justify-center bg-stone-950">
              <img
                src={previewPhoto.webViewLink || previewPhoto.thumbnailLink}
                alt={previewPhoto.name}
                className="max-h-[75vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
