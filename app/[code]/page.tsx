'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Eye, MoreVertical, X, Lock, Share2, Check, HelpCircle } from 'lucide-react';
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareCodeCopied, setShareCodeCopied] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const isReceiptOwner = !!userId && !!summary?.receipt.ownerId && userId === summary.receipt.ownerId;

  const payerParticipant = summary?.participantSplits.find(
    p => p.participantId === summary.receipt.payerParticipantId
  );
  const isPayer = !!userId && !!payerParticipant?.userId && userId === payerParticipant.userId;

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
    async function fetchSummary() {
      try {
        const data = await api.receipts.getByShareCode(shareCode);
        const { status, id } = data.receipt;

        if (status === 'ULIP' || status === 'PRSP') {
          router.replace(`/receipts/${id}/participants`);
          return;
        }
        if (status === 'DRFT') {
          router.replace(`/receipts/${id}/assign`);
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
  }, [shareCode, router]);

  const handleShareGroupLink = async () => {
    if (!summary) {
      return;
    }
    const url = `${window.location.origin}/${summary.receipt.shareCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: summary.receipt.title || 'Receipt', url });
      } catch {
        // user dismissed
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShareCodeCopied(true);
      setTimeout(() => setShareCodeCopied(false), 2000);
    }
  };

  const handleCopyCollectorLink = () => {
    if (!summary) {
      return;
    }
    const secret = localStorage.getItem(`cs_key_${summary.receipt.id}`);
    if (!secret) {
      return;
    }
    const link = `${window.location.origin}/${summary.receipt.shareCode}/collect?c=${secret}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
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
    <div className="min-h-screen bg-[#fff9ef] pb-[88px]">
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

        <ReceiptCard summary={summary} formatCurrency={formatCurrency} />

        {isReceiptOwner ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShareGroupLink}
              className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 border-2 border-black rounded-lg bg-green-100 shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              {shareCodeCopied
                ? <Check className="w-4 h-4 text-green-800" strokeWidth={2.5} />
                : <Share2 className="w-4 h-4 text-green-800" strokeWidth={2.5} />
              }
              <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest text-green-800">
                {shareCodeCopied ? 'Copied!' : 'Share with group'}
              </span>
              <span className="font-dm-mono font-bold text-sm tracking-widest text-black">
                {summary.receipt.shareCode}
              </span>
            </button>
            <button
              onClick={handleCopyCollectorLink}
              className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 border-2 border-black rounded-lg bg-[#FFD700] shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <Lock className="w-4 h-4" strokeWidth={2.5} />
              <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest">
                {linkCopied ? 'Copied!' : 'Copy payer link'}
              </span>
              <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest text-[#4d4732]">
                Private
              </span>
            </button>
          </div>
        ) : (
          <ShareCodeBadge shareCode={summary.receipt.shareCode} title={summary.receipt.title || 'Receipt'} />
        )}

        <ParticipantSplits
          receiptId={summary.receipt.id}
          participantSplits={summary.participantSplits}
          payerParticipantId={summary.receipt.payerParticipantId ?? null}
          formatCurrency={formatCurrency}
          isCollector={isPayer}
        />
        <div className="mt-4">
          <SaveSplitsNudge />
        </div>

        <div className="h-4" />
      </div>

      {/* Fixed Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-white border-t-4 border-black px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => router.push('/')}
          className="w-full h-14 border-[4px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
        >
          Create New Receipt →
        </button>
      </nav>

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

              <div className="p-4 flex flex-col gap-4">

                {/* Section 1: Two links */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest text-[#7e775f]">01 — Share links</span>
                <div className="border-2 border-black p-4 bg-stone-50 flex flex-col items-center gap-3">
                  <div className="flex gap-2 w-full">
                    <div className="flex-1 flex flex-col items-center gap-1.5 border-2 border-black bg-green-100 py-2 px-1">
                      <Share2 className="w-3.5 h-3.5 text-green-800" strokeWidth={2.5} />
                      <span className="font-dm-mono text-[8px] font-bold uppercase tracking-widest text-green-800 text-center">Share with group</span>
                      <span className="font-dm-mono text-[9px] font-bold text-black">6JM3W</span>
                      <span className="font-dm-mono text-[8px] text-[#4d4732] text-center">→ everyone</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1.5 border-2 border-black bg-[#FFD700] py-2 px-1">
                      <Lock className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span className="font-dm-mono text-[8px] font-bold uppercase tracking-widest text-center">Copy payer link</span>
                      <span className="font-dm-mono text-[8px] font-bold uppercase tracking-widest text-[#4d4732]">Private</span>
                      <span className="font-dm-mono text-[8px] text-[#4d4732] text-center">→ payer only</span>
                    </div>
                  </div>
                  <p className="font-dm-sans font-bold text-sm text-center">
                    Green goes to the group. Yellow goes only to whoever fronted the bill.
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
