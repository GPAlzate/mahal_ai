'use client';

import { useState, useEffect, use } from 'react';

function normalizeGcash(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return digits;
  }
  return null;
}

function formatGcashDisplay(raw: string): string {
  return `0${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`;
}
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Eye, MoreVertical, X, Share2, HelpCircle } from 'lucide-react';

import Link from 'next/link';
import { api } from '@/lib/client/api-client';
import LoadingScreen from '@/components/LoadingScreen';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import { ReceiptCard } from '@/components/ReceiptCard';
import { ParticipantSplits } from '@/components/ParticipantSplits';
import { KebabMenu } from '@/components/KebabMenu';
import { ShareCodeBadge } from '@/components/ShareCodeBadge';
import { SaveSplitsNudge } from '@/components/SaveSplitsNudge';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

export default function ShareCodePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const shareCode = resolvedParams.code.toUpperCase();
  const router = useRouter();
  const { userId } = useAuth();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [gcashInput, setGcashInput] = useState('');
  const [gcashSaving, setGcashSaving] = useState(false);
  const [gcashSaved, setGcashSaved] = useState(false);
  const [gcashError, setGcashError] = useState('');
  const [gcashCopied, setGcashCopied] = useState(false);
  const [isEditingGcash, setIsEditingGcash] = useState(true);


  const payerParticipant = summary?.participantSplits.find(
    p => p.participantId === summary.receipt.payerParticipantId
  );
  const isReceiptPayer = !!userId && !!payerParticipant?.userId && userId === payerParticipant.userId;

  useEffect(() => {
    if (!localStorage.getItem('mahal_share_help_seen')) {
      const t = setTimeout(() => setShowHelpModal(true), 1000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismissHelpModal = () => {
    localStorage.setItem('mahal_share_help_seen', '1');
    setShowHelpModal(false);
  };

  useEffect(() => {
    async function fetchReceipt() {
      try {
        const receipt = await api.receipts.getByShareCode(shareCode);
        const { status, id } = receipt;

        if (status === 'ULIP' || status === 'PRSP') {
          router.replace(`/receipts/${id}/participants`);
          return;
        }
        if (status === 'DRFT') {
          router.replace(`/receipts/${id}/assign`);
          return;
        }

        const data = await api.receipts.getSummary(id);
        setSummary(data);
        setGcashInput(data.receipt.gcashNumber ? formatGcashDisplay(data.receipt.gcashNumber) : '');
        setIsEditingGcash(!data.receipt.gcashNumber);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
        setLoading(false);
      }
    }

    fetchReceipt();
  }, [shareCode, router]);


const handleSaveGcash = async () => {
    if (!summary) {
      return;
    }
    const trimmed = gcashInput.trim();
    if (trimmed === '') {
      setGcashError('');
      setGcashSaving(true);
      try {
        await api.receipts.updateGcashNumber(summary.receipt.id, null);
        setSummary(prev => prev ? { ...prev, receipt: { ...prev.receipt, gcashNumber: null }, payerGcashNumber: null } : prev);
        setGcashSaved(true);
        setTimeout(() => setGcashSaved(false), 2000);
      } catch {
        // silent
      } finally {
        setGcashSaving(false);
      }
      return;
    }
    const normalized = normalizeGcash(trimmed);
    if (normalized === null) {
      setGcashError('Enter a valid PH number (09XX XXX XXXX)');
      return;
    }
    setGcashError('');
    setGcashSaving(true);
    try {
      await api.receipts.updateGcashNumber(summary.receipt.id, normalized);
      setSummary(prev => prev ? { ...prev, receipt: { ...prev.receipt, gcashNumber: normalized }, payerGcashNumber: normalized } : prev);
      setGcashInput(formatGcashDisplay(normalized));
      setGcashSaved(true);
      setIsEditingGcash(false);
      setTimeout(() => setGcashSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setGcashSaving(false);
    }
  };

  const handleCopyGcash = () => {
    if (!summary?.payerGcashNumber) {
      return;
    }
    navigator.clipboard.writeText(formatGcashDisplay(summary.payerGcashNumber));
    setGcashCopied(true);
    setTimeout(() => setGcashCopied(false), 2000);
  };

  if (loading) {
    return <LoadingScreen message="Loading receipt..." />;
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
    <div className="min-h-screen bg-[#fff9ef]">
      <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <Link href="/">
            <h1 className="font-dm-sans text-2xl font-black uppercase px-3 py-2 bg-black text-white inline-block -rotate-1">
              mahal ai &lt;3
            </h1>
          </Link>
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
                    ...(summary.receipt.imageURI ? [{
                      label: 'View Receipt',
                      icon: <Eye className="w-4 h-4 flex-shrink-0" />,
                      onClick: () => { setShowReceiptImage(true); setShowKebabMenu(false); },
                    }] : []),
                    {
                      label: 'How to use',
                      icon: <HelpCircle className="w-4 h-4 flex-shrink-0" />,
                      onClick: () => { setShowHelpModal(true); setShowKebabMenu(false); },
                    },
                  ]}
                />
              </>
            )}
          </div>
        </div>

        <ShareCodeBadge shareCode={summary.receipt.shareCode} title={summary.receipt.title || 'Receipt'} />

        <ReceiptCard summary={summary} formatCurrency={formatCurrency} />

        {isReceiptPayer && (
          <div className="border-4 border-black rounded-xl bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden">
            <div className="bg-[#0066FF] px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-white">GCash number</p>
                <p className="font-dm-mono text-[11px] text-blue-200">So people know how to pay you</p>
              </div>
              {!isEditingGcash && summary.receipt.gcashNumber && (
                <button
                  onClick={() => setIsEditingGcash(true)}
                  className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-blue-200 hover:text-white transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              {isEditingGcash ? (
                <>
                  <div className="flex gap-2 items-center">
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="09XX XXX XXXX"
                      value={gcashInput}
                      onChange={e => {
                        setGcashInput(e.target.value);
                        setGcashSaved(false);
                        setGcashError('');
                      }}
                      className="flex-1 h-10 border-2 border-black rounded-lg px-3 font-dm-mono text-sm bg-white focus:outline-none focus:border-[#0066FF] transition-colors"
                    />
                    <button
                      onClick={handleSaveGcash}
                      disabled={gcashSaving}
                      className="h-10 px-4 border-2 border-black rounded-lg font-dm-mono text-xs font-bold uppercase bg-[#FFD700] shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-50"
                    >
                      {gcashSaving ? '...' : gcashSaved ? 'Saved!' : 'Save'}
                    </button>
                  </div>
                  {gcashError && (
                    <p className="font-dm-mono text-[11px] text-red-600">{gcashError}</p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="font-dm-mono font-bold text-xl tracking-wider">
                    {formatGcashDisplay(summary.receipt.gcashNumber!)}
                  </p>
                  <button
                    onClick={handleCopyGcash}
                    className="h-9 px-4 border-2 border-black rounded-lg font-dm-mono text-xs font-bold bg-white hover:bg-[#fff9ef] shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    {gcashCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!isReceiptPayer && summary.payerGcashNumber && (
          <div className="border-4 border-black rounded-xl bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden">
            <div className="bg-[#0066FF] px-4 py-2.5">
              <p className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-white">
                {payerParticipant
                  ? `${payerParticipant.displayName}${payerParticipant.displayName.endsWith('s') ? "'" : "'s"} GCash`
                  : "GCash Number"}
              </p>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="font-dm-mono font-bold text-xl tracking-wider">
                {formatGcashDisplay(summary.payerGcashNumber)}
              </p>
              <button
                onClick={handleCopyGcash}
                className="h-9 px-4 border-2 border-black rounded-lg font-dm-mono text-xs font-bold bg-white hover:bg-[#fff9ef] shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                {gcashCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <ParticipantSplits
          receiptId={summary.receipt.id}
          participantSplits={summary.participantSplits}
          payerParticipantId={summary.receipt.payerParticipantId ?? null}
          formatCurrency={formatCurrency}
          isReceiptPayer={isReceiptPayer}
        />
        <div className="mt-4">
          <SaveSplitsNudge />
        </div>

        <div className="h-4" />
      </div>

      {/* How to Use Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={dismissHelpModal}
        >
          <div className="w-full max-w-sm flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] overflow-hidden">
              {/* Header */}
              <div className="bg-[#FFD700] border-b-4 border-black px-4 py-2 flex justify-between items-center">
                <h2 className="font-dm-sans font-black text-xl uppercase tracking-tight">How to use</h2>
                <button
                  onClick={dismissHelpModal}
                  className="p-1 border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isReceiptPayer ? (
                <div className="p-4 flex flex-col gap-4">

                  {/* Section 1: Share link */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest text-[#7e775f]">01 — Share with group</span>
                    <div className="border-2 border-black p-4 bg-stone-50 flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2 border-2 border-black bg-green-100 py-2 px-3 w-full justify-center">
                        <Share2 className="w-3.5 h-3.5 text-green-800" strokeWidth={2.5} />
                        <span className="font-dm-mono text-[8px] font-bold uppercase tracking-widest text-green-800">Share with group</span>
                        <span className="font-dm-mono text-[9px] font-bold text-black">6JM3W</span>
                      </div>
                      <p className="font-dm-sans font-bold text-sm text-center">
                        Tap Share to send the link to everyone who owes you.
                      </p>
                    </div>
                  </div>

                  {/* Section 2: CONFIRM? → PAID */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest text-[#7e775f]">02 — Confirm payment</span>
                    <div className="border-2 border-black p-4 bg-stone-50 flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2 w-full justify-center">
                        <div className="flex items-center gap-2 border-2 border-black bg-white px-2 py-1.5">
                          <div className="w-6 h-6 rounded-full bg-[#ffe16d] border-2 border-black flex items-center justify-center font-dm-sans text-[8px] font-bold">KP</div>
                          <span className="font-dm-sans font-bold text-[10px] uppercase">Kate</span>
                          <span className="px-1.5 py-0.5 border-2 border-black bg-[#FFD700] font-dm-mono text-[8px] font-bold uppercase tracking-wider">Confirm?</span>
                        </div>
                        <span className="font-dm-mono text-xs text-[#7e775f]">→</span>
                        <div className="flex items-center gap-2 border-2 border-black bg-white px-2 py-1.5">
                          <div className="w-6 h-6 rounded-full bg-[#ffe16d] border-2 border-black flex items-center justify-center font-dm-sans text-[8px] font-bold">KP</div>
                          <span className="font-dm-sans font-bold text-[10px] uppercase">Kate</span>
                          <span className="px-1.5 py-0.5 border-2 border-black bg-[#b5ead7] font-dm-mono text-[8px] font-bold uppercase tracking-wider">Paid</span>
                        </div>
                      </div>
                      <p className="font-dm-sans font-bold text-sm text-center">
                        After someone pays via GCash, tap <span className="bg-[#FFD700] px-1">Confirm?</span> to mark them as paid.
                      </p>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-4 flex flex-col gap-4">

                  {/* Step 1: Copy GCash */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest text-[#7e775f]">01 — Copy GCash</span>
                    <div className="border-2 border-black p-4 bg-stone-50 flex flex-col items-center gap-3">
                      <div className="flex items-center justify-between w-full border-2 border-black px-3 py-2.5 bg-white">
                        <p className="font-dm-mono font-bold text-base tracking-wider">0917 xxx xxxx</p>
                        <span className="h-8 px-3 border-2 border-black rounded-lg bg-white font-dm-mono text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#000] flex items-center">Copy</span>
                      </div>
                      <p className="font-dm-sans font-bold text-sm text-center">
                        Tap Copy to grab the GCash number.
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Pay */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest text-[#7e775f]">02 — Pay</span>
                    <div className="border-2 border-black p-4 bg-stone-50 flex flex-col items-center gap-3">
                      <div className="flex items-center justify-between w-full border-2 border-black px-3 py-2.5 bg-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#ffe16d] border-2 border-black flex items-center justify-center font-dm-sans text-[9px] font-bold">YU</div>
                          <span className="font-dm-sans font-bold text-sm uppercase">You</span>
                          <span className="inline-flex items-center px-2 py-0.5 border-2 border-black bg-[#0066FF] text-white font-dm-mono text-[9px] font-bold uppercase tracking-widest shadow-[1px_1px_0px_0px_#000]">Pay ↗</span>
                        </div>
                        <span className="font-dm-mono font-bold text-sm">₱350</span>
                      </div>
                      <p className="font-dm-sans font-bold text-sm text-center">
                        Tap "Pay" on your row. GCash opens with the amount ready.
                      </p>
                    </div>
                  </div>

                </div>
              )}
            </div>

            <button
              onClick={dismissHelpModal}
              className="mt-3 w-full bg-[#FFD700] border-4 border-black shadow-[4px_4px_0px_0px_#000] font-dm-sans font-black text-lg uppercase tracking-widest py-2.5 hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
            >
              Got it
            </button>
          </div>
        </div>
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
