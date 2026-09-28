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
  Globe,
  Zap,
  Loader2,
} from 'lucide-react';
import { DrivePhoto, PaymentMethod, PhotoPaymentRequest, Album } from '../types';
import {
  PAYMENT_ACCOUNTS,
  WHATSAPP_SUPPORT_NUMBER,
  WHATSAPP_LINK,
  addPaymentRequest,
  updatePaymentRequestStatus,
  grantDirectPhotoDownload,
  getPaymentGatewaySettings,
} from '../services/albumStorage';
import { downloadSinglePhoto } from '../services/zipDownloader';

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

  const gatewaySettings = getPaymentGatewaySettings();
  const hasStripe = gatewaySettings.stripe.enabled;
  const hasSSLCommerz = gatewaySettings.sslcommerz.enabled;
  const allowManual = gatewaySettings.allowManualFallback || (!hasStripe && !hasSSLCommerz);

  // Default selected payment method
  const initialMethod: PaymentMethod = hasStripe
    ? 'Stripe'
    : hasSSLCommerz
    ? 'SSLCommerz'
    : 'bKash';

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(initialMethod);
  const [clientName, setClientName] = useState(album.coupleNames || '');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState(album.clientEmail || '');
  const [transactionId, setTransactionId] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Online Card Simulation Fields
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<PhotoPaymentRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);

  // Compute total price
  const totalPrice = photosToBuy.reduce((sum, p) => {
    return sum + (p.price !== undefined ? p.price : (album.defaultPhotoPrice || 100));
  }, 0);

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  const isOnlineGateway = selectedMethod === 'Stripe' || selectedMethod === 'SSLCommerz';

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPhone = clientPhone.trim();
    const cleanName = clientName.trim();
    const cleanEmail = clientEmail.trim();

    if (!cleanName) {
      setErrorMessage('অনুগ্রহ করে আপনার নাম লিখুন (Please enter your name)');
      return;
    }

    if (!isOnlineGateway) {
      if (!cleanPhone || cleanPhone.length < 11) {
        setErrorMessage('সঠিক মোবাইল নম্বর প্রদান করুন (Please enter a valid 11-digit phone number)');
        return;
      }
      const cleanTrx = transactionId.trim();
      if (!cleanTrx || cleanTrx.length < 6) {
        setErrorMessage('সঠিক Transaction ID (TrxID) প্রদান করুন (Please enter valid Transaction ID)');
        return;
      }
    }

    setIsSubmitting(true);

    setTimeout(() => {
      try {
        if (isOnlineGateway) {
          // Instant automated online gateway settlement
          const onlineTrx =
            selectedMethod === 'Stripe'
              ? `STRIPE_${gatewaySettings.stripe.mode.toUpperCase()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`
              : `SSLC_${gatewaySettings.sslcommerz.mode.toUpperCase()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

          const newRequest = addPaymentRequest({
            albumId: album.id,
            clientName: cleanName,
            clientPhone: cleanPhone || 'Online Gateway Checkout',
            clientEmail: cleanEmail || undefined,
            photoIds: photosToBuy.map((p) => p.id),
            photoNames: photosToBuy.map((p) => p.name),
            totalAmount: totalPrice,
            paymentMethod: selectedMethod,
            senderNumber: selectedMethod === 'Stripe' ? 'Credit/Debit Card' : 'SSLCommerz Online Checkout',
            transactionId: onlineTrx,
          });

          // Auto-approve and unlock downloads
          updatePaymentRequestStatus(newRequest.id, 'approved', `Auto-verified via ${selectedMethod} payment gateway.`);
          photosToBuy.forEach((p) => {
            grantDirectPhotoDownload(album.id, p.id, cleanPhone || cleanEmail || cleanName);
          });

          newRequest.status = 'approved';
          setSubmittedRequest(newRequest);
          onPaymentSubmitted?.(newRequest);
        } else {
          // Manual bKash/Nagad/Rocket with TrxID
          const newRequest = addPaymentRequest({
            albumId: album.id,
            clientName: cleanName,
            clientPhone: cleanPhone,
            clientEmail: cleanEmail || undefined,
            photoIds: photosToBuy.map((p) => p.id),
            photoNames: photosToBuy.map((p) => p.name),
            totalAmount: totalPrice,
            paymentMethod: selectedMethod,
            senderNumber: cleanPhone,
            transactionId: transactionId.trim().toUpperCase(),
          });

          setSubmittedRequest(newRequest);
          onPaymentSubmitted?.(newRequest);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Payment submission failed.');
      } finally {
        setIsSubmitting(false);
      }
    }, isOnlineGateway ? 700 : 300);
  };

  const handleDownloadSingle = async (photo: DrivePhoto) => {
    if (downloadingPhotoId) return;
    setDownloadingPhotoId(photo.id);
    try {
      await downloadSinglePhoto(photo);
    } finally {
      setDownloadingPhotoId(null);
    }
  };

  const manualAccountNumber =
    selectedMethod === 'bKash' || selectedMethod === 'Nagad' || selectedMethod === 'Rocket'
      ? PAYMENT_ACCOUNTS[selectedMethod]
      : '';

  // WhatsApp Support Message Link
  const whatsappSupportUrl = `${WHATSAPP_LINK}&text=${encodeURIComponent(
    `Hello [রম্যছবি - RamyaChobi]! I have made payment for album "${album.title}".\nMethod: ${selectedMethod}\nAmount: ৳${totalPrice}\nClient: ${clientName || ''}`
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
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border ${
                  submittedRequest.status === 'approved'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-serif text-xl font-medium text-stone-100">
                {submittedRequest.status === 'approved'
                  ? 'পেমেন্ট সম্পন্ন ও ডাউনলোড আনলক হয়েছে!'
                  : 'পেমেন্ট রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!'}
              </h4>
              <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
                {submittedRequest.status === 'approved' ? (
                  <span className="text-emerald-300 block">
                    অনলাইন গেটওয়ের মাধ্যমে পেমেন্ট সফলভাবে অনুমোদিত হয়েছে। নিচে সরাসরি আপনার নির্বাচিত উচ্চ রেজোলিউশন ছবি ডাউনলোড করুন।
                  </span>
                ) : (
                  <span>
                    আপনার Transaction ID টি ভেরিফিকেশনের জন্য এডমিনের কাছে পাঠানো হয়েছে। এডমিন Approve করলেই ছবির ডাউনলোড আনলক হয়ে যাবে।
                  </span>
                )}
              </p>

              {/* Summary Card */}
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 text-left text-xs max-w-md mx-auto space-y-2 font-mono">
                <div className="flex justify-between text-stone-400">
                  <span>TrxID:</span>
                  <span className="text-amber-300 font-bold truncate max-w-[200px]">{submittedRequest.transactionId}</span>
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
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] ${
                      submittedRequest.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {submittedRequest.status === 'approved' ? 'Approved (অনুমোদিত)' : 'Pending Verification (যাচাই চলছে)'}
                  </span>
                </div>
              </div>

              {/* Instant Download Action if Approved */}
              {submittedRequest.status === 'approved' && (
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 max-w-md mx-auto text-left space-y-2.5">
                  <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Download className="w-4 h-4" />
                    <span>Download Purchased Photos ({photosToBuy.length}):</span>
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {photosToBuy.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-stone-900 border border-stone-800 text-xs"
                      >
                        <span className="truncate max-w-[200px] text-stone-300">{photo.name}</span>
                        <button
                          onClick={() => handleDownloadSingle(photo)}
                          disabled={downloadingPhotoId === photo.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium flex items-center gap-1"
                        >
                          {downloadingPhotoId === photo.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WhatsApp Support Highlight */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-850 max-w-md mx-auto text-left space-y-2">
                <div className="flex items-center gap-2 text-stone-300 font-semibold text-xs">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>সাহায্যের জন্য স্টুডিও হেল্পলাইনে যোগাযোগ করুন:</span>
                </div>
                <p className="text-[11px] text-stone-400">
                  WhatsApp Support: <strong className="text-emerald-400 font-mono">{WHATSAPP_SUPPORT_NUMBER}</strong>
                </p>
                <a
                  href={whatsappSupportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md"
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

                <div className="text-right shrink-0">
                  <p className="text-[10px] text-stone-500 uppercase font-mono tracking-wider">মোট প্রদেয়</p>
                  <p className="text-lg font-serif font-bold text-amber-400">৳{totalPrice}</p>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-300">
                  পেমেন্ট মাধ্যম বেছে নিন (Select Payment Gateway):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* Stripe Card Checkout */}
                  {hasStripe && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('Stripe')}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        selectedMethod === 'Stripe'
                          ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300 shadow-md ring-1 ring-indigo-500/50'
                          : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold">Stripe</span>
                      <span className="text-[9px] opacity-75">Cards / Apple Pay</span>
                    </button>
                  )}

                  {/* SSLCommerz Gateway */}
                  {hasSSLCommerz && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('SSLCommerz')}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        selectedMethod === 'SSLCommerz'
                          ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/50'
                          : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold">SSLCommerz</span>
                      <span className="text-[9px] opacity-75">bKash/Nagad/Cards</span>
                    </button>
                  )}

                  {/* Manual bKash */}
                  {allowManual && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('bKash')}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        selectedMethod === 'bKash'
                          ? 'bg-rose-950/50 border-rose-500 text-rose-300 shadow-md ring-1 ring-rose-500/50'
                          : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold">bKash</span>
                      <span className="text-[9px] opacity-75">Manual TrxID</span>
                    </button>
                  )}

                  {/* Manual Nagad */}
                  {allowManual && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('Nagad')}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        selectedMethod === 'Nagad'
                          ? 'bg-amber-950/50 border-orange-500 text-orange-300 shadow-md ring-1 ring-orange-500/50'
                          : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-bold">Nagad</span>
                      <span className="text-[9px] opacity-75">Manual TrxID</span>
                    </button>
                  )}

                  {/* Manual Rocket */}
                  {allowManual && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('Rocket')}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        selectedMethod === 'Rocket'
                          ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300 shadow-md ring-1 ring-indigo-500/50'
                          : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold">Rocket</span>
                      <span className="text-[9px] opacity-75">Manual TrxID</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ONLINE GATEWAY: Stripe Card Inputs */}
              {selectedMethod === 'Stripe' && (
                <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/40 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" />
                      <span>Stripe Secure Card Checkout</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300">
                      {gatewaySettings.stripe.mode.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-stone-400">Card Number (Simulated Test Card)</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 font-mono mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-stone-400">Expires</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 font-mono mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-stone-400">CVC</label>
                        <input
                          type="text"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 font-mono mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-stone-400">
                    🔒 Instant verification & immediate download access via Stripe.
                  </p>
                </div>
              )}

              {/* ONLINE GATEWAY: SSLCommerz Inputs */}
              {selectedMethod === 'SSLCommerz' && (
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>SSLCommerz Direct Checkout</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                      {gatewaySettings.sslcommerz.mode.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-stone-300">
                    Instantly pay with bKash, Nagad, Rocket, DBBL, Visa, Mastercard or Internet Banking through SSLCommerz.
                  </p>
                  <p className="text-[10px] text-emerald-400">
                    ⚡ Instant auto-verification and immediate photo unlock upon clicking Pay.
                  </p>
                </div>
              )}

              {/* MANUAL METHOD: Account Number Box with 1-click Copy */}
              {!isOnlineGateway && manualAccountNumber && (
                <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-300 font-medium">
                      {selectedMethod} পার্সোনাল নম্বর (Send Money):
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">Personal</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                    <span className="text-base font-bold font-mono text-amber-300 tracking-wider">
                      {manualAccountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber(manualAccountNumber)}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 transition flex items-center gap-1 border border-stone-700"
                    >
                      {copiedNumber === manualAccountNumber ? (
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
                    💡 অনুগ্রহ করে উপরের নম্বরে <strong>৳{totalPrice}</strong> Send Money করুন এবং নিচের ফর্মে প্রেরক নম্বর ও Transaction ID দিন।
                  </p>
                </div>
              )}

              {/* Client Info Inputs */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-stone-300 font-medium mb-1">
                    আপনার নাম (Your Name) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sophie Vance"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-300 font-medium mb-1">
                      মোবাইল নম্বর (Phone) {!isOnlineGateway && <span className="text-rose-400">*</span>}
                    </label>
                    <input
                      type="tel"
                      required={!isOnlineGateway}
                      placeholder="01XXXXXXXXX"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-300 font-medium mb-1">
                      ইমেইল (Email - Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* TrxID only required for manual payment */}
                {!isOnlineGateway && (
                  <div>
                    <label className="block text-stone-300 font-medium mb-1 flex items-center justify-between">
                      <span>
                        Transaction ID (TrxID) <span className="text-rose-400">*</span>
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono">SMS থেকে প্রাপ্ত TrxID</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BKS89341X2"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-hidden focus:border-amber-400 font-mono uppercase tracking-wider font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Error Notification */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-medium transition"
                >
                  বাতিল (Cancel)
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-semibold transition flex items-center gap-2 shadow-lg shadow-amber-950/30 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isOnlineGateway ? 'Connecting to Gateway...' : 'যাচাই করা হচ্ছে...'}</span>
                    </>
                  ) : (
                    <>
                      {isOnlineGateway ? <Zap className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      <span>
                        {isOnlineGateway
                          ? `Pay ৳${totalPrice} with ${selectedMethod}`
                          : `পেমেন্ট রিকোয়েস্ট জমা দিন (৳${totalPrice})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
