import React, { useState } from 'react';
import {
  X,
  Edit,
  Save,
  Calendar,
  Lock,
  Download,
  AlertCircle,
  Check,
} from 'lucide-react';
import { CustomerGallery, CustomerGalleryStatus } from '../types';
import { saveCustomerGallery } from '../services/customerGalleryService';

interface EditCustomerGalleryModalProps {
  gallery: CustomerGallery;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (gallery: CustomerGallery) => void;
}

export const EditCustomerGalleryModal: React.FC<EditCustomerGalleryModalProps> = ({
  gallery,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [customerName, setCustomerName] = useState(gallery.customerName);
  const [eventName, setEventName] = useState(gallery.eventName);
  const [maxSelections, setMaxSelections] = useState(String(gallery.maxSelections));
  const [selectionDeadline, setSelectionDeadline] = useState(gallery.selectionDeadline);
  const [status, setStatus] = useState<CustomerGalleryStatus>(gallery.status);
  const [allowDownloads, setAllowDownloads] = useState(gallery.allowDownloads);
  const [allowEditing, setAllowEditing] = useState(gallery.allowEditing);
  const [askCustomerName, setAskCustomerName] = useState(gallery.askCustomerName || false);
  const [askCustomerPhone, setAskCustomerPhone] = useState(gallery.askCustomerPhone || false);
  const [notesForCustomer, setNotesForCustomer] = useState(gallery.notesForCustomer || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !eventName.trim()) {
      setError('Customer name and event name are required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const parsedMax = parseInt(maxSelections, 10);
      const maxVal = !isNaN(parsedMax) && parsedMax > 0 ? parsedMax : 100;

      const updated: CustomerGallery = {
        ...gallery,
        customerName: customerName.trim(),
        eventName: eventName.trim(),
        maxSelections: maxVal,
        selectionDeadline,
        status,
        allowDownloads,
        allowEditing,
        askCustomerName,
        askCustomerPhone,
        notesForCustomer: notesForCustomer.trim(),
        updatedAt: new Date().toISOString(),
      };

      await saveCustomerGallery(updated);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update gallery.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-semibold text-stone-100">
                Edit Customer Gallery
              </h2>
              <p className="text-xs text-stone-400">
                Update limits, deadline, status, and permissions
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

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:border-amber-400 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Event Name
              </label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:border-amber-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Maximum Selection
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={maxSelections}
                onChange={(e) => setMaxSelections(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 font-mono focus:border-amber-400 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Selection Deadline
              </label>
              <input
                type="date"
                value={selectionDeadline}
                onChange={(e) => setSelectionDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:border-amber-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Gallery Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerGalleryStatus)}
              className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:border-amber-400 focus:outline-hidden"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="selection_in_progress">Selection In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="locked">Locked</option>
              <option value="expired">Expired</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-850 cursor-pointer">
              <span className="text-xs text-stone-300">Allow Customer Download</span>
              <input
                type="checkbox"
                checked={allowDownloads}
                onChange={(e) => setAllowDownloads(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-850 cursor-pointer">
              <span className="text-xs text-stone-300">Allow Editing After Submit</span>
              <input
                type="checkbox"
                checked={allowEditing}
                onChange={(e) => setAllowEditing(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-850 cursor-pointer">
              <div>
                <span className="text-xs text-stone-300 block">Ask Customer Name</span>
                <span className="text-[10px] text-stone-500 block">Prompt client for name on first visit</span>
              </div>
              <input
                type="checkbox"
                checked={askCustomerName}
                onChange={(e) => setAskCustomerName(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-850 cursor-pointer">
              <div>
                <span className="text-xs text-stone-300 block">Ask Mobile Number</span>
                <span className="text-[10px] text-stone-500 block">Prompt client for phone number on first visit</span>
              </div>
              <input
                type="checkbox"
                checked={askCustomerPhone}
                onChange={(e) => setAskCustomerPhone(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Instructions for Customer
            </label>
            <textarea
              rows={2}
              value={notesForCustomer}
              onChange={(e) => setNotesForCustomer(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:border-amber-400 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-400 hover:text-stone-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
