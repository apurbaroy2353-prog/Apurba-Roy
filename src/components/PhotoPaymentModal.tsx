import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Lock,
  Download,
  ShieldCheck,
  Send,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { DrivePhoto, PaymentMethod, PhotoPaymentRequest, Album } from '../types';
import {
  PAYMENT_ACCOUNTS,
  WHATSAPP_SUPPORT_NUMBER,
  WHATSAPP_LINK,
  addPaymentRequest,
} from '../services/albumStorage';

interface PhotoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album;
  photosToBuy: DrivePhoto[];
  onPaymentSubmitted?: (request: PhotoPaymentRequest) => void;
}

export const PhotoPaymentModal: React.FC<PhotoPaymentModalProps> = ({
  isOpen,
  onClose,
  album,
  photosToBuy,
  onPaymentSubmitted,
}) => {
  if (!isOpen || photosToBuy.length === 0) return null;

  // Selected payment method
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('bKash');
  const [clientName, setClientName] = useState(album.coupleNames || '');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState(album.clientEmail || '');
  const [transactionId, setTransactionId] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<PhotoPaymentRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute total price
  const totalPrice = photosToBuy.reduce((sum, p) => {
    return sum + (p.price !== undefined ? p.price : (album.defaultPhotoPrice || 100));
  }, 0);

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanTrx = transactionId.trim();
    const cleanPhone = clientPhone.trim();
    const cleanName = clientName.trim();

    if (!cleanName) {
      setErrorMessage('অনুগ্রহ করে আপনার নাম লিখুন (Please enter your name)');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 11) {
      setErrorMessage('সঠিক মোবাইল নম্বর প্রদান করুন (Please enter a valid 11-digit phone number)');
      return;
    }
    if (!cleanTrx || cleanTrx.length < 6) {
      setErrorMessage('সঠিক Transaction ID (TrxID) প্রদান করুন (Please enter valid Transaction ID)');
      return;
    }

    setIsSubmitting(true);
    try {
      const newRequest = addPaymentRequest({
        albumId: album.id,
        clientName: cleanName,
        clientPhone: cleanPhone,
        clientEmail: clientEmail.trim() || undefined,
        photoIds: photosToBuy.map((p) => p.id),
        photoNames: photosToBuy.map((p) => p.name),
        totalAmount: totalPrice,
        paymentMethod: selectedMethod,
        senderNumber: cleanPhone,
        transactionId: cleanTrx.toUpperCase(),
      });

      setSubmittedRequest(newRequest);
      onPaymentSubmitted?.(newRequest);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountNumber = PAYMENT_ACCOUNTS[selectedMethod];

  // WhatsApp Support Message Link
  const whatsappSupportUrl = `${WHATSAPP_LINK}&text=${encodeURIComponent(
    `Hello [রম্যছবি - RamyaChobi]! I have made payment for album "${album.title}".\nTransaction ID: ${
      transactionId || 'Pending'
    }\nAmount: ৳${totalPrice}\nSender Phone: ${clientPhone || ''}`
  )}`;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden relative max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-100 flex items-center gap-2">
                <span>Paid Photo Download</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  রম্যছবি
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                {photosToBuy.length === 1
                  ? 'উচ্চ রেজোলিউশন ছবি ডাউনলোডের জন্য পেমেন্ট করুন'
                  : `${photosToBuy.length}টি পেইড ছবি ডাউনলোডের জন্য পেমেন্ট করুন`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {submittedRequest ? (
            /* Submission Success & Status Screen */
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-serif text-xl font-medium text-stone-100">
                পেমেন্ট রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!
              </h4>
              <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
                আপনার Transaction ID টি ভেরিফিকেশনের জন্য এডমিনের কাছে পাঠানো হয়েছে।
                <strong className="text-amber-300 block mt-1">
                  এডমিন Approve করলেই ছবির ডাউনলোড আনলক হয়ে যাবে।
                </strong>
              </p>

              {/* Summary Card */}
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 text-left text-xs max-w-md mx-auto space-y-2 font-mono">
                <div className="flex justify-between text-stone-400">
                  <span>TrxID:</span>
                  <span className="text-amber-300 font-bold">{submittedRequest.transactionId}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Method:</span>
                  <span className="text-stone-200">{submittedRequest.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Total Amount:</span>
                  <span className="text-emerald-400 font-bold">৳{submittedRequest.totalAmount}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Status:</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                    Pending Verification (যাচাই চলছে)
                  </span>
                </div>
              </div>

              {/* WhatsApp Support Highlight */}
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 max-w-md mx-auto text-left space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                  <MessageCircle className="w-4 h-4" />
                  <span>Payment সমস্যা বা দ্রুত অনুমোদনের জন্য:</span>
                </div>
                <p className="text-[11px] text-stone-300">
                  WhatsApp Support: <strong className="text-emerald-400 font-mono">01776044951</strong>
                </p>
                <a
                  href={whatsappSupportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp এ মেসেজ দিন</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
                >
                  গ্যালারিতে ফিরে যান
                </button>
              </div>
            </div>
          ) : (
            /* Payment Workflow */
            <form onSubmit={handleSubmitPayment} className="space-y-5">
              {/* Selected Photo(s) Preview & Total */}
              <div className="p-3.5 rounded-2xl bg-stone-950/80 border border-stone-850 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Photo thumbnail */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-900 border border-stone-800 shrink-0">
                    <img
                      src={photosToBuy[0].thumbnailLink || photosToBuy[0].webViewLink}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-100 truncate">
                      {photosToBuy.length === 1 ? photosToBuy[0].name : `${photosToBuy.length}টি ফটো নির্বাচিত`}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {album.title} ({album.coupleNames})
                    </p>
                  </div>
                </div>

                {/* Price Display */}
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-stone-500 uppercase font-mono tracking-wider">মোট প্রদেয়</p>
                  <p className="text-lg font-serif font-bold text-amber-400">৳{totalPrice}</p>
                </div>
              </div>

              {/* Payment Method Selector (bKash, Nagad, Rocket) */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-300">
                  পেমেন্ট মাধ্যম বেছে নিন (Select Payment Method):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['bKash', 'Nagad', 'Rocket'] as PaymentMethod[]).map((method) => {
                    const isSelected = selectedMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSelectedMethod(method)}
                        className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? method === 'bKash'
                              ? 'bg-rose-950/50 border-rose-500 text-rose-300 shadow-md ring-1 ring-rose-500/50'
                              : method === 'Nagad'
                              ? 'bg-amber-950/50 border-orange-500 text-orange-300 shadow-md ring-1 ring-orange-500/50'
                              : 'bg-indigo-950/50 border-indigo-500 text-indigo-300 shadow-md ring-1 ring-indigo-500/50'
                            : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        <span className="text-xs font-bold">{method}</span>
                        <span className="text-[9px] opacity-75">Send Money</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Number Box with 1-click Copy */}
              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-300 font-medium">
                    {selectedMethod} পার্সোনাল নম্বর (Send Money):
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">Personal</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-base font-bold font-mono text-amber-300 tracking-wider">
                    {accountNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(accountNumber)}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 transition flex items-center gap-1 border border-stone-700"
                  >
                    {copiedNumber === accountNumber ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 leading-normal">
                  💡 অনুগ্রহ করে উপরের নম্বরে <strong>৳{totalPrice}</strong> Send Money করুন এবং নিচের ফর্মে প্রেরক নম্বর ও Transaction ID (TrxID) দিন।
                </p>
              </div>

              {/* Client Info & Transaction ID Inputs */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-stone-300 font-medium mb-1">
                    আপনার নাম (Your Name) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Julian Vance"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-300 font-medium mb-1">
                      যে নম্বর থেকে পেমেন্ট করেছেন (Sender Phone) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 01712345678"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-300 font-medium mb-1">
                      Transaction ID (TrxID) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BKS982319XK"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400/50 font-mono uppercase"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* WhatsApp Support Banner */}
              <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-850 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-stone-400">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>
                    Payment সমস্যা বা ছবি না পেলে: <strong className="text-stone-200">WhatsApp: 01776044951</strong>
                  </span>
                </div>
                <a
                  href={whatsappSupportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline font-medium text-[11px] shrink-0"
                >
                  Chat Now →
                </a>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-200 transition"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 font-semibold text-xs transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'জমা হচ্ছে...' : 'পেমেন্ট সাবমিট করুন (Submit)'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
