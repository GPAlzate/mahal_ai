'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { api } from '@/lib/client/api-client';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

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

  const handleSubmit = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // Upload file directly to API (no Base64 conversion needed)
      const { receiptId } = await api.receipts.parse(file);

      // Navigate to participants page immediately
      router.push(`/receipts/${receiptId}/participants`);
    } catch (err: any) {
      setError(err.message || 'Failed to process receipt');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-wider mb-4">
            Upload Receipt
          </h1>
          <p className="text-lg font-mono">
            Take a photo or upload an image of your receipt to get started
          </p>
        </div>

        {/* Upload Area */}
        <Card padding="lg" className="mb-6">
          {!previewUrl ? (
            <div
              className={`
                border-4 border-dashed border-black
                p-12
                text-center
                cursor-pointer
                transition-colors
                ${dragActive ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <div className="mb-4">
                <svg
                  className="mx-auto h-24 w-24"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={4}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                  />
                </svg>
              </div>
              <p className="text-xl font-bold uppercase tracking-wider mb-2">
                Drop image here
              </p>
              <p className="font-mono text-sm">or click to browse</p>
              <input
                id="file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
              />
            </div>
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

        {/* Submit Button */}
        <Button
          fullWidth
          size="lg"
          onClick={handleSubmit}
          disabled={!file || loading}
        >
          {loading ? 'Processing...' : 'Continue'}
        </Button>

        {loading && (
          <div className="mt-6">
            <Card padding="md">
              <p className="font-mono text-center">
                AI is scanning your receipt... This may take a few seconds.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
