'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Image } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { api } from '@/lib/client/api-client';

export default function Home() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [shareCodeLoading, setShareCodeLoading] = useState(false);
  const [shareCodeError, setShareCodeError] = useState<string | null>(null);
  const [receiptTitle, setReceiptTitle] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setFile(selectedFile);
    setError(null);

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
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      console.time('🕐 total');

      console.time('🕐 blob upload (client → CDN)');
      const blob = await upload(`receipts/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/blob-upload',
      });
      console.timeEnd('🕐 blob upload (client → CDN)');

      console.time('🕐 create receipt');
      const { receiptId } = await api.receipts.parse(blob.url);
      console.timeEnd('🕐 create receipt');

      console.timeEnd('🕐 total');
      router.push(`/receipts/${receiptId}/participants`);
    } catch (err: any) {
      setError(err.message || 'Failed to process receipt');
      setLoading(false);
    }
  };

  const handleShareCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shareCode.trim()) return;

    setShareCodeLoading(true);
    setShareCodeError(null);

    try {
      // Try to fetch the receipt by share code
      await api.receipts.getByShareCode(shareCode.trim().toUpperCase());

      // If successful, redirect to the share code page
      router.push(`/${shareCode.trim().toUpperCase()}`);
    } catch (err: any) {
      setShareCodeError('Receipt not found');
      setShareCodeLoading(false);
    }
  };

  const handleManualReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiptTitle.trim()) return;

    setManualLoading(true);
    setManualError(null);

    try {
      // Create manual receipt via API client
      const data = await api.receipts.create({
        title: receiptTitle.trim()
      });

      // Navigate to participants page
      router.push(`/receipts/${data.receiptId}/participants`);
    } catch (err: any) {
      setManualError(err.message || 'Failed to create receipt');
      setManualLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-yellow-50 p-4 md:p-8"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 p-4 bg-black text-white inline-block transform -rotate-1">
            mahal ai &lt;3
          </h1>
        </div>

        {/* Upload Area */}
        <Card padding="lg" className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Upload a receipt 😀</h2>

          {!previewUrl ? (
            <>
              <div
                className={`
                  border-4 border-black
                  p-12
                  text-center
                  cursor-pointer
                  transition-colors
                  ${dragActive ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div className="mb-4">
                  <Image className="mx-auto h-16 w-16" strokeWidth={2.5} />
                </div>
                <p className="text-xl font-bold uppercase tracking-wider mb-2">
                  Drop image here
                </p>
                <p className="text-xs mb-1">or click to browse</p>
                <p className="text-xs">Paste (Ctrl+V) also works!</p>
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                />
              </div>

              {/* Divider inside card */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t-2 border-black"></div>
                <span className="px-4 font-mono text-sm uppercase tracking-wider">or</span>
                <div className="flex-1 border-t-2 border-black"></div>
              </div>

              {/* Manual Receipt Entry inside same card */}
              <form onSubmit={handleManualReceiptSubmit}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="e.g. Dinner at Chipotle"
                    value={receiptTitle}
                    onChange={(e) => setReceiptTitle(e.target.value)}
                    fullWidth
                    error={manualError || undefined}
                  />
                  <Button
                    type="submit"
                    disabled={!receiptTitle.trim() || manualLoading}
                  >
                    {manualLoading ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div>
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="w-full border-4 border-black mb-4"
              />
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                }}
              >
                Choose Different Image
              </Button>
            </div>
          )}
        </Card>

        {/* Error Message */}
        {error && (
          <Card padding="md" className="mb-6 border-red-600">
            <p className="font-bold uppercase tracking-wider text-red-600">{error}</p>
          </Card>
        )}

        {/* Submit Button - only show when file is selected */}
        {file && (
          <Button
            fullWidth
            size="lg"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating receipt...' : 'Continue'}
          </Button>
        )}

        {/* Share Code Entry */}
        {/* <Card padding="lg">
          <h2 className="text-2xl font-bold tracking-wider mb-2">
            Already have a receipt?
          </h2>
          <p className="text-sm mb-4">
            Enter your share code below to view it
          </p>

          <form onSubmit={handleShareCodeSubmit}>
            <div className="flex gap-4">
              <Input
                placeholder="e.g. A1B2C"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                fullWidth
                maxLength={10}
                error={shareCodeError || undefined}
              />
              <Button
                type="submit"
                disabled={!shareCode.trim() || shareCodeLoading}
              >
                {shareCodeLoading ? 'Loading...' : 'View'}
              </Button>
            </div>
          </form>
        </Card> */}
      </div>
    </div>
  );
}