import React from 'react';
import {
  CheckCircle2,
  RefreshCw,
  FolderSync,
  AlertTriangle,
  Image as ImageIcon,
  Clock,
  Sparkles,
  X,
  ExternalLink,
} from 'lucide-react';
import { Album, DriveSyncStats } from '../types';

interface SyncSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album;
  stats: DriveSyncStats | null;
  isSyncing: boolean;
  syncProgressMessage?: string;
  error?: string | null;
  onRetry?: () => void;
}

export const SyncSummaryModal: React.FC<SyncSummaryModalProps> = ({
  isOpen,
  onClose,
  album,
  stats,
  isSyncing,
  syncProgressMessage,
  error,
  onRetry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-6 border-b border-stone-800 bg-stone-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isSyncing
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : error
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              ) : error ? (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-100">
                {isSyncing ? 'Syncing Google Drive Photos' : error ? 'Sync Encountered An Error' : 'Drive Sync Completed'}
              </h3>
              <p className="text-xs text-stone-400">
                {album.title} ({album.coupleNames})
              </p>
            </div>
          </div>

          {!isSyncing && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-850 hover:bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs">
          {isSyncing ? (
            <div className="py-8 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-serif text-sm font-semibold text-stone-200">
                  Scanning Google Drive Wedding Folder...
                </p>
                <p className="text-stone-400 font-mono text-[11px]">
                  {syncProgressMessage || `Scanning "${album.driveFolderName}" and subfolders...`}
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-300 space-y-1">
                <p className="font-semibold text-sm">Sync Failed</p>
                <p className="leading-relaxed opacity-90">{error}</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-stone-800 text-stone-300 hover:bg-stone-800"
                >
                  Close
                </button>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold"
                  >
                    Retry Sync
                  </button>
                )}
              </div>
            </div>
          ) : stats ? (
            <div className="space-y-4 animate-fade-in">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-stone-950 border border-stone-850 text-center">
                  <p className="text-[10px] uppercase font-mono text-stone-500">Total Photos</p>
                  <p className="text-xl font-serif font-bold text-stone-100 mt-0.5">{stats.totalPhotos}</p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 text-center">
                  <p className="text-[10px] uppercase font-mono text-emerald-400">New Photos</p>
                  <p className="text-xl font-serif font-bold text-emerald-300 mt-0.5">+{stats.newPhotos}</p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-900/40 text-center">
                  <p className="text-[10px] uppercase font-mono text-amber-400">Updated</p>
                  <p className="text-xl font-serif font-bold text-amber-300 mt-0.5">{stats.updatedPhotos}</p>
                </div>

                <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-center">
                  <p className="text-[10px] uppercase font-mono text-rose-400">Missing</p>
                  <p className="text-xl font-serif font-bold text-rose-300 mt-0.5">{stats.missingPhotos}</p>
                </div>
              </div>

              {/* Detailed Info Card */}
              <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-850 space-y-2.5 font-mono text-[11px]">
                <div className="flex justify-between text-stone-400">
                  <span>Connected Drive Folder:</span>
                  <span className="text-stone-200 font-medium truncate max-w-[200px]">{album.driveFolderName}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Last Synced:</span>
                  <span className="text-amber-300">
                    {new Date(stats.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })},{' '}
                    {new Date(stats.lastSynced).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Subfolder Scan:</span>
                  <span className="text-emerald-400">
                    {album.includeSubfolders !== false ? 'Enabled (Recursive)' : 'Single Folder Only'}
                  </span>
                </div>
              </div>

              {/* Close Button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 font-semibold text-xs transition shadow-lg"
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
