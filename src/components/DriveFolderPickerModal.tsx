import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder,
  Search,
  Check,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  HardDrive,
  Clock,
  Link,
  Users,
  FolderOpen,
  Image as ImageIcon,
  CheckSquare,
  Square,
  ArrowLeft,
  X,
  Sparkles,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';
import { DriveFolder, DrivePhoto, DriveSharedDrive } from '../types';
import {
  listDriveFolders,
  searchDriveFolders,
  listRecentFolders,
  listSharedDrives,
  listSharedWithMeFolders,
  validateDriveFolder,
  parseDriveFolderIdFromUrl,
  listPhotosInFolder,
} from '../services/drive';

export interface DriveFolderSelectionResult {
  folder: DriveFolder;
  includeSubfolders: boolean;
  previewPhotos: DrivePhoto[];
}

interface DriveFolderPickerModalProps {
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (result: DriveFolderSelectionResult) => void;
  initialFolderId?: string;
  modalTitle?: string;
  confirmButtonLabel?: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
  driveId?: string;
}

export const DriveFolderPickerModal: React.FC<DriveFolderPickerModalProps> = ({
  accessToken,
  isOpen,
  onClose,
  onSelectFolder,
  initialFolderId,
  modalTitle = 'Select Google Drive Folder',
  confirmButtonLabel = 'Use This Folder',
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'browse' | 'search' | 'recent' | 'paste' | 'shared'>('browse');

  // Breadcrumbs for Browse & Shared tabs
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);

  // Folder states
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [sharedDrives, setSharedDrives] = useState<DriveSharedDrive[]>([]);
  const [sharedSubTab, setSharedSubTab] = useState<'shared_drives' | 'shared_with_me'>('shared_drives');

  // Search state with debounce
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Paste URL state
  const [pastedUrl, setPastedUrl] = useState('');
  const [isValidatingPasted, setIsValidatingPasted] = useState(false);
  const [pastedFolderDetails, setPastedFolderDetails] = useState<DriveFolder | null>(null);

  // Selected folder and preview scanning
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [includeSubfolders, setIncludeSubfolders] = useState<boolean>(true);
  const [previewPhotos, setPreviewPhotos] = useState<DrivePhoto[]>([]);
  const [isScanningPreview, setIsScanningPreview] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');

  // General loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];

  // ==========================================
  // TAB 1: BROWSE DRIVE
  // ==========================================
  const loadBrowseFolder = useCallback(
    async (folderId: string, driveId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await listDriveFolders(accessToken, folderId, driveId);
        setFolders(results);
      } catch (err: any) {
        console.error('Error loading folders:', err);
        setError(err.message || 'Failed to load folders from Google Drive');
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken]
  );

  const handleDrillIntoFolder = (folder: DriveFolder) => {
    setBreadcrumbs((prev) => [
      ...prev,
      { id: folder.id, name: folder.name, driveId: folder.driveId },
    ]);
    setSelectedFolder(folder);
    loadBrowseFolder(folder.id, folder.driveId);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = breadcrumbs[index];
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    loadBrowseFolder(target.id, target.driveId);
  };

  const handleNavigateBack = () => {
    if (breadcrumbs.length <= 1) return;
    handleBreadcrumbClick(breadcrumbs.length - 2);
  };

  // ==========================================
  // TAB 2: SEARCH (DEBOUNCED)
  // ==========================================
  const executeSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        if (activeTab === 'browse') {
          loadBrowseFolder(currentBreadcrumb.id, currentBreadcrumb.driveId);
        }
        return;
      }
      setIsSearching(true);
      setError(null);
      try {
        const results = await searchDriveFolders(accessToken, query);
        setFolders(results);
      } catch (err: any) {
        console.error('Error searching folders:', err);
        setError(err.message || 'Error searching Google Drive');
      } finally {
        setIsSearching(false);
      }
    },
    [accessToken, activeTab, currentBreadcrumb, loadBrowseFolder]
  );

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(value);
    }, 400);
  };

  // ==========================================
  // TAB 3: RECENT FOLDERS
  // ==========================================
  const loadRecentFoldersList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await listRecentFolders(accessToken, 30);
      setFolders(results);
    } catch (err: any) {
      setError(err.message || 'Failed to load recent folders');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  // ==========================================
  // TAB 4: PASTE LINK
  // ==========================================
  const handleValidatePastedLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const folderId = parseDriveFolderIdFromUrl(pastedUrl);
    if (!folderId) {
      setError('Invalid Google Drive link format. Please paste a valid folder URL or folder ID.');
      return;
    }

    setIsValidatingPasted(true);
    setError(null);
    setPastedFolderDetails(null);

    try {
      const folder = await validateDriveFolder(accessToken, folderId);
      setPastedFolderDetails(folder);
      setSelectedFolder(folder);
    } catch (err: any) {
      setError(err.message || 'Unable to access the specified Google Drive folder');
    } finally {
      setIsValidatingPasted(false);
    }
  };

  // ==========================================
  // TAB 5: SHARED DRIVES & SHARED WITH ME
  // ==========================================
  const loadSharedDrivesList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (sharedSubTab === 'shared_drives') {
        const drives = await listSharedDrives(accessToken);
        setSharedDrives(drives);
        setFolders([]);
      } else {
        const sharedFolders = await listSharedWithMeFolders(accessToken);
        setFolders(sharedFolders);
        setSharedDrives([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load shared folders');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, sharedSubTab]);

  const handleSelectSharedDrive = (drive: DriveSharedDrive) => {
    setBreadcrumbs([
      { id: drive.id, name: `Shared Drive: ${drive.name}`, driveId: drive.id },
    ]);
    setActiveTab('browse');
    loadBrowseFolder(drive.id, drive.id);
  };

  // Switch tabs
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setError(null);

    if (tab === 'browse') {
      loadBrowseFolder(currentBreadcrumb.id, currentBreadcrumb.driveId);
    } else if (tab === 'recent') {
      loadRecentFoldersList();
    } else if (tab === 'shared') {
      loadSharedDrivesList();
    } else if (tab === 'search') {
      if (searchTerm.trim()) {
        executeSearch(searchTerm);
      }
    }
  };

  // ==========================================
  // FOLDER CONTENT SCAN & PREVIEW
  // ==========================================
  useEffect(() => {
    if (!selectedFolder) {
      setPreviewPhotos([]);
      return;
    }

    let isMounted = true;
    const scanFolderImages = async () => {
      setIsScanningPreview(true);
      setScanStatusText('Scanning folder images...');
      try {
        const photos = await listPhotosInFolder(accessToken, selectedFolder.id, {
          includeSubfolders,
          folderName: selectedFolder.name,
          onProgress: (count, folder) => {
            if (isMounted) {
              setScanStatusText(`Scanning ${folder}... (${count} photos found)`);
            }
          },
        });
        if (isMounted) {
          setPreviewPhotos(photos);
        }
      } catch (err) {
        console.warn('Could not scan preview photos:', err);
      } finally {
        if (isMounted) {
          setIsScanningPreview(false);
        }
      }
    };

    scanFolderImages();

    return () => {
      isMounted = false;
    };
  }, [selectedFolder, includeSubfolders, accessToken]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadBrowseFolder('root');
    }
  }, [isOpen, loadBrowseFolder]);

  if (!isOpen) return null;

  const handleConfirmSelection = () => {
    if (!selectedFolder) return;
    onSelectFolder({
      folder: selectedFolder,
      includeSubfolders,
      previewPhotos,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-5 animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-100 flex items-center gap-2">
                <span>{modalTitle}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Google Drive API v3
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Browse My Drive & Shared Drives, search folders, or paste a direct folder link
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center px-6 pt-3 border-b border-stone-850 gap-2 bg-stone-950/40 text-xs">
          <button
            type="button"
            onClick={() => handleTabChange('browse')}
            className={`px-4 py-2 rounded-t-xl font-medium transition flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === 'browse'
                ? 'border-amber-500 text-amber-300 bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Browse Drive</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('search')}
            className={`px-4 py-2 rounded-t-xl font-medium transition flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === 'search'
                ? 'border-amber-500 text-amber-300 bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('recent')}
            className={`px-4 py-2 rounded-t-xl font-medium transition flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === 'recent'
                ? 'border-amber-500 text-amber-300 bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recent</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('paste')}
            className={`px-4 py-2 rounded-t-xl font-medium transition flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === 'paste'
                ? 'border-amber-500 text-amber-300 bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Paste Link</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('shared')}
            className={`px-4 py-2 rounded-t-xl font-medium transition flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === 'shared'
                ? 'border-amber-500 text-amber-300 bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Shared</span>
          </button>
        </div>

        {/* Tab Context Bars */}
        {/* Search Tab Header */}
        {activeTab === 'search' && (
          <div className="p-4 border-b border-stone-850 bg-stone-950/60">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search folder name (e.g. Vance Wedding, Selects, Tuscany)..."
                value={searchTerm}
                onChange={handleSearchInputChange}
                className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-hidden focus:border-amber-400 font-sans"
              />
              {isSearching && (
                <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 animate-spin" />
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" />
              <span>Partial match search runs automatically as you type.</span>
            </p>
          </div>
        )}

        {/* Browse Tab Breadcrumb Navigation Bar */}
        {activeTab === 'browse' && (
          <div className="px-6 py-2.5 border-b border-stone-850 bg-stone-950/60 flex items-center justify-between gap-3 text-xs overflow-x-auto">
            <div className="flex items-center gap-1.5 text-stone-400 font-mono text-[11px] min-w-0">
              {breadcrumbs.length > 1 && (
                <button
                  type="button"
                  onClick={handleNavigateBack}
                  className="p-1 rounded-md hover:bg-stone-800 text-stone-300 hover:text-white mr-1 transition"
                  title="Back to parent folder"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id + idx}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-stone-600 shrink-0" />}
                    <button
                      type="button"
                      onClick={() => handleBreadcrumbClick(idx)}
                      disabled={isLast}
                      className={`truncate max-w-[140px] transition ${
                        isLast
                          ? 'font-bold text-amber-300'
                          : 'hover:text-stone-200 text-stone-400 underline decoration-stone-700'
                      }`}
                      title={crumb.name}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => loadBrowseFolder(currentBreadcrumb.id, currentBreadcrumb.driveId)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-400 hover:text-stone-200 text-[11px] transition flex items-center gap-1.5 shrink-0"
              title="Refresh folder content"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        )}

        {/* Shared Tab Sub-Navigation */}
        {activeTab === 'shared' && (
          <div className="px-6 py-2.5 border-b border-stone-850 bg-stone-950/60 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setSharedSubTab('shared_drives');
                loadSharedDrivesList();
              }}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                sharedSubTab === 'shared_drives'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Shared Drives
            </button>
            <button
              type="button"
              onClick={() => {
                setSharedSubTab('shared_with_me');
                loadSharedDrivesList();
              }}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                sharedSubTab === 'shared_with_me'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Shared with Me
            </button>
          </div>
        )}

        {/* Paste Link Tab Form */}
        {activeTab === 'paste' && (
          <div className="p-6 space-y-4">
            <form onSubmit={handleValidatePastedLink} className="space-y-3">
              <label className="block text-xs font-semibold text-stone-200">
                Paste Google Drive Folder URL or Folder ID:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://drive.google.com/drive/folders/1aBcD... or folder ID"
                  value={pastedUrl}
                  onChange={(e) => setPastedUrl(e.target.value)}
                  className="flex-1 bg-stone-950 border border-stone-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-stone-100 placeholder-stone-600 focus:outline-hidden font-mono"
                />
                <button
                  type="submit"
                  disabled={isValidatingPasted || !pastedUrl.trim()}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isValidatingPasted ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Validate Folder</span>
                </button>
              </div>
            </form>

            <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 text-xs text-stone-400 space-y-1 leading-relaxed">
              <p className="font-semibold text-stone-300">Supported Google Drive Link Formats:</p>
              <p className="font-mono text-[11px] text-amber-400/90">
                • https://drive.google.com/drive/folders/12345abcdef...
              </p>
              <p className="font-mono text-[11px] text-amber-400/90">
                • https://drive.google.com/open?id=12345abcdef...
              </p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <p className="truncate">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-stone-400 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-stone-800 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content Area: Split 2-Column Layout */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[300px]">
          {/* Left Column: Folders List (7 Cols) */}
          <div className="md:col-span-7 border-r border-stone-850 overflow-y-auto p-4 space-y-1.5">
            {isLoading || isSearching ? (
              <div className="py-16 flex flex-col items-center justify-center text-stone-500 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                <p className="text-xs">Connecting to Google Drive...</p>
              </div>
            ) : activeTab === 'shared' && sharedSubTab === 'shared_drives' && sharedDrives.length > 0 ? (
              // Shared Drives List
              sharedDrives.map((drive) => (
                <div
                  key={drive.id}
                  onClick={() => handleSelectSharedDrive(drive)}
                  className="p-3 rounded-2xl border border-stone-800 hover:border-amber-500/40 bg-stone-950/60 hover:bg-stone-850 cursor-pointer transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-200 truncate">{drive.name}</p>
                      <p className="text-[10px] text-stone-500">Shared Drive</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-600" />
                </div>
              ))
            ) : folders.length === 0 ? (
              <div className="py-16 text-center text-stone-500 space-y-2">
                <Folder className="w-10 h-10 mx-auto stroke-1 text-stone-600" />
                <p className="text-sm font-medium text-stone-400">No folders found</p>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  {activeTab === 'search'
                    ? 'No folders matched your search term.'
                    : 'This directory contains no subfolders. You can select this folder as the gallery source.'}
                </p>
              </div>
            ) : (
              folders.map((folder) => {
                const isSelected = selectedFolder?.id === folder.id;
                const formattedDate = folder.modifiedTime
                  ? new Date(folder.modifiedTime).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null;

                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder)}
                    className={`group p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 text-stone-100 shadow-md ring-1 ring-amber-500/40'
                        : 'bg-stone-950/60 border-stone-850 hover:bg-stone-850/60 hover:border-stone-750 text-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 font-bold'
                            : 'bg-stone-800 text-amber-400 group-hover:bg-amber-500/20'
                        }`}
                      >
                        <Folder className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate group-hover:text-amber-300">
                          {folder.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-0.5">
                          {formattedDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>{formattedDate}</span>
                            </span>
                          )}
                          {folder.sharedWithMe && (
                            <span className="text-indigo-400 font-mono">Shared</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeTab === 'browse' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDrillIntoFolder(folder);
                          }}
                          className="p-1.5 rounded-lg hover:bg-stone-750 text-stone-400 hover:text-stone-200 transition"
                          title="Open subfolder"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Folder Preview & Settings (5 Cols) */}
          <div className="md:col-span-5 bg-stone-950/40 p-5 flex flex-col justify-between overflow-y-auto space-y-4">
            {selectedFolder ? (
              <div className="space-y-4 animate-fade-in">
                {/* Folder Header Banner */}
                <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-400 font-mono text-[10px] uppercase tracking-wider">
                      Selected Folder
                    </span>
                    <a
                      href={`https://drive.google.com/drive/folders/${selectedFolder.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stone-400 hover:text-amber-300 flex items-center gap-1 text-[11px]"
                      title="Open in Google Drive"
                    >
                      <span>Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <h4 className="font-serif text-base font-semibold text-stone-100 break-words">
                    {selectedFolder.name}
                  </h4>

                  <p className="text-[11px] font-mono text-stone-500 truncate" title={selectedFolder.id}>
                    ID: {selectedFolder.id}
                  </p>
                </div>

                {/* Subfolder Recursion Checkbox */}
                <div
                  onClick={() => setIncludeSubfolders(!includeSubfolders)}
                  className="p-3.5 rounded-2xl bg-stone-900/60 border border-stone-800 hover:border-stone-700 cursor-pointer transition flex items-start gap-3 text-xs"
                >
                  <div className="mt-0.5 text-amber-400">
                    {includeSubfolders ? (
                      <CheckSquare className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Square className="w-4 h-4 text-stone-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-stone-200">Include photos from subfolders</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Recursively scans all ceremony, reception, and couple subfolders inside this folder.
                    </p>
                  </div>
                </div>

                {/* Photos Preview Strip */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-300 font-medium flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Photos Scanned:</span>
                    </span>
                    {isScanningPreview ? (
                      <span className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Scanning...</span>
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {previewPhotos.length} Images
                      </span>
                    )}
                  </div>

                  {isScanningPreview && (
                    <p className="text-[10px] text-amber-300/80 font-mono truncate">{scanStatusText}</p>
                  )}

                  {/* Thumbnail Previews Grid */}
                  {previewPhotos.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {previewPhotos.slice(0, 8).map((photo) => (
                        <div
                          key={photo.id}
                          className="aspect-square rounded-xl overflow-hidden bg-stone-900 border border-stone-800 shadow-xs group relative"
                        >
                          <img
                            src={photo.thumbnailLink || photo.webViewLink}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  ) : !isScanningPreview ? (
                    <div className="p-6 text-center bg-stone-900/40 rounded-xl border border-stone-850 text-stone-500 text-xs">
                      No photos detected in this folder yet.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-stone-500 space-y-2 my-auto">
                <FolderOpen className="w-12 h-12 stroke-1 text-stone-600 mx-auto" />
                <p className="text-xs font-medium text-stone-400">No folder selected</p>
                <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                  Click on any folder in the left list or paste a link to preview and connect.
                </p>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-stone-850 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedFolder}
                onClick={handleConfirmSelection}
                className="px-5 py-2.5 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-950/20 disabled:opacity-40"
              >
                <Check className="w-4 h-4" />
                <span>{confirmButtonLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
