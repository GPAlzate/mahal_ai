'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, MoreVertical, X, Share2, Check } from 'lucide-react';
import { api } from '@/lib/client/api-client';
import LoadingScreen from '@/components/LoadingScreen';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import { ReceiptCard } from '@/components/ReceiptCard';
import { ParticipantSplits } from '@/components/ParticipantSplits';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

export default function ShareCodePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const shareCode = resolvedParams.code.toUpperCase();
  const router = useRouter();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const data = await api.receipts.getByShareCode(shareCode);

        if (data.receipt.status !== 'FLZD') {
          setError('This receipt has not been finalized yet.');
          setLoading(false);
          return;
        }

        setSummary(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
        setLoading(false);
      }
    }

    fetchSummary();
  }, [shareCode]);

  const handleShare = async () => {
    const url = `${window.location.origin}/${summary?.receipt.shareCode}`;
    const title = summary?.receipt.title || 'Receipt';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user dismissed the share sheet — no-op
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  if (loading) return <LoadingScreen message="Loading receipt..." />;

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-[#fff9ef] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-red-600 shadow-[4px_4px_0px_0px_#000] rounded-xl p-6 max-w-sm w-full">
          <p className="font-dm-mono font-bold uppercase tracking-wider text-red-600 mb-2 text-xs">Error</p>
          <p className="font-dm-mono text-sm">{error || 'Failed to load receipt'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff9ef] pb-[88px]">
      <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-dm-sans text-2xl font-black uppercase px-3 py-2 bg-black text-white inline-block -rotate-1">
            mahal ai &lt;3
          </h1>
          <div className="relative">
            <button
              onClick={() => setShowKebabMenu(v => !v)}
              className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showKebabMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowKebabMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] w-44 flex flex-col">
                  {summary.receipt.imageURI && (
                    <button
                      onClick={() => { setShowReceiptImage(true); setShowKebabMenu(false); }}
                      className="flex items-center gap-2 px-4 py-3 border-b-2 border-black font-dm-mono text-[11px] font-bold uppercase tracking-wide hover:bg-[#FFD700] transition-colors text-left"
                    >
                      <Eye className="w-4 h-4 flex-shrink-0" />
                      View Receipt
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Share Code Badge */}
        <button
          onClick={handleShare}
          className="flex items-center gap-2 bg-green-100 border-2 border-black rounded-lg px-3 py-2 self-start shadow-[2px_2px_0px_0px_#000] hover:bg-green-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
        >
          {shared
            ? <Check className="w-3.5 h-3.5 text-green-800" strokeWidth={2.5} />
            : <Share2 className="w-3.5 h-3.5 text-green-800" strokeWidth={2.5} />
          }
          <span className="font-dm-mono text-[10px] uppercase font-bold tracking-widest text-green-800">
            {shared ? 'Copied!' : 'Share'}
          </span>
          <span className="font-dm-mono font-bold text-sm tracking-widest text-black">{summary.receipt.shareCode}</span>
        </button>

        <ReceiptCard summary={summary} formatCurrency={formatCurrency} />
        <ParticipantSplits participantSplits={summary.participantSplits} formatCurrency={formatCurrency} />

        {/* Bottom padding for fixed nav */}
        <div className="h-4" />
      </div>

      {/* Fixed Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-white border-t-4 border-black px-4 pt-3 pb-4">
        <button
          onClick={() => router.push('/')}
          className="w-full h-14 border-[4px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
        >
          Create New Receipt →
        </button>
      </nav>

      {/* Receipt Image Modal */}
      {showReceiptImage && summary.receipt.imageURI && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowReceiptImage(false)}
        >
          <div
            className="relative max-w-lg w-full mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowReceiptImage(false)}
              className="absolute -top-3 -right-3 z-10 bg-white border-4 border-black p-2 hover:bg-red-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="overflow-auto bg-white border-4 border-black">
              <img src={summary.receipt.imageURI} alt="Original receipt" className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
