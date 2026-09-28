import React, { useState } from 'react';
import {
  Folder,
  Search,
  Check,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  HardDrive,
} from 'lucide-react';
import { DriveFolder } from '../types';
import { listDriveFolders, searchDriveFolders } from '../services/drive';

interface DriveFolderPickerModalProps {
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folder: DriveFolder) => void;
}

export const DriveFolderPickerModal: React.FC<DriveFolderPickerModalProps> = ({
  accessToken,
  isOpen,
  onClose,
  onSelectFolder,
}) => {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);

  const fetchRootFolders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await listDriveFolders(accessToken);
      setFolders(results);
      setHasLoadedInitially(true);
    } catch (err: any) {
      setError(err.message || 'Failed to access Google Drive folders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      return fetchRootFolders();
    }
    setIsLoading(true);
    setError(null);
    try {
      const results = await searchDriveFolders(accessToken, searchTerm);
      setFolders(results);
    } catch (err: any) {
      setError(err.message || 'Error searching folders');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !hasLoadedInitially) {
      fetchRootFolders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-100">Select Google Drive Folder</h3>
              <p className="text-xs text-stone-400">Choose the wedding gallery folder containing high-res photos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-stone-800 bg-stone-950/40">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="text"
                placeholder="Search folder name (e.g. Vance Wedding, Selects)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 text-sm rounded-xl pl-9 pr-4 py-2.5 text-stone-200 placeholder-stone-500 focus:outline-hidden focus:border-amber-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium rounded-xl transition flex items-center gap-2"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>

        {/* Folder List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <div>
                <p className="font-semibold">Unable to load folders</p>
                <p className="text-rose-400/80">{error}</p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-stone-500 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
              <p className="text-sm">Connecting to Google Drive...</p>
            </div>
          ) : folders.length === 0 ? (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <Folder className="w-10 h-10 mx-auto stroke-1 text-stone-600" />
              <p className="text-sm font-medium">No folders found</p>
              <p className="text-xs text-stone-600">Try searching with a different keyword or create a folder in your Drive.</p>
            </div>
          ) : (
            folders.map((folder) => {
              const isSelected = selectedFolder?.id === folder.id;
              return (
                <div
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder)}
                  className={`group p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 text-stone-100 shadow-xs'
                      : 'bg-stone-900/60 border-stone-800 hover:bg-stone-800/60 hover:border-stone-700 text-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-amber-400/80'
                      }`}
                    >
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-stone-200">{folder.name}</p>
                      <p className="text-xs text-stone-500 truncate">
                        ID: {folder.id.substring(0, 16)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-stone-400 transition" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-950/60 flex items-center justify-between">
          <div className="text-xs text-stone-500 truncate max-w-[200px]">
            {selectedFolder ? (
              <span className="text-stone-300 font-medium truncate">
                Selected: {selectedFolder.name}
              </span>
            ) : (
              'Choose a folder to connect'
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200 transition"
            >
              Cancel
            </button>
            <button
              disabled={!selectedFolder}
              onClick={() => {
                if (selectedFolder) {
                  onSelectFolder(selectedFolder);
                  onClose();
                }
              }}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white font-medium text-sm rounded-xl transition shadow-md shadow-amber-950/30 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Use This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
