'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { upload } from '@vercel/blob/client';
import { Image, ArrowRight, Loader2, LogIn, Settings, LogOut } from 'lucide-react';
import { api, type MyReceipt } from '@/lib/client/api-client';

function formatParticipants(names: string[]): string | null {
  if (names.length === 0) {
    return null;
  }
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  const suffix = rest > 0 ? ` and ${rest} other${rest > 1 ? 's' : ''}` : '';
  return 'with ' + shown.join(', ') + suffix;
}

function receiptStatusLabel(status: string): string {
  if (status === 'STLD') {
    return 'Settled';
  }
  if (status === 'FLZD') {
    return 'Finalized';
  }
  if (status === 'DRFT') {
    return 'Draft';
  }
  return 'Processing';
}

function receiptStatusClass(status: string): string {
  if (status === 'STLD') {
    return 'bg-[#b8f5b8] border-black text-black';
  }
  if (status === 'FLZD') {
    return 'bg-[#98FB98] border-black text-black';
  }
  if (status === 'DRFT') {
    return 'bg-[#cee7f0] border-black text-black';
  }
  return 'bg-[#f3f3f3] border-black text-[#7e775f]';
}

interface Props {
  initialReceipts: MyReceipt[] | null;
}

export default function HomeClient({ initialReceipts }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [receiptTitle, setReceiptTitle] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState('');
  const [shareCodeError, setShareCodeError] = useState<string | null>(null);
  const [shareCodeLoading, setShareCodeLoading] = useState(false);

  const { user } = useUser();
  const { signOut } = useClerk();
  const isSignedIn = initialReceipts !== null;
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const avatarInitial = (user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? '?').toUpperCase();

  const blobPromiseRef = useRef<Promise<{ url: string }> | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const receiptIdPromiseRef = useRef<Promise<number> | null>(null);

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    uploadAbortRef.current?.abort();
    receiptIdPromiseRef.current = null;

    setFile(selectedFile);
    setError(null);

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    blobPromiseRef.current = upload(`receipts/${selectedFile.name}`, selectedFile, {
      access: 'public',
      handleUploadUrl: '/api/blob-upload',
      abortSignal: controller.signal,
    });

    const createPromise = api.receipts.create({ status: 'ULIP' });
    receiptIdPromiseRef.current = createPromise.then((r) => r.receiptId);

    const capturedBlob = blobPromiseRef.current;
    receiptIdPromiseRef.current.then((receiptId) => {
      capturedBlob
        .then((blob) => api.receipts.triggerParse(receiptId, blob.url))
        .catch(() => api.receipts.updateStatus(receiptId, 'DLTD').catch(() => {}));
    }).catch(() => {});

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileChange(file);
        }
        break;
      }
    }
  };

  const handleSubmit = async () => {
    if (!file || !receiptIdPromiseRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const receiptId = await receiptIdPromiseRef.current;
      router.push(`/receipts/${receiptId}/participants`);
    } catch (err: any) {
      setError(err.message || 'Failed to process receipt');
      setLoading(false);
    }
  };

  const handleManualReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiptTitle.trim()) return;

    setManualLoading(true);
    setManualError(null);

    try {
      const data = await api.receipts.create({
        status: 'DRFT',
        title: receiptTitle.trim(),
      });

      router.push(`/receipts/${data.receiptId}/participants`);
    } catch (err: any) {
      setManualError(err.message || 'Failed to create receipt');
      setManualLoading(false);
    }
  };

  const handleShareCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = shareCode.trim().toUpperCase();
    if (!code) return;
    setShareCodeError(null);
    setShareCodeLoading(true);
    try {
      await api.receipts.getByShareCode(code);
      router.push(`/${code}`);
    } catch {
      setShareCodeError("Oops! We couldn't find that receipt.");
      setShareCodeLoading(false);
    }
  };

  const inputClass = "w-full h-12 border-2 border-black rounded-lg px-4 font-dm-mono text-base focus:border-[4px] focus:outline-none focus:bg-[#cee7f0] bg-white placeholder:text-[#7e775f] transition-all";
  const labelClass = "font-dm-mono text-[10px] uppercase font-bold tracking-widest text-[#4d4732]";

  return (
    <div
      className="min-h-screen bg-[#fff9ef]"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <div className="max-w-lg mx-auto p-4 pb-20">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-dm-sans text-2xl font-black uppercase px-3 py-2 bg-black text-white inline-block -rotate-1">
            mahal ai &lt;3
          </h1>

          {isSignedIn ? (
            <div className="relative">
              <button
                onClick={() => setAccountMenuOpen((o) => !o)}
                className="w-10 h-10 border-[3px] border-black bg-[#FFD700] rounded-full font-dm-sans font-black text-sm flex items-center justify-center cursor-pointer hover:bg-[#FFE44D] transition-colors shadow-[2px_2px_0px_0px_#000]"
                aria-label="Account menu"
              >
                {avatarInitial}
              </button>

              {accountMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAccountMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-20 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] rounded-lg overflow-hidden min-w-[140px]">
                    <button
                      onClick={() => { router.push('/settings'); setAccountMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 font-dm-mono text-sm hover:bg-[#fff9ef] transition-colors cursor-pointer text-left border-b-2 border-black"
                    >
                      <Settings className="w-4 h-4" strokeWidth={2.5} />
                      Settings
                    </button>
                    <button
                      onClick={() => signOut().then(() => setAccountMenuOpen(false))}
                      className="w-full flex items-center gap-2 px-4 py-3 font-dm-mono text-sm hover:bg-[#fff9ef] transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4" strokeWidth={2.5} />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <a
              href="/login"
              className="h-10 px-4 border-[3px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#fff9ef] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" strokeWidth={2.5} />
              Log in
            </a>
          )}
        </div>

        {/* Main card */}
        <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] rounded-xl p-5 flex flex-col gap-4">

          <h2 className="font-dm-sans font-black text-3xl">New Split</h2>

          {!previewUrl ? (
            <>
              {/* Drop zone */}
              <div
                className={`border-4 border-black rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  dragActive ? 'bg-black text-white' : 'bg-[#f3f3f3] hover:bg-[#e8e8e8]'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Image className="mx-auto h-14 w-14 mb-3" strokeWidth={2.5} />
                <p className="font-dm-sans font-bold text-lg uppercase tracking-wide mb-1">
                  Drop image here
                </p>
                <p className="font-dm-mono text-xs text-[#4d4732] mb-0.5">or click to browse</p>
                <p className="font-dm-mono text-xs text-[#4d4732]">Paste (Ctrl+V) also works!</p>
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                />
              </div>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t-2 border-black" />
                <span className="font-dm-mono text-xs font-bold uppercase tracking-widest text-[#4d4732]">or</span>
                <div className="flex-1 border-t-2 border-black" />
              </div>

              {/* Manual receipt form */}
              <form onSubmit={handleManualReceiptSubmit} className="flex flex-col gap-2">
                <label className={labelClass}>Create a receipt manually</label>
                <input
                  className={inputClass}
                  placeholder="e.g. 2am Jollibee"
                  value={receiptTitle}
                  onChange={(e) => setReceiptTitle(e.target.value)}
                  disabled={manualLoading}
                />
                {manualError && (
                  <p className="font-dm-mono text-xs font-bold text-red-600 uppercase tracking-wider">{manualError}</p>
                )}
                <button
                  type="submit"
                  disabled={!receiptTitle.trim() || manualLoading}
                  className="w-full h-12 border-[4px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {manualLoading ? 'Creating...' : 'Create'}
                </button>
              </form>
            </>
          ) : (
            <>
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="w-full max-h-64 object-contain border-4 border-black rounded-lg"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-14 border-[4px] border-black rounded-lg font-dm-mono font-bold text-base uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
              >
                {loading ? 'Creating receipt...' : 'Continue →'}
              </button>
              <button
                type="button"
                onClick={() => {
                  uploadAbortRef.current?.abort();
                  uploadAbortRef.current = null;
                  blobPromiseRef.current = null;
                  receiptIdPromiseRef.current = null;
                  setFile(null);
                  setPreviewUrl(null);
                }}
                className="w-full h-12 border-2 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Choose Different Image
              </button>
            </>
          )}
        </div>

        {/* My Receipts — teaser for guests, full list for signed-in users */}
        <div className="mt-4 bg-white border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl p-5 flex flex-col gap-3">
          <h2 className="font-dm-sans font-bold text-2xl">My Receipts</h2>
          {!isSignedIn ? (
            <div className="relative overflow-hidden rounded-lg">
              {/* Ghost receipt rows — blurred to hint at the feature */}
              <div className="flex flex-col border-2 border-black rounded-lg overflow-hidden select-none pointer-events-none blur-[2px]">
                {[
                  { title: 'Post-climbing Jiangnan', status: 'FLZD', date: 'May 10, 2025', with: 'with Maria, Juan' },
                  { title: 'Manam family dinner', status: 'DRFT', date: 'May 7, 2025', with: 'with Bea and 2 others' },
                  { title: 'Midnight Mcdonalds', status: 'FLZD', date: 'Apr 22, 2025', with: 'with Carlo, Ana' },
                ].map((r, index) => (
                  <div
                    key={r.title}
                    className={`flex items-center justify-between px-4 py-3 bg-white ${index > 0 ? 'border-t-2 border-black' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-dm-sans font-bold text-sm truncate">{r.title}</span>
                        <span className={`font-dm-mono text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 ${receiptStatusClass(r.status)}`}>
                          {receiptStatusLabel(r.status)}
                        </span>
                      </div>
                      <span className="font-dm-mono text-[10px] text-[#7e775f]">{r.date} · {r.with}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0 ml-3 text-[#4d4732]" strokeWidth={2.5} />
                  </div>
                ))}
              </div>
              {/* Gradient overlay with sign-up CTA */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-white/50 to-white rounded-lg">
                <p className="font-dm-sans font-bold text-sm mb-0.5 text-center">Never lose a receipt again</p>
                <p className="font-dm-mono text-[10px] text-[#4d4732] mb-3 text-center">Sign up for free and track every group bill</p>
                <a
                  href="/sign-up"
                  className="h-11 px-5 border-[4px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center gap-2"
                >
                  Sign up <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </a>
              </div>
            </div>
          ) : initialReceipts!.length === 0 ? (
            <p className="font-dm-mono text-sm text-[#7e775f]">No receipts yet — split a bill to get started.</p>
          ) : (
            <>
              <div className="flex flex-col border-2 border-black rounded-lg overflow-hidden">
                {initialReceipts!.slice(0, 3).map((r, index) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => router.push(`/${r.shareCode}`)}
                    className={`flex items-center justify-between px-4 py-3 bg-white hover:bg-[#fff9ef] active:bg-[#f3f3f3] transition-colors cursor-pointer text-left ${index > 0 ? 'border-t-2 border-black' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-dm-sans font-bold text-sm truncate">{r.title || 'Untitled receipt'}</span>
                        <span className={`font-dm-mono text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 ${receiptStatusClass(r.status)}`}>
                          {receiptStatusLabel(r.status)}
                        </span>
                      </div>
                      <span className="font-dm-mono text-[10px] text-[#7e775f]">
                        {new Date(r.receiptTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {formatParticipants(r.participantNames) && ` · ${formatParticipants(r.participantNames)}`}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0 ml-3 text-[#4d4732]" strokeWidth={2.5} />
                  </button>
                ))}
              </div>
              {initialReceipts!.length > 3 && (
                <button
                  type="button"
                  onClick={() => router.push('/receipts')}
                  className="w-full font-dm-mono text-xs font-bold uppercase tracking-widest text-[#4d4732] hover:text-black transition-colors cursor-pointer text-center py-1"
                >
                  See all {initialReceipts!.length} receipts →
                </button>
              )}
            </>
          )}
        </div>

        {/* Share code — compact tertiary strip */}
        <div className="mt-3 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] rounded-xl p-4 flex flex-col gap-2">
          <p className={labelClass}>Have a share code?</p>
          <form onSubmit={handleShareCodeSubmit}>
            <div className="flex gap-2">
              <input
                className="flex-1 h-11 border-2 border-black rounded-lg px-4 font-dm-mono text-sm focus:border-[3px] focus:outline-none focus:bg-[#cee7f0] bg-white placeholder:text-[#7e775f] transition-all"
                placeholder="e.g. ABCDE"
                value={shareCode}
                onChange={(e) => { setShareCode(e.target.value.toUpperCase().slice(0, 5)); setShareCodeLoading(false); setShareCodeError(null); }}
                maxLength={5}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={!shareCode.trim() || shareCodeLoading}
                className="h-11 px-4 border-[3px] border-black rounded-lg bg-[#FFD700] text-black shadow-[3px_3px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {shareCodeLoading
                  ? <Loader2 strokeWidth={2.5} className="h-4 w-4 animate-spin" />
                  : <ArrowRight strokeWidth={2.5} className="h-4 w-4" />
                }
              </button>
            </div>
          </form>
          {shareCodeError && (
            <p className="font-dm-mono text-xs font-bold text-red-600 uppercase tracking-wider">{shareCodeError}</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 border-2 border-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <p className="font-dm-mono text-xs font-bold uppercase tracking-wider text-red-600">{error}</p>
          </div>
        )}

      </div>
    </div>
  );
}
