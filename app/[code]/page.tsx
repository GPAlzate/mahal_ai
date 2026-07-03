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
import { CheckCircle2, Eye, MoreVertical, Pencil, Trash2, X, Share2, HelpCircle } from 'lucide-react';

import Link from 'next/link';
import { api } from '@/lib/client/api-client';
import LoadingScreen from '@/components/LoadingScreen';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import { ReceiptCard } from '@/components/ReceiptCard';
import { ParticipantSplits } from '@/components/ParticipantSplits';
import { KebabMenu } from '@/components/KebabMenu';
import { ShareCodeBadge } from '@/components/ShareCodeBadge';
import { SaveSplitsNudge } from '@/components/SaveSplitsNudge';
import { ClaimParticipantStrip } from '@/components/ClaimParticipantStrip';
import { getLocalClaim, clearLocalClaim } from '@/lib/client/localClaim';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

export default function ShareCodePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const shareCode = resolvedParams.code.toUpperCase();
  const router = useRouter();
  const { userId } = useAuth();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settledOverride, setSettledOverride] = useState(false);
  const [gcashInput, setGcashInput] = useState('');
  const [gcashSaving, setGcashSaving] = useState(false);
  const [gcashSaved, setGcashSaved] = useState(false);
  const [gcashError, setGcashError] = useState('');
  const [gcashCopied, setGcashCopied] = useState(false);
  const [isEditingGcash, setIsEditingGcash] = useState(true);
  const [localClaimId, setLocalClaimId] = useState<number | null>(null);


  const payerParticipant = summary?.participantSplits.find(
    p => p.participantId === summary.receipt.payerParticipantId
  );
  const isReceiptPayer = !!userId && !!payerParticipant?.userId && userId === payerParticipant.userId;
  const isOwner = !!userId && !!summary?.receipt.ownerId && userId === summary.receipt.ownerId;
  // The payer can set their own GCash number; the owner can also set it on the
  // payer's behalf (e.g. when the payer is anonymous and can't sign in to do so).
  const canEditGcash = isReceiptPayer || isOwner;
  const settled = settledOverride || summary?.receipt.status === 'STLD';
  const isLinkedParticipant = !!userId && !!summary?.participantSplits.some(p => p.userId === userId);
  const unclaimedParticipants = summary?.participantSplits.filter(p => p.userId === null) ?? [];

  // Anonymous claim: only valid while the participant is still unclaimed server-side
  const localClaimedParticipant = summary?.participantSplits.find(
    p => p.participantId === localClaimId && p.userId === null
  );
  const hasLocalClaim = !userId && !!localClaimedParticipant;
  const linkedParticipant = userId
    ? summary?.participantSplits.find(p => p.userId === userId)
    : undefined;
  const myParticipantId = linkedParticipant?.participantId
    ?? (hasLocalClaim ? localClaimedParticipant.participantId : null);

  // Payer excluded: they're auto-marked PAID for fronting the bill, so their
  // status doesn't mean money was sent to them.
  const paidParticipants = summary?.participantSplits.filter(
    p => p.participantId !== summary.receipt.payerParticipantId
      && (p.paymentStatus === 'PAID' || p.paymentStatus === 'PCIP')
  ) ?? [];

  const paidNames = paidParticipants.map(p => p.displayName);
  let paidNamesLabel = '';
  if (paidNames.length === 1) {
    paidNamesLabel = paidNames[0];
  } else if (paidNames.length === 2) {
    paidNamesLabel = `${paidNames[0]} and ${paidNames[1]}`;
  } else if (paidNames.length > 2) {
    paidNamesLabel = `${paidNames[0]}, ${paidNames[1]} + ${paidNames.length - 2} more`;
  }


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
        setLocalClaimId(getLocalClaim(id));
        setGcashInput(data.receipt.gcashNumber ? formatGcashDisplay(data.receipt.gcashNumber) : '');
        setIsEditingGcash(!data.receipt.gcashNumber);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
        setLoading(false);
      }
    }

    fetchReceipt();
  }, [shareCode, router, refreshKey]);

  // Replay a local (anonymous) claim once the user signs in, so the
  // participant gets stamped with their user_id and the receipt shows
  // up in My Receipts.
  useEffect(() => {
    if (!userId || !summary || localClaimId === null) {
      return;
    }

    const receiptId = summary.receipt.id;

    if (isLinkedParticipant) {
      clearLocalClaim(receiptId);
      setLocalClaimId(null);
      return;
    }

    const stillUnclaimed = summary.participantSplits.some(
      p => p.participantId === localClaimId && p.userId === null
    );
    if (!stillUnclaimed) {
      clearLocalClaim(receiptId);
      setLocalClaimId(null);
      return;
    }

    api.participants
      .claim(receiptId, localClaimId)
      .catch(() => {
        // Someone else claimed that spot first — drop the stale local claim
      })
      .finally(() => {
        clearLocalClaim(receiptId);
        setLocalClaimId(null);
        setRefreshKey(k => k + 1);
      });
  }, [userId, summary, localClaimId, isLinkedParticipant]);


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

  const handleEditSplit = () => {
    if (!summary) {
      return;
    }
    if (paidParticipants.length > 0) {
      setShowEditWarning(true);
    } else {
      router.push(`/receipts/${summary.receipt.id}/assign`);
    }
  };

  const handleDelete = async () => {
    if (!summary) {
      return;
    }
    try {
      setDeleting(true);
      await api.receipts.delete(summary.receipt.id);
      router.push('/');
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSettle = async () => {
    if (!summary) {
      return;
    }
    try {
      setSettling(true);
      await api.receipts.settle(summary.receipt.id);
      setSettledOverride(true);
      setShowSettleConfirm(false);
    } catch {
      setSettling(false);
      setShowSettleConfirm(false);
    }
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

        <ShareCodeBadge shareCode={summary.receipt.shareCode} title={summary.receipt.title || 'Receipt'} />

        <ReceiptCard summary={summary} formatCurrency={formatCurrency} />

        {canEditGcash && (
          <div className="border-4 border-black rounded-xl bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden">
            <div className="bg-[#0066FF] px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-white">
                  {isReceiptPayer
                    ? 'GCash number'
                    : payerParticipant
                      ? `${payerParticipant.displayName}${payerParticipant.displayName.endsWith('s') ? "'" : "'s"} GCash`
                      : 'GCash number'}
                </p>
                <p className="font-dm-mono text-[11px] text-blue-200">
                  {isReceiptPayer ? 'So people know how to pay you' : 'Enter the number so people know how to pay'}
                </p>
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

        {!canEditGcash && summary.payerGcashNumber && (
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
          myParticipantId={myParticipantId}
        />
        {!isLinkedParticipant && !hasLocalClaim && unclaimedParticipants.length > 0 && (
          <ClaimParticipantStrip
            receiptId={summary.receipt.id}
            unclaimedParticipants={unclaimedParticipants}
            onClaimed={() => {
              setLocalClaimId(getLocalClaim(summary.receipt.id));
              setRefreshKey(k => k + 1);
            }}
          />
        )}

        <div className="mt-4">
          <SaveSplitsNudge claimedName={hasLocalClaim ? localClaimedParticipant.displayName : undefined} />
        </div>

        <div className="mt-6 border-t-4 border-black pt-5 flex flex-col gap-2">
          {isReceiptPayer && (
            <span className="font-dm-mono text-[9px] font-bold uppercase tracking-widest text-[#7e775f]">Owner actions</span>
          )}
          <button
            onClick={handleEditSplit}
            className="w-full h-12 border-4 border-black flex items-center justify-center gap-2 font-dm-mono font-bold text-sm uppercase bg-white text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
          >
            <Pencil className="w-4 h-4" strokeWidth={2.5} />
            Edit Split
          </button>
          {isReceiptPayer && settled && (
            <div className="w-full h-12 border-4 border-black flex items-center justify-center gap-2 bg-[#8ed4a3]">
              <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
              <span className="font-dm-mono font-bold text-sm uppercase tracking-widest">Receipt Settled</span>
            </div>
          )}
          {isReceiptPayer && !settled && (
            <button
              onClick={() => setShowSettleConfirm(true)}
              className="w-full h-12 border-4 border-black font-dm-mono font-bold text-sm uppercase bg-white text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
            >
              Mark as Settled
            </button>
          )}
        </div>

        <div className="h-8" />
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

      {/* Settle Confirmation Bottom Sheet */}
      {showSettleConfirm && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setShowSettleConfirm(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-[70] bg-white border-x-4 border-t-4 border-black rounded-t-xl max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
            <div className="flex flex-col items-center gap-2 px-5 pt-5 pb-4 border-b-4 border-black">
              <div className="bg-[#8ed4a3] border-2 border-black w-10 h-10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <h2 className="font-dm-sans font-black text-xl uppercase tracking-tight">Mark as Settled?</h2>
              <p className="font-dm-mono text-[11px] text-center text-[#4d4732]">
                This marks the receipt as fully settled. Everyone&apos;s paid up. The receipt stays visible but is closed.
              </p>
            </div>
            <div className="px-5 pt-4 pb-6 flex flex-col gap-2">
              <button
                onClick={handleSettle}
                disabled={settling}
                className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#8ed4a3] shadow-[4px_4px_0px_0px_#000] hover:bg-[#b5ead7] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50"
              >
                {settling ? 'Settling...' : 'Yes, Settle'}
              </button>
              <button
                onClick={() => setShowSettleConfirm(false)}
                disabled={settling}
                className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit-After-Payment Warning Bottom Sheet */}
      {showEditWarning && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setShowEditWarning(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-[70] bg-white border-x-4 border-t-4 border-black rounded-t-xl max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
            <div className="flex flex-col items-center gap-2 px-5 pt-5 pb-4 border-b-4 border-black">
              <div className="bg-[#FFD700] border-2 border-black w-10 h-10 flex items-center justify-center">
                <Pencil className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <h2 className="font-dm-sans font-black text-xl uppercase tracking-tight">Edit the split?</h2>
              <p className="font-dm-mono text-[11px] text-center text-[#4d4732]">
                {paidNamesLabel} already paid. Editing can change what people owe, so you may need to settle any difference yourselves.
              </p>
            </div>
            <div className="px-5 pt-4 pb-6 flex flex-col gap-2">
              <button
                onClick={() => router.push(`/receipts/${summary.receipt.id}/assign`)}
                className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#FFD700] shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
              >
                Edit Anyway
              </button>
              <button
                onClick={() => setShowEditWarning(false)}
                className="w-full h-12 border-4 border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
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
