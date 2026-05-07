'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Image, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/client/api-client';

export default function Home() {
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

  const blobPromiseRef = useRef<Promise<{ url: string }> | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  // Pre-created receipt ID so Continue just navigates without any DB round-trip.
  const receiptIdPromiseRef = useRef<Promise<number> | null>(null);

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Cancel any in-progress blob upload from a previously selected image.
    // The old receipt (if any) stays as an orphaned ULIP record and gets cleaned up later.
    uploadAbortRef.current?.abort();
    receiptIdPromiseRef.current = null;

    setFile(selectedFile);
    setError(null);

    // Start blob upload immediately while user reviews preview.
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    blobPromiseRef.current = upload(`receipts/${selectedFile.name}`, selectedFile, {
      access: 'public',
      handleUploadUrl: '/api/blob-upload',
      abortSignal: controller.signal,
    });

    // Create the receipt record immediately (status=ULIP) in parallel with blob upload.
    receiptIdPromiseRef.current = api.receipts.create({ status: 'ULIP' }).then((r) => r.receiptId);

    // Once both are ready, trigger AI parsing. By the time the user finishes entering
    // participant names the parse will likely be complete. On failure, mark DLTD so
    // the participants page polling surfaces the error.
    const capturedBlob = blobPromiseRef.current;
    receiptIdPromiseRef.current.then((receiptId) => {
      capturedBlob
        .then((blob) => api.receipts.triggerParse(receiptId, blob.url))
        .catch(() => api.receipts.updateStatus(receiptId, 'DLTD').catch(() => {}));
    }).catch(() => {}); // receipt create failed — surfaced on Continue click

    // Create preview
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
      // Receipt was already created on image select — just await the ID and navigate.
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
      <div className="max-w-lg mx-auto p-4">

        {/* Header */}
        <div className="mb-4">
          <h1 className="font-dm-sans text-2xl font-black uppercase px-3 py-2 bg-black text-white inline-block -rotate-1">
            mahal ai &lt;3
          </h1>
        </div>

        {/* Main card */}
        <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl p-5 flex flex-col gap-4">

          <h2 className="font-dm-sans font-bold text-2xl">Upload a receipt 😀</h2>

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

        {/* Share code card */}
        <div className="mt-4 bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl p-5 flex flex-col gap-3">
          <h2 className="font-dm-sans font-bold text-2xl">View a shared receipt</h2>
          <form onSubmit={handleShareCodeSubmit} className="flex flex-col gap-2">
            <label className={labelClass}>Enter Receipt Share Code</label>
            <div className="flex gap-2">
            <input
              className="flex-1 h-12 border-2 border-black rounded-lg px-4 font-dm-mono text-base focus:border-[4px] focus:outline-none focus:bg-[#cee7f0] bg-white placeholder:text-[#7e775f] transition-all"
              placeholder="e.g. ABCDE"
              value={shareCode}
              onChange={(e) => { setShareCode(e.target.value.slice(0, 5)); setShareCodeLoading(false); setShareCodeError(null); }}
              maxLength={5}
            />
            <button
              type="submit"
              disabled={!shareCode.trim() || shareCodeLoading}
              className="h-12 px-4 border-[4px] border-black rounded-lg bg-green-100 text-black shadow-[4px_4px_0px_0px_#000] hover:bg-green-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {shareCodeLoading
                ? <Loader2 strokeWidth={2.5} className="h-5 w-5 animate-spin" />
                : <ArrowRight strokeWidth={2.5} className="h-5 w-5" />
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

        {/* Continue button — only when image selected */}
        {file && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-4 h-14 border-[4px] border-black rounded-lg font-dm-mono font-bold text-base uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
          >
            {loading ? 'Creating receipt...' : 'Continue →'}
          </button>
        )}

      </div>
    </div>
  );
}
