'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Eye, MoreVertical, X } from 'lucide-react';
import { api } from '@/lib/client/api-client';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';

const PARTICIPANT_COLORS = ['#ffd9de', '#cee7f0', '#ffe16d', '#b5ead7', '#e2d1f9', '#fce1a4', '#b8e0ff'];

const stepLabels = [
  { num: '01', label: 'Assign' },
  { num: '02', label: 'Misc' },
  { num: '03', label: 'Discount' },
  { num: '04', label: 'Summary' },
];

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const receiptId = parseInt(resolvedParams.id);
  const router = useRouter();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [isReceiptExpanded, setIsReceiptExpanded] = useState(false);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<number>>(new Set());
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);

  const toggleParticipantExpanded = (participantId: number) => {
    setExpandedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  };

  useEffect(() => {
    async function fetchSummary() {
      try {
        const data = await api.receipts.getSummary(receiptId);

        if (data.receipt.status === 'FLZD') {
          setLoading(false);
          router.push(`/${data.receipt.shareCode}`);
          return;
        }

        setSummary(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load summary');
        setLoading(false);
      }
    }

    fetchSummary();
  }, [receiptId, router]);

  const handleFinalize = async () => {
    try {
      setFinalizing(true);
      setError(null);
      const finalizedSummary = await api.receipts.finalize(receiptId);
      router.push(`/${finalizedSummary.receipt.shareCode}`);
    } catch (err: any) {
      setError(err.message || 'Failed to finalize receipt');
      setFinalizing(false);
    }
  };

  const formatCurrency = (amount: number) => `PHP${amount.toFixed(2)}`;

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fff9ef] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl p-8 flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
          <p className="font-dm-mono font-bold uppercase tracking-wider text-sm">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-[#fff9ef] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-red-600 shadow-[4px_4px_0px_0px_#000] rounded-xl p-6 max-w-sm w-full">
          <p className="font-dm-mono font-bold uppercase tracking-wider text-red-600 mb-2 text-xs">Error</p>
          <p className="font-dm-mono text-sm">{error || 'Failed to load summary'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 w-full h-12 border-[4px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[4px_4px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#fff9ef] text-[#1b1b1b] pb-[148px]">

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-black w-full">
        <div className="px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/receipts/${receiptId}/assign`)}
              className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-dm-sans font-black text-xl tracking-tight uppercase">Summary</h1>
          </div>
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
                  {summary?.receipt.imageURI && (
                    <button
                      onClick={() => { setShowReceiptImage(true); setShowKebabMenu(false); }}
                      className="flex items-center gap-2 px-4 py-3 font-dm-mono text-[11px] font-bold uppercase tracking-wide hover:bg-[#FFD700] transition-colors text-left"
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

        {/* Progress Stepper */}
        <div className="px-5 pb-2.5 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stepLabels.map((step, i) => {
            const isActive = i === stepLabels.length - 1;
            const isPast = i < stepLabels.length - 1;
            return (
              <React.Fragment key={step.num}>
                <div className="flex items-center gap-1 font-dm-mono text-[11px] font-bold whitespace-nowrap">
                  <span className={`px-1 ${isActive ? 'bg-black text-white' : isPast ? 'bg-[#e2e2e2] text-[#1b1b1b]' : 'text-[#7e7576]'}`}>
                    {step.num}
                  </span>
                  <span className={`uppercase ${isActive ? 'underline decoration-[#FFD700] decoration-[3px] underline-offset-4' : isPast ? '' : 'opacity-40'}`}>
                    {step.label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <span className="text-[10px] text-black">›</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="px-4 pt-3 max-w-lg mx-auto w-full">
          <div className="border-4 border-red-600 bg-red-50 p-3">
            <p className="font-dm-mono font-bold uppercase tracking-wider text-red-600 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 px-5 pt-5 pb-2 flex flex-col gap-4 max-w-lg mx-auto w-full">

        {/* Receipt Card */}
        <section className="bg-white border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] p-5">
          <h2 className="font-dm-sans font-bold text-2xl uppercase mb-4">Receipt</h2>

          <div className="flex justify-between items-end pb-3 border-b-2 border-black">
            <span className="font-dm-sans font-bold text-2xl uppercase">Total:</span>
            <span className="font-dm-mono font-bold text-2xl">{formatCurrency(summary.total)}</span>
          </div>

          <button
            onClick={() => setIsReceiptExpanded(!isReceiptExpanded)}
            className="w-full flex items-center justify-center gap-1 py-2 font-dm-mono text-xs text-[#4d4732] hover:text-black transition-colors"
          >
            {isReceiptExpanded ? 'Hide Details' : 'Show Details'}
            {isReceiptExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isReceiptExpanded && (
            <div className="pt-4 border-t-4 border-black">
              {/* Items */}
              <div className="space-y-0.5 mb-1">
                {summary.receipt.lines
                  ?.filter(line => line.receiptLineType === 'PRCH' && line.totalPrice !== 0)
                  .map(line => (
                    <div key={line.id} className="flex justify-between font-dm-mono text-[12px] py-1">
                      <span className="flex-1">{line.itemName}{line.quantity !== 1 && ` (×${line.quantity})`}</span>
                      <span className="font-bold ml-4">{formatCurrency(line.totalPrice)}</span>
                    </div>
                  ))}
              </div>

              {/* Subtotal */}
              <div className="flex justify-between font-dm-mono text-[12px] py-2 border-t-2 border-black">
                <span className="font-bold">Subtotal:</span>
                <span className="font-bold">{formatCurrency(summary.subtotal)}</span>
              </div>

              {/* Misc charges + discounts */}
              <div className="space-y-0.5 mt-1">
                {summary.receipt.lines
                  ?.filter(line => line.receiptLineType !== 'PRCH' && line.receiptLineType !== 'DSCT' && line.totalPrice !== 0)
                  .map(line => (
                    <div key={line.id} className="flex justify-between font-dm-mono text-[12px] py-1 text-[#4d4732]">
                      <span className="flex-1">{line.itemName}{line.quantity !== 1 && ` (×${line.quantity})`}</span>
                      <span className="font-bold ml-4">{formatCurrency(line.totalPrice)}</span>
                    </div>
                  ))}
                {summary.receipt.lines
                  ?.filter(line => line.receiptLineType === 'DSCT' && line.totalPrice !== 0)
                  .map(line => (
                    <div key={line.id} className="flex justify-between font-dm-mono text-[12px] py-1 text-green-700">
                      <span className="flex-1">{line.itemName}{line.quantity !== 1 && ` (×${line.quantity})`}</span>
                      <span className="font-bold ml-4">{formatCurrency(line.totalPrice)}</span>
                    </div>
                  ))}
              </div>

              {/* Grand Total */}
              <div className="flex justify-between font-dm-mono py-3 border-t-4 border-black mt-2">
                <span className="font-bold text-sm uppercase">Total:</span>
                <span className="font-bold text-sm">{formatCurrency(summary.total)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Participant Splits */}
        <h2 className="font-dm-sans font-bold text-2xl uppercase mt-2">Participant Splits</h2>

        {summary.participantSplits.map((split, i) => {
          const isExpanded = expandedParticipants.has(split.participantId);
          const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];

          return (
            <article key={split.participantId} className="bg-white border-4 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#f9f9f9] transition-colors"
                onClick={() => toggleParticipantExpanded(split.participantId)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-dm-sans text-[10px] font-bold shadow-[2px_2px_0px_0px_#000] flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {getInitials(split.displayName)}
                  </div>
                  <span className="font-dm-sans font-bold text-base uppercase">{split.displayName}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-dm-mono font-bold text-lg">{formatCurrency(split.total)}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t-4 border-black p-4 bg-[#fafafa]">
                  {/* Line Items */}
                  <div className="space-y-0.5 mb-3">
                    {split.lineItems.map((item) => {
                      const isDiscount = item.shareAmount < 0;
                      const adjustedDenominator = item.shareQuantity > 0
                        ? item.quantity / item.shareQuantity
                        : item.quantity;
                      return (
                        <div
                          key={item.receiptLineId}
                          className={`flex justify-between font-dm-mono text-[12px] py-1 ${isDiscount ? 'text-green-700' : ''}`}
                        >
                          <span>{item.itemName} (1/{adjustedDenominator.toFixed(0)})</span>
                          <span>{formatCurrency(item.shareAmount)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between font-dm-mono text-[12px] border-t-2 border-black pt-2 mt-1">
                      <span className="font-bold">Subtotal:</span>
                      <span className="font-bold">{formatCurrency(split.subtotal)}</span>
                    </div>
                  </div>

                  {/* Proportional Charges */}
                  <div className="space-y-0.5 mb-3">
                    {split.taxShare !== 0 && (
                      <div className="flex justify-between font-dm-mono text-[12px] text-[#4d4732]">
                        <span>Tax (proportional):</span>
                        <span>+{formatCurrency(split.taxShare)}</span>
                      </div>
                    )}
                    {split.tipShare !== 0 && (
                      <div className="flex justify-between font-dm-mono text-[12px] text-[#4d4732]">
                        <span>Tip (proportional):</span>
                        <span>+{formatCurrency(split.tipShare)}</span>
                      </div>
                    )}
                    {split.serviceChargeShare !== 0 && (
                      <div className="flex justify-between font-dm-mono text-[12px] text-[#4d4732]">
                        <span>Service Charge (proportional):</span>
                        <span>+{formatCurrency(split.serviceChargeShare)}</span>
                      </div>
                    )}
                    {split.discountShare !== 0 && (() => {
                      const assignedDiscountAmount = split.lineItems
                        .filter(item => item.shareAmount < 0)
                        .reduce((sum, item) => sum + item.shareAmount, 0);
                      const proportionalDiscountAmount = split.discountShare - assignedDiscountAmount;
                      return (
                        <>
                          {assignedDiscountAmount !== 0 && (
                            <div className="flex justify-between font-dm-mono text-[12px] text-green-700">
                              <span>Discount (assigned):</span>
                              <span>{formatCurrency(assignedDiscountAmount)}</span>
                            </div>
                          )}
                          {proportionalDiscountAmount !== 0 && (
                            <div className="flex justify-between font-dm-mono text-[12px] text-green-700">
                              <span>Discount (proportional):</span>
                              <span>{formatCurrency(proportionalDiscountAmount)}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Participant Total */}
                  <div className="flex justify-between font-dm-mono border-t-4 border-black pt-3">
                    <span className="font-bold text-sm uppercase">Total:</span>
                    <span className="font-bold text-sm">{formatCurrency(split.total)}</span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </main>

      {/* Fixed Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-white border-t-4 border-black px-4 pt-3 pb-4">
        <button
          onClick={handleFinalize}
          disabled={finalizing}
          className="w-full h-16 border-[4px] border-black rounded-lg font-dm-mono font-bold text-base uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {finalizing ? 'Finalizing...' : 'Finalize Receipt →'}
        </button>
        <div className="text-center mt-2">
          <button
            onClick={() => router.push('/')}
            className="font-dm-mono text-[10px] uppercase tracking-widest text-[#4d4732] hover:text-black transition-colors"
          >
          </button>
        </div>
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
