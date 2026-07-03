'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ArrowLeft, Eye, Info, MoreVertical, Trash2, X } from 'lucide-react';
import { api } from '@/lib/client/api-client';
import LoadingScreen from '@/components/LoadingScreen';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import { ReceiptCard } from '@/components/ReceiptCard';
import { ParticipantSplits } from '@/components/ParticipantSplits';
import { KebabMenu } from '@/components/KebabMenu';
import { ShareCodeBadge } from '@/components/ShareCodeBadge';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';
import { DiscrepancyReviewWizard } from '@/components/DiscrepancyReviewWizard';

const stepLabels = [
  { num: '01', label: 'Receipt Items' },
  { num: '02', label: 'Misc' },
  { num: '03', label: 'Discount' },
  { num: '04', label: 'Summary' },
];

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const receiptId = parseInt(resolvedParams.id);
  const router = useRouter();
  const { userId } = useAuth();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);
  const [addingAdjustment, setAddingAdjustment] = useState(false);
  const [showDiscrepancyInfo, setShowDiscrepancyInfo] = useState(false);
  const [showReviewWizard, setShowReviewWizard] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const data = await api.receipts.getSummary(receiptId);

        setSummary(data);
        setLoading(false);

        const hasAdjustment = data.receipt.lines?.some(l => l.receiptLineType === 'DADJ') ?? false;
        if (data.receipt.scannedTotal != null && !hasAdjustment) {
          const diff = data.receipt.scannedTotal - data.total;
          if (Math.abs(diff) > 0.01) {
            setShowMismatchModal(true);
          }
        }
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

  const handleAddAdjustment = async () => {
    if (!summary?.receipt.scannedTotal) {
      return;
    }
    const discrepancy = summary.receipt.scannedTotal - summary.total;
    try {
      setAddingAdjustment(true);
      await api.lines.create(receiptId, {
        itemName: 'Discrepancy Adjustment',
        quantity: 1,
        unitPrice: discrepancy,
        receiptLineType: 'DADJ',
        linePosition: summary.receipt.lines?.length ?? 0,
      });
      const updated = await api.receipts.getSummary(receiptId);
      setSummary(updated);
      setShowMismatchModal(false);
      setMismatchDismissed(false);
    } catch (err: any) {
      setError(err.message || 'Failed to add adjustment');
    } finally {
      setAddingAdjustment(false);
    }
  };

  const handleWizardDone = async () => {
    setShowReviewWizard(false);
    setShowMismatchModal(false);
    setMismatchDismissed(false);
    const updated = await api.receipts.getSummary(receiptId);
    setSummary(updated);
    const hasAdjustment = updated.receipt.lines?.some(l => l.receiptLineType === 'DADJ') ?? false;
    if (updated.receipt.scannedTotal != null && !hasAdjustment) {
      const diff = updated.receipt.scannedTotal - updated.total;
      if (Math.abs(diff) > 0.01) {
        setShowMismatchModal(true);
      }
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.receipts.delete(receiptId);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to delete receipt');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isOwner = !!userId && summary?.receipt.ownerId === userId;

  if (loading) return <LoadingScreen message="Loading summary..." />;

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

  const alreadyFinalized = summary.receipt.status === 'FLZD' || summary.receipt.status === 'STLD';
  const finalizeLabel = alreadyFinalized ? 'Save & View Split →' : 'Finalize Receipt →';
  const finalizeBusyLabel = alreadyFinalized ? 'Saving...' : 'Finalizing...';

  return (
    <div className="min-h-dvh flex flex-col bg-[#fff9ef] text-[#1b1b1b] pb-[196px]">

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-black w-full">
        <div className="px-5 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push(`/receipts/${receiptId}/assign`)}
            className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-dm-sans font-black text-sm uppercase tracking-tight text-[#7e7576]">Summary</span>
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
                <KebabMenu
                  className="z-50"
                  items={[
                    ...(summary?.receipt.imageURI ? [{
                      label: 'View Receipt',
                      icon: <Eye className="w-4 h-4 flex-shrink-0" />,
                      onClick: () => { setShowReceiptImage(true); setShowKebabMenu(false); },
                    }] : []),
                    ...(isOwner ? [{
                      label: 'Delete Receipt',
                      icon: <Trash2 className="w-4 h-4 flex-shrink-0" />,
                      variant: 'destructive' as const,
                      onClick: () => { setShowDeleteConfirm(true); setShowKebabMenu(false); },
                    }] : []),
                  ]}
                />
              </>
            )}
          </div>
        </div>

        {/* Row 2: receipt title + share code */}
        <div className="px-5 pb-3 flex items-center justify-between gap-2">
          <span className="font-dm-sans font-black text-xl tracking-tight uppercase">
            {summary.receipt.title || 'Untitled receipt'}
          </span>
          <ShareCodeBadge shareCode={summary.receipt.shareCode} title={summary.receipt.title || 'Receipt'} />
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

      {/* Mismatch Chip — shown after modal is dismissed */}
      {mismatchDismissed && summary?.receipt.scannedTotal != null && (
        <button
          onClick={() => { setShowMismatchModal(true); setMismatchDismissed(false); }}
          className="w-full flex items-center justify-center gap-2 px-5 py-2 bg-[#FFF3CD] border-b-2 border-black font-dm-mono text-[11px] font-bold uppercase tracking-wider hover:bg-[#FFE59A] transition-colors"
        >
          <span>⚠</span>
          <span>Totals don&apos;t match · Tap to resolve</span>
        </button>
      )}

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
        <ReceiptCard
          summary={summary}
          formatCurrency={formatCurrency}
          receiptId={receiptId}
          onSummaryUpdate={async () => {
            const updated = await api.receipts.getSummary(receiptId);
            setSummary(updated);
          }}
        />
        <ParticipantSplits
          receiptId={receiptId}
          participantSplits={summary.participantSplits}
          payerParticipantId={summary.receipt.payerParticipantId ?? null}
          formatCurrency={formatCurrency}
          isReceiptPayer={false}
          showPaymentUI={false}
        />
      </main>

      {/* Fixed Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-white border-t-4 border-black px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2">
        <button
          onClick={handleFinalize}
          disabled={finalizing}
          className="w-full h-16 border-[4px] border-black rounded-lg font-dm-mono font-bold text-base uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {finalizing ? finalizeBusyLabel : finalizeLabel}
        </button>
        {summary.receipt.imageURI && summary.receipt.lines && summary.receipt.lines.length > 0 ? (
          <button
            onClick={() => setShowReviewWizard(true)}
            className="w-full h-10 border-2 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Review Lines
          </button>
        ) : (
          <button
            onClick={() => router.push(`/receipts/${receiptId}/assign`)}
            className="w-full h-10 border-2 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            ← Edit Lines
          </button>
        )}
      </nav>

      {/* Mismatch Bottom Sheet */}
      {showMismatchModal && summary?.receipt.scannedTotal != null && (() => {
        const discrepancy = summary.receipt.scannedTotal - summary.total;
        const sign = discrepancy >= 0 ? '+' : '';
        return (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => { setShowMismatchModal(false); setMismatchDismissed(true); }}
            />
            <div className="fixed bottom-0 inset-x-0 z-[70] bg-white border-x-4 border-t-4 border-black rounded-t-xl shadow-[0px_-4px_0px_0px_#000] flex flex-col max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
              <div className="flex flex-col items-center gap-2 px-5 pt-5 pb-4 border-b-4 border-black">
                <div className="bg-[#FFF3CD] border-2 border-black w-10 h-10 flex items-center justify-center font-bold text-lg">
                  ⚠
                </div>
                <h2 className="font-dm-sans font-black text-xl uppercase tracking-tight">Total Mismatch</h2>
              </div>

              <div className="px-5 py-4 flex flex-col gap-4">
                <div className="flex border-2 border-black shadow-[2px_2px_0px_0px_#000] rounded-xl overflow-hidden">
                  <div className="flex-1 flex flex-col items-center justify-center py-3 px-2 gap-0.5">
                    <span className="font-dm-mono text-[10px] uppercase tracking-widest text-[#4d4732]">Scanned Receipt Total</span>
                    <span className="font-dm-mono font-bold text-lg">{formatCurrency(summary.receipt.scannedTotal)}</span>
                  </div>
                  <div className="w-0.5 bg-black" />
                  <div className="flex-1 flex flex-col items-center justify-center py-3 px-2 gap-0.5">
                    <span className="font-dm-mono text-[10px] uppercase tracking-widest text-[#4d4732]">Calculated Total</span>
                    <span className="font-dm-mono font-bold text-lg">{formatCurrency(summary.total)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="font-dm-mono text-[10px] uppercase tracking-widest text-[#4d4732]">Difference</span>
                  <span className="bg-[#FFD700] border-2 border-black px-2 py-0.5 font-dm-mono font-bold text-sm">
                    {sign}{formatCurrency(discrepancy)}
                  </span>
                </div>

                <p className="font-dm-sans text-sm text-center text-[#4d4732]">
                  Add an adjustment line to make the split match your receipt?
                </p>

                <button
                  onClick={() => setShowDiscrepancyInfo(v => !v)}
                  className="flex items-center justify-center gap-1.5 font-dm-mono text-[11px] text-[#4d4732] hover:text-black transition-colors"
                >
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Why is there a discrepancy?</span>
                </button>

                {showDiscrepancyInfo && (
                  <div className="font-dm-mono text-[11px] text-[#4d4732] bg-[#f3f3f3] border border-[#d0c6ab] rounded-lg px-3 py-2.5 leading-relaxed flex flex-col gap-2">
                    <p>Discrepancies happen when AI-extracted items don&apos;t perfectly sum to the receipt total — often due to VAT structures, rounding, or charges that couldn&apos;t be individually parsed.</p>
                    <p>If you know what&apos;s causing it, feel free to go back and add lines or edit amounts to reflect this discrepancy.</p>
                  </div>
                )}
              </div>

              <div className="px-5 pb-6 pt-4 border-t-4 border-black flex flex-col gap-2">
                <button
                  onClick={handleAddAdjustment}
                  disabled={addingAdjustment}
                  className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#FFD700] shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
                >
                  {addingAdjustment ? 'Adding...' : `Add ${sign}${formatCurrency(discrepancy)} Adjustment`}
                </button>
                {summary?.receipt.imageURI && summary.receipt.lines && summary.receipt.lines.length > 0 ? (
                  <button
                    onClick={() => { setShowMismatchModal(false); setShowReviewWizard(true); }}
                    className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Review Line by Line
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/receipts/${receiptId}/assign`)}
                    className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Go Back and Review Lines
                  </button>
                )}
                <button
                  onClick={() => { setShowMismatchModal(false); setMismatchDismissed(true); }}
                  className="font-dm-mono text-[10px] uppercase tracking-widest text-[#4d4732] hover:text-black transition-colors text-center py-1"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Discrepancy Review Wizard */}
      {summary?.receipt.imageURI && summary.receipt.lines && (
        <DiscrepancyReviewWizard
          isOpen={showReviewWizard}
          receiptId={receiptId}
          imageURI={summary.receipt.imageURI}
          lines={summary.receipt.lines}
          onClose={() => setShowReviewWizard(false)}
          onDone={handleWizardDone}
        />
      )}

      {/* Delete Confirmation Bottom Sheet */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-[70] bg-white border-x-4 border-t-4 border-black rounded-t-xl max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
            <div className="flex flex-col items-center gap-2 px-5 pt-5 pb-4 border-b-4 border-black">
              <div className="bg-[#ffdad6] border-2 border-black w-10 h-10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-[#93000a]" strokeWidth={2.5} />
              </div>
              <h2 className="font-dm-sans font-black text-xl uppercase tracking-tight">Delete receipt?</h2>
              <p className="font-dm-mono text-[11px] text-center text-[#4d4732]">
                This permanently deletes the receipt and all assigned line items. This cannot be undone.
              </p>
            </div>
            <div className="px-5 pt-4 pb-6 flex flex-col gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#fca5a5] text-[#93000a] shadow-[4px_4px_0px_0px_#000] hover:bg-[#ffdad6] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

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
