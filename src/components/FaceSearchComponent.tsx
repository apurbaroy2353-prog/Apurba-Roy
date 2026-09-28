import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  Camera,
  X,
  Check,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Heart,
  ChevronDown,
  ChevronUp,
  SwitchCamera,
  Image as ImageIcon,
} from 'lucide-react';
import { Album, DrivePhoto, FaceMatchScore } from '../types';
import { searchFaceInAlbum } from '../services/faceSearchService';

interface FaceSearchComponentProps {
  album: Album;
  photos: DrivePhoto[];
  matchingPhotoIds: string[] | null;
  activeReferenceImage: string | null;
  onFilterMatchingPhotos: (
    matchingIds: string[] | null,
    referenceImageUrl: string | null,
    matchScores: Record<string, number>
  ) => void;
  selectedIds: Set<string>;
  onToggleSelect: (photoId: string) => void;
  isExpandedDefault?: boolean;
}

export const FaceSearchComponent: React.FC<FaceSearchComponentProps> = ({
  album,
  photos,
  matchingPhotoIds,
  activeReferenceImage,
  onFilterMatchingPhotos,
  selectedIds,
  onToggleSelect,
  isExpandedDefault = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(
    isExpandedDefault || Boolean(matchingPhotoIds)
  );
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [previewImage, setPreviewImage] = useState<string | null>(activeReferenceImage);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Camera support
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize preview if parent changes reference image
  useEffect(() => {
    if (activeReferenceImage) {
      setPreviewImage(activeReferenceImage);
    }
  }, [activeReferenceImage]);

  // Handle Camera lifecycle
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
      setErrorMessage(
        'ক্যামেরা চালু করা সম্ভব হয়নি। অনুগ্রহ করে ফটো আপলোড অপশনটি ব্যবহার করুন।'
      );
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
    if (isExpanded && activeTab === 'camera' && !previewImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isExpanded, activeTab, previewImage, cameraFacing]);

  // Capture frame from webcam
  const handleCaptureCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreviewImage(dataUrl);
    stopCamera();
    runFaceSearch(dataUrl);
  };

  // Flip camera
  const handleToggleCamera = () => {
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Process File Selection
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('অনুগ্রহ করে একটি ছবি ফাইল নির্বাচন করুন (JPEG/PNG)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewImage(dataUrl);
      runFaceSearch(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Execute AI Search
  const runFaceSearch = async (imageDataUrl: string) => {
    setIsScanning(true);
    setScanProgress(10);
    setScanStatusText('মুখের বৈশিষ্ট্য বিশ্লেষণ করা হচ্ছে...');
    setErrorMessage(null);

    try {
      const albumPhotos = photos.length > 0 ? photos : album.cachedPhotos || [];
      const matches: FaceMatchScore[] = await searchFaceInAlbum(
        imageDataUrl,
        albumPhotos,
        (progress, text) => {
          setScanProgress(progress);
          setScanStatusText(text);
        }
      );

      const matchIds = matches.map((m) => m.photoId);
      const scoreMap: Record<string, number> = {};
      matches.forEach((m) => {
        scoreMap[m.photoId] = m.similarity;
      });

      onFilterMatchingPhotos(matchIds, imageDataUrl, scoreMap);
    } catch (err: any) {
      console.error('Face search error:', err);
      setErrorMessage(
        'ফেস সার্চ সম্পন্ন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Reset/Clear Search
  const handleClearSearch = () => {
    stopCamera();
    setPreviewImage(null);
    setErrorMessage(null);
    setIsScanning(false);
    setScanProgress(0);
    onFilterMatchingPhotos(null, null, {});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Select all matching photos
  const handleSelectAllMatches = () => {
    if (!matchingPhotoIds) return;
    matchingPhotoIds.forEach((id) => {
      if (!selectedIds.has(id)) {
        onToggleSelect(id);
      }
    });
  };

  const isFilterActive = matchingPhotoIds !== null;

  return (
    <div className="w-full bg-stone-900/70 border border-stone-800 rounded-3xl overflow-hidden shadow-xl transition-all duration-300">
      {/* Component Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-stone-850/50 transition select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-amber-500/20 to-rose-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base sm:text-lg font-medium text-stone-100 flex items-center gap-2">
                <span>AI Face Search</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  রম্যছবি AI
                </span>
              </h3>
              {isFilterActive && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500 text-stone-950 animate-fade-in">
                  {matchingPhotoIds.length} Matching
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              একটি ছবি আপলোড করে এই অ্যালবামের ভেতর নিজের সব ছবি এক ক্লিকে খুঁজুন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFilterActive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearSearch();
              }}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white text-xs font-medium transition flex items-center gap-1 border border-stone-700"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">সব ছবি দেখুন</span>
              <span className="sm:hidden">Clear</span>
            </button>
          )}

          <div className="p-1.5 rounded-xl bg-stone-950 text-stone-400 hover:text-white border border-stone-800">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content Section */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 border-t border-stone-850 space-y-4 animate-fade-in">
          {/* Security Guarantee Tag */}
          <div className="flex items-center justify-between text-[11px] text-stone-400 bg-stone-950/60 p-2.5 rounded-xl border border-stone-850">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>নিরাপত্তা ও গোপনীয়তা:</strong> ফেস সার্চ শুধুমাত্র{' '}
                <strong className="text-amber-300">{album.coupleNames}</strong>-এর এই অ্যালবামের ফটোর মধ্যেই কাজ করে।
              </span>
            </div>
            <span className="hidden sm:inline font-mono text-[10px] text-stone-500">
              {photos.length} Photos in Album
            </span>
          </div>

          {/* Active Filter State Summary Bar (if already filtered) */}
          {isFilterActive && previewImage && !isScanning && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-950 border-2 border-amber-400 shadow-md shrink-0">
                  <img
                    src={previewImage}
                    alt="Reference Face"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      ফিল্টার সক্রিয়: {matchingPhotoIds.length}টি ম্যাচিং ফটো প্রদর্শিত হচ্ছে
                    </span>
                  </p>
                  <p className="text-[11px] text-stone-400">
                    নিচের গ্যালারিতে আপনার রেফারেন্স মুখের সাথে সর্বোচ্চ মিলসম্পন্ন ছবিগুলো দেখানো হচ্ছে।
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllMatches}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
                  title="Shortlist all matching photos"
                >
                  <Heart className="w-3.5 h-3.5 fill-rose-400 stroke-rose-400" />
                  <span>সব ম্যাচ সিলেক্ট করুন</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-3 py-1.5 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 text-xs font-medium transition flex items-center gap-1 border border-stone-750"
                  title="Clear face filter and show all photos"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>ফিল্টার মুছুন</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode Switcher: Upload vs Camera */}
          {!isScanning && (
            <div className="flex items-center bg-stone-950 p-1 rounded-2xl border border-stone-800 text-xs max-w-sm">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upload');
                  stopCamera();
                }}
                className={`flex-1 py-1.5 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'upload'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>ফটো আপলোড (Upload)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('camera');
                  setPreviewImage(null);
                  startCamera();
                }}
                className={`flex-1 py-1.5 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'camera'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>ক্যামেরা স্ক্যান (Camera)</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Upload Dropzone Tab */}
          {activeTab === 'upload' && !isScanning && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                isDragOver
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-stone-800 hover:border-amber-500/60 bg-stone-950/50'
              } group`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition duration-300 border border-amber-500/20 mb-3 shadow-sm">
                <Upload className="w-6 h-6" />
              </div>

              <p className="text-sm font-semibold text-stone-200">
                আপনার রেফারেন্স মুখমণ্ডলের ছবি আপলোড করুন
              </p>
              <p className="text-xs text-stone-400 mt-1 max-w-sm">
                কম্পিউটার বা ফোনের গ্যালারি থেকে সেলফি বা সিঙ্গেল পোর্ট্রেট ছবি ড্র্যাগ করুন বা ক্লিক করে সিলেক্ট করুন
              </p>

              <div className="mt-4 flex items-center gap-2">
                <span className="px-4 py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-semibold group-hover:bg-amber-500 group-hover:text-stone-950 transition flex items-center gap-1.5 shadow-sm">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>ছবি নির্বাচন করুন (Browse File)</span>
                </span>
              </div>
            </div>
          )}

          {/* Camera Capture Tab */}
          {activeTab === 'camera' && !isScanning && (
            <div className="space-y-3 flex flex-col items-center">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden bg-black border-2 border-amber-500/40 shadow-xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Oval Face Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-40 h-52 border-2 border-dashed border-amber-400/80 rounded-[50%] shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-pulse flex items-center justify-center">
                    <span className="text-[10px] text-amber-300 font-mono bg-black/70 px-2 py-0.5 rounded-full backdrop-blur-xs">
                      মুখটি বৃত্তে রাখুন
                    </span>
                  </div>
                </div>

                {/* Flip Camera button */}
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition border border-stone-800"
                  title="ক্যামেরা সুইচ করুন"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={!cameraActive}
                onClick={handleCaptureCamera}
                className="px-6 py-2.5 rounded-2xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-bold transition flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>ছবি তুলুন ও স্ক্যান করুন (Capture Face)</span>
              </button>
            </div>
          )}

          {/* AI Scanning Progress State */}
          {isScanning && (
            <div className="text-center py-8 space-y-3.5 bg-stone-950/80 p-6 rounded-3xl border border-stone-850 animate-fade-in">
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
                <Sparkles className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
              </div>

              <div>
                <p className="font-serif text-base font-semibold text-stone-100">
                  {scanStatusText || 'মুখ স্ক্যান হচ্ছে...'}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  অ্যালবামের {photos.length}টি ফটোর সাথে কৃত্রিম বুদ্ধিমত্তা দিয়ে চেহারা মিল খোঁজা হচ্ছে
                </p>
              </div>

              <div className="max-w-xs mx-auto w-full bg-stone-900 h-2 rounded-full overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-linear-to-r from-amber-500 via-rose-500 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
