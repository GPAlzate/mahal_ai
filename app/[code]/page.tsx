'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, MoreVertical, X } from 'lucide-react';
import { api } from '@/lib/client/api-client';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import { ReceiptCard } from '@/components/ReceiptCard';
import { ParticipantSplits } from '@/components/ParticipantSplits';

const formatCurrency = (amount: number) => `PHP${amount.toFixed(2)}`;

export default function ShareCodePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const shareCode = resolvedParams.code.toUpperCase();
  const router = useRouter();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fff9ef] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl p-8 flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
          <p className="font-dm-mono font-bold uppercase tracking-wider text-sm">Loading receipt...</p>
        </div>
      </div>
    );
  }

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
                  <button
                    onClick={() => { router.push('/'); setShowKebabMenu(false); }}
                    className="flex items-center gap-2 px-4 py-3 font-dm-mono text-[11px] font-bold uppercase tracking-wide hover:bg-[#FFD700] transition-colors text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Receipt
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Share Code Badge */}
        <div className="flex items-center gap-2 bg-green-100 border-2 border-black rounded-lg px-3 py-2 self-center">
          <span className="font-dm-mono text-[10px] uppercase font-bold tracking-widest text-green-800">Share Code</span>
          <span className="font-dm-mono font-bold text-sm tracking-widest text-black">{summary.receipt.shareCode}</span>
        </div>

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
