import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  ShieldCheck,
  Check,
  Heart,
  Download,
  Lock,
  RefreshCw,
  RotateCcw,
  Sliders,
  ChevronRight,
  AlertCircle,
  Eye,
  SwitchCamera,
} from 'lucide-react';
import { Album, DrivePhoto, FaceMatchScore } from '../types';
import { searchFaceInAlbum } from '../services/faceSearchService';
import { isPhotoApprovedForClient } from '../services/albumStorage';

interface FaceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album;
  onFilterMatchingPhotos: (matchingPhotoIds: string[]) => void;
  onDownloadPhoto: (photo: DrivePhoto) => void;
  onPayForPhoto: (photo: DrivePhoto) => void;
  selectedIds: Set<string>;
  onToggleSelect: (photoId: string) => void;
}

export const FaceSearchModal: React.FC<FaceSearchModalProps> = ({
  isOpen,
  onClose,
  album,
  onFilterMatchingPhotos,
  onDownloadPhoto,
  onPayForPhoto,
  selectedIds,
  onToggleSelect,
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('');
  const [matchResults, setMatchResults] = useState<FaceMatchScore[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Camera handling
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  // Start camera stream when in camera mode
  const startCamera = async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMessage('ক্যামেরা চালু করা সম্ভব হয়নি। অনুগ্রহ করে ফটো আপলোড অপশনটি ব্যবহার করুন।');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (mode === 'camera' && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [mode, capturedImage, cameraFacing]);

  // Capture frame from webcam
  const handleCaptureFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
    runFaceSearch(dataUrl);
  };

  // Switch front/back camera on mobile
  const handleToggleCamera = () => {
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('অনুগ্রহ করে একটি ছবি ফাইল নির্বাচন করুন (JPEG/PNG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCapturedImage(dataUrl);
      runFaceSearch(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Run AI Search
  const runFaceSearch = async (imageDataUrl: string) => {
    setIsScanning(true);
    setScanProgress(5);
    setScanStatusText('ছবি লোড করা হচ্ছে...');
    setErrorMessage(null);
    setMatchResults(null);

    try {
      const photos = album.cachedPhotos || [];
      const matches = await searchFaceInAlbum(
        imageDataUrl,
        photos,
        (progress, text) => {
          setScanProgress(progress);
          setScanStatusText(text);
        }
      );
      setMatchResults(matches);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('ফেস সার্চ সম্পন্ন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsScanning(false);
    }
  };

  const handleResetSearch = () => {
    setCapturedImage(null);
    setMatchResults(null);
    setIsScanning(false);
    setScanProgress(0);
    setErrorMessage(null);
    if (mode === 'camera') {
      startCamera();
    }
  };

  const handleApplyToGallery = () => {
    if (!matchResults) return;
    const ids = matchResults.map((m) => m.photoId);
    onFilterMatchingPhotos(ids);
    onClose();
  };

  const handleSelectAllMatches = () => {
    if (!matchResults) return;
    matchResults.forEach((m) => {
      if (!selectedIds.has(m.photoId)) {
        onToggleSelect(m.photoId);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-amber-500/20 to-rose-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-100 flex items-center gap-2">
                <span>AI Face Search</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  রম্যছবি AI
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                মুখ স্ক্যান বা ছবি আপলোড করে এই অ্যালবামের ভেতর আপনার ছবিগুলো খুঁজুন
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Badge Banner */}
        <div className="px-5 py-2 bg-stone-950/80 border-b border-stone-850 flex items-center gap-2 text-[11px] text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            <strong>গোপনীয়তা ও নিরাপত্তা:</strong> ফেস সার্চ শুধুমাত্র <strong className="text-amber-300">{album.coupleNames}</strong>-এর এই অ্যালবামের নিজস্ব ফটোর মধ্যেই কাজ করে।
          </span>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Step 1: Mode Switcher (Upload vs Camera) */}
          {!capturedImage && (
            <div className="flex items-center bg-stone-950 p-1 rounded-2xl border border-stone-800 text-xs">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`flex-1 py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                  mode === 'upload'
                    ? 'bg-amber-500 text-stone-950 shadow-md font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>ফটো আপলোড (Upload Photo)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('camera')}
                className={`flex-1 py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                  mode === 'camera'
                    ? 'bg-amber-500 text-stone-950 shadow-md font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>ক্যামেরা ওপেন (Scan Face)</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Upload Mode Area */}
          {!capturedImage && mode === 'upload' && (
            <div className="space-y-3">
              <label className="border-2 border-dashed border-stone-750 hover:border-amber-400/60 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-stone-950/40 group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition duration-300 border border-amber-500/20 mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-stone-100">
                  আপনার একটি পরিষ্কার মুখমণ্ডলের ছবি আপলোড করুন
                </p>
                <p className="text-xs text-stone-400 mt-1 max-w-sm">
                  গ্যালারি বা ফাইল থেকে সেলফি বা সিঙ্গেল পোর্ট্রেট ছবি নির্বাচন করুন (JPG, PNG)
                </p>
                <span className="mt-4 px-4 py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-semibold group-hover:bg-amber-500 group-hover:text-stone-950 transition">
                  ফটো নির্বাচন করুন
                </span>
              </label>
            </div>
          )}

          {/* Camera Mode Area */}
          {!capturedImage && mode === 'camera' && (
            <div className="space-y-4">
              <div className="relative aspect-square max-w-sm mx-auto rounded-3xl overflow-hidden bg-black border-2 border-amber-500/40 shadow-xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Oval Face Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-64 border-2 border-dashed border-amber-400/70 rounded-[50%] shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-pulse flex items-center justify-center">
                    <span className="text-[10px] text-amber-300 font-mono bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs">
                      মুখটি বৃত্তে রাখুন
                    </span>
                  </div>
                </div>

                {/* Flip Camera switch for mobile */}
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition border border-stone-800"
                  title="ক্যামেরা পরিবর্তন করুন"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              </div>

              {/* Capture Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={!cameraActive}
                  onClick={handleCaptureFromCamera}
                  className="px-6 py-3 rounded-2xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-bold transition flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>ছবি তুলুন ও স্ক্যান করুন (Capture Face)</span>
                </button>
              </div>
            </div>
          )}

          {/* Scanning Animation & Progress */}
          {isScanning && (
            <div className="text-center py-10 space-y-4 animate-fade-in">
              <div className="relative w-20 h-20 mx-auto">
                <div className="w-20 h-20 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
                <Sparkles className="w-8 h-8 text-amber-400 absolute inset-0 m-auto animate-pulse" />
              </div>

              <div>
                <p className="font-serif text-base font-semibold text-stone-100">
                  {scanStatusText || 'মুখ স্ক্যান হচ্ছে...'}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  অ্যালবামের {album.cachedPhotos?.length || 0}টি ফটোর সাথে কৃত্রিম বুদ্ধিমত্তা দিয়ে মিল খোঁজা হচ্ছে
                </p>
              </div>

              {/* Progress Bar */}
              <div className="max-w-xs mx-auto w-full bg-stone-950 h-2.5 rounded-full overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-linear-to-r from-amber-500 via-rose-500 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Screen */}
          {matchResults && !isScanning && (
            <div className="space-y-4 animate-fade-in">
              {/* Scan Summary Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-950 border border-stone-850">
                <div className="flex items-center gap-3">
                  {capturedImage && (
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-stone-900 border border-amber-400/50 shrink-0">
                      <img src={capturedImage} alt="Reference" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{matchResults.length}টি ম্যাচিং ছবি পাওয়া গেছে!</span>
                    </h4>
                    <p className="text-[11px] text-stone-400">
                      আপনার মুখের বৈশিষ্ট্যের সাথে সর্বোচ্চ মিলসম্পন্ন ছবিগুলো নিচে দেখুন
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetSearch}
                    className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>নতুন স্ক্যান</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllMatches}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Heart className="w-3 h-3 fill-rose-400 stroke-rose-400" />
                    <span>সব সিলেক্ট</span>
                  </button>
                </div>
              </div>

              {/* Grid of Matching Photos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {matchResults.map(({ photo, similarity }) => {
                  const isSelected = selectedIds.has(photo.id);
                  const isPaid = Boolean(photo.isPaid);
                  const price = photo.price || album.defaultPhotoPrice || 100;
                  const isApproved = isPhotoApprovedForClient(album.id, photo.id);

                  return (
                    <div
                      key={photo.id}
                      className={`group relative bg-stone-950 rounded-2xl overflow-hidden border transition flex flex-col ${
                        isSelected
                          ? 'border-rose-500 ring-1 ring-rose-500/40'
                          : 'border-stone-850 hover:border-stone-750'
                      }`}
                    >
                      {/* Thumbnail with overlay */}
                      <div className="aspect-square relative overflow-hidden bg-stone-900">
                        <img
                          src={photo.thumbnailLink || photo.webViewLink}
                          alt={photo.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />

                        {/* Match Score Badge */}
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30 backdrop-blur-xs flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                          <span>{similarity}% Match</span>
                        </div>

                        {/* Heart Select Button */}
                        <button
                          type="button"
                          onClick={() => onToggleSelect(photo.id)}
                          className={`absolute top-2 right-2 p-1.5 rounded-full transition backdrop-blur-md ${
                            isSelected
                              ? 'bg-rose-500 text-white shadow-md'
                              : 'bg-black/50 text-white hover:bg-black/70'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${isSelected ? 'fill-white stroke-white' : ''}`}
                          />
                        </button>

                        {/* Paid/Free Badge */}
                        <div className="absolute bottom-2 left-2">
                          {isPaid ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-stone-950 text-[10px] font-bold font-mono shadow-sm flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>PAID ৳{price}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/90 text-stone-950 text-[10px] font-bold font-mono shadow-sm">
                              FREE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Photo details & Action button */}
                      <div className="p-2.5 space-y-1.5 text-xs bg-stone-950">
                        <p className="font-mono text-[11px] text-stone-300 truncate" title={photo.name}>
                          {photo.name}
                        </p>

                        {/* Download or Pay Action */}
                        {!isPaid || isApproved ? (
                          <button
                            type="button"
                            onClick={() => onDownloadPhoto(photo)}
                            className="w-full py-1.5 rounded-xl bg-stone-850 hover:bg-stone-800 text-emerald-400 text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-stone-750"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isApproved ? 'ডাউনলোড করুন (Approved)' : 'ফ্রি ডাউনলোড'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onPayForPhoto(photo);
                            }}
                            className="w-full py-1.5 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Lock className="w-3 h-3" />
                            <span>পেমেন্ট করুন (৳{price})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-800 bg-stone-950/90 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-stone-500">
            [রম্যছবি - RamyaChobi] স্মার্ট ফেস সার্চ সিস্টেম
          </p>

          <div className="flex items-center gap-2">
            {matchResults && (
              <button
                type="button"
                onClick={handleApplyToGallery}
                className="px-4 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 text-stone-950 font-semibold text-xs transition flex items-center gap-1.5 shadow-md"
              >
                <span>গ্যালারিতে ম্যাচিং ফটোগুলো ফিল্টার করুন</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 text-xs font-medium transition"
            >
              বন্ধ করুন (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
