'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ParticipantSplit } from '@/lib/schemas/receipt/public/ParticipantSplit';
import type { PaymentStatus } from '@/lib/schemas/participant/public/PaymentStatus';
import { api } from '@/lib/client/api-client';

const PARTICIPANT_COLORS = ['#ffd9de', '#cee7f0', '#ffe16d', '#b5ead7', '#e2d1f9', '#fce1a4', '#b8e0ff'];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  if (status === 'PNYP') {
    return null;
  }

  if (status === 'PAID') {
    return (
      <span className="inline-flex items-center h-6 px-2.5 border-2 border-black bg-[#b5ead7] font-dm-mono text-[10px] font-bold uppercase tracking-widest">
        PAID
      </span>
    );
  }

  // PMIP or PCIP — awaiting owner confirmation
  return (
    <span className="inline-flex items-center h-6 px-2.5 border-2 border-black bg-[#FFD700] font-dm-mono text-[10px] font-bold uppercase tracking-widest">
      CONFIRM?
    </span>
  );
}

interface Props {
  receiptId: number;
  participantSplits: ParticipantSplit[];
  payerParticipantId: number | null;
  formatCurrency: (amount: number) => string;
  isReceiptPayer?: boolean;
  showPaymentUI?: boolean;
}

export function ParticipantSplits({ receiptId, participantSplits, payerParticipantId, formatCurrency, isReceiptPayer, showPaymentUI = true }: Props) {
  const payerName = payerParticipantId
    ? (participantSplits.find(p => p.participantId === payerParticipantId)?.displayName ?? null)
    : null;
  const [expandedParticipants, setExpandedParticipants] = useState<Set<number>>(new Set());
  const cardRefs = useRef<Map<number, HTMLElement | null>>(new Map());
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set());
  const [resettingIds, setResettingIds] = useState<Set<number>>(new Set());
  const [localStatuses, setLocalStatuses] = useState<Map<number, PaymentStatus>>(new Map());
  const [toastName, setToastName] = useState<string | null>(null);

  const toggleParticipantExpanded = (participantId: number) => {
    const isCurrentlyExpanded = expandedParticipants.has(participantId);
    setExpandedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
    if (!isCurrentlyExpanded) {
      setTimeout(() => {
        cardRefs.current.get(participantId)?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 0);
    }
  };

  const handleGcashClick = (participantId: number, gcashUrl: string) => {
    // Fire-and-forget: mark as payment confirmation in progress
    api.participants.updatePaymentStatus(receiptId, participantId, 'PCIP').catch(() => {});
    setLocalStatuses(prev => new Map(prev).set(participantId, 'PCIP'));
    window.location.href = gcashUrl;
  };

  const handleResetPayment = async (participantId: number) => {
    setResettingIds(prev => new Set(prev).add(participantId));
    try {
      await api.participants.updatePaymentStatus(receiptId, participantId, 'PNYP');
      setLocalStatuses(prev => new Map(prev).set(participantId, 'PNYP'));
    } catch {
      // silent — user can retry
    } finally {
      setResettingIds(prev => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
    }
  };

  const handleConfirmPaid = async (participantId: number) => {
    setConfirmingIds(prev => new Set(prev).add(participantId));
    try {
      await api.participants.updatePaymentStatus(receiptId, participantId, 'PAID');
      setLocalStatuses(prev => new Map(prev).set(participantId, 'PAID'));
      const name = participantSplits.find(p => p.participantId === participantId)?.displayName ?? null;
      setToastName(name);
      setTimeout(() => setToastName(null), 2500);
    } catch {
      // silent — collector can retry
    } finally {
      setConfirmingIds(prev => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
    }
  };

  return (
    <>
      <h2 className="font-dm-sans font-bold text-2xl uppercase mt-2">
        {!showPaymentUI ? 'Review these' : isReceiptPayer ? 'Payment Status' : 'What do you owe?'}
      </h2>
      <p className="font-dm-sans text-sm text-gray-500">
        {!showPaymentUI
          ? 'Tap a name to see their breakdown.'
          : isReceiptPayer
            ? 'Confirm payments as you receive them.'
            : 'Tap your name to see your share and pay.'}
      </p>

      {participantSplits.map((split, i) => {
        const isExpanded = expandedParticipants.has(split.participantId);
        const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];
        const effectiveStatus: PaymentStatus = localStatuses.get(split.participantId) ?? split.paymentStatus ?? 'PNYP';
        const isConfirming = confirmingIds.has(split.participantId);
        const isResetting = resettingIds.has(split.participantId);
        const isPayerEntry = split.participantId === payerParticipantId;
        const showCollectorUI = isReceiptPayer && !isPayerEntry;
        const needsConfirmation = showCollectorUI && effectiveStatus === 'PCIP';
        const isPaid = effectiveStatus === 'PAID';
        const gcashUrl = `gcash://com.mynt.gcash/app/006300090100?amount=${split.total.toFixed(2)}`;

        return (
          <article key={split.participantId} ref={(el) => { cardRefs.current.set(split.participantId, el); }} className="bg-white border-4 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden">
            <div
              className="flex items-center justify-between p-4 min-h-[60px] cursor-pointer transition-colors"
              style={{ backgroundColor: isExpanded ? color : 'white' }}
              onClick={() => toggleParticipantExpanded(split.participantId)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-dm-sans text-[10px] font-bold shadow-[2px_2px_0px_0px_#000] flex-shrink-0"
                  style={{ backgroundColor: isExpanded ? 'white' : color }}
                >
                  {getInitials(split.displayName)}
                </div>
                <span className="font-dm-sans font-bold text-base uppercase truncate">{split.displayName}</span>
              </div>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                {showPaymentUI && isPayerEntry && (
                  <PaymentBadge status="PAID" />
                )}
                {showPaymentUI && !isPayerEntry && isReceiptPayer && (
                  <PaymentBadge status={effectiveStatus} />
                )}
                {showPaymentUI && !isPayerEntry && !isReceiptPayer && effectiveStatus === 'PNYP' && !isExpanded && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGcashClick(split.participantId, gcashUrl); }}
                    className="inline-flex items-center h-8 px-3 border-[3px] border-black rounded-lg bg-[#0066FF] text-white font-dm-mono text-[10px] font-bold uppercase tracking-widest shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Pay ↗
                  </button>
                )}
                {showPaymentUI && !isPayerEntry && !isReceiptPayer && effectiveStatus === 'PAID' && (
                  <PaymentBadge status={effectiveStatus} />
                )}
                <span className="font-dm-mono font-bold text-lg tabular-nums">{formatCurrency(split.total)}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t-4 border-black p-4 bg-[#fafafa]">
                <div className="space-y-0.5 mb-3">
                  {split.lineItems.map((item) => {
                    const isDiscount = item.shareAmount < 0;
                    const showFraction = item.totalShares > 1;
                    const fractionLabel = item.shareQuantity === 1
                      ? `1/${item.totalShares}`
                      : `${item.shareQuantity}/${item.totalShares}`;
                    return (
                      <div
                        key={item.receiptLineId}
                        className={`flex justify-between font-dm-mono text-[12px] py-1 ${isDiscount ? 'text-green-700' : ''}`}
                      >
                        <span>{item.itemName}{showFraction ? ` (${fractionLabel})` : ''}</span>
                        <span>{formatCurrency(item.shareAmount)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between font-dm-mono text-[12px] border-t-2 border-black pt-2 mt-1">
                    <span className="font-bold">Subtotal:</span>
                    <span className="font-bold">{formatCurrency(split.subtotal)}</span>
                  </div>
                </div>

                <div className="space-y-0.5 mb-3">
                  {split.taxShare !== 0 && (
                    <div className="flex justify-between font-dm-mono text-[12px] text-[#4d4732]">
                      <span>Tax:</span>
                      <span>{formatCurrency(split.taxShare)}</span>
                    </div>
                  )}
                  {split.tipShare !== 0 && (
                    <div className="flex justify-between font-dm-mono text-[12px] text-[#4d4732]">
                      <span>Tip:</span>
                      <span>{formatCurrency(split.tipShare)}</span>
                    </div>
                  )}
                  {split.serviceChargeShare !== 0 && (
                    <div className="flex justify-between font-dm-mono text-[12px] text-[#4d4732]">
                      <span>Service Charge:</span>
                      <span>{formatCurrency(split.serviceChargeShare)}</span>
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
                            <span>Discount:</span>
                            <span>{formatCurrency(assignedDiscountAmount)}</span>
                          </div>
                        )}
                        {proportionalDiscountAmount !== 0 && (
                          <div className="flex justify-between font-dm-mono text-[12px] text-green-700">
                            <span>Discount:</span>
                            <span>{formatCurrency(proportionalDiscountAmount)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {split.adjustmentShare !== 0 && (
                    <div className={`flex justify-between font-dm-mono text-[12px] ${split.adjustmentShare < 0 ? 'text-green-700' : 'text-[#4d4732]'}`}>
                      <span>Discrepancy Adjustment:</span>
                      <span>{split.adjustmentShare >= 0 ? '+' : ''}{formatCurrency(split.adjustmentShare)}</span>
                    </div>
                  )}
                </div>

                <div className={`flex justify-between font-dm-mono border-t-4 border-black pt-3 ${showPaymentUI ? 'mb-3' : ''}`}>
                  <span className="font-bold text-sm uppercase">Total:</span>
                  <span className="font-bold text-sm">{formatCurrency(split.total)}</span>
                </div>

                {showPaymentUI && (isPayerEntry ? (
                  <div className="flex items-center justify-center w-full h-11 border-[3px] border-black rounded-lg bg-[#b5ead7] font-dm-mono font-bold text-sm uppercase shadow-[3px_3px_0px_0px_#000]">
                    Payment confirmed
                  </div>
                ) : showCollectorUI ? (
                  <>
                    {needsConfirmation && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleConfirmPaid(split.participantId)}
                          disabled={isConfirming || isResetting}
                          className="w-full h-11 border-[3px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#FFD700] text-black shadow-[3px_3px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isConfirming ? 'Confirming...' : `Mark ${split.displayName} as Paid`}
                        </button>
                        <button
                          onClick={() => handleResetPayment(split.participantId)}
                          disabled={isConfirming || isResetting}
                          className="w-full h-10 border-2 border-black rounded-lg font-dm-mono text-[11px] font-medium text-[#4d4732] bg-white hover:bg-[#fff9ef] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isResetting ? 'Undoing...' : 'Not received yet'}
                        </button>
                      </div>
                    )}
                    {isPaid && (
                      <div className="flex items-center justify-center w-full h-11 border-[3px] border-black rounded-lg bg-[#b5ead7] font-dm-mono font-bold text-sm uppercase shadow-[3px_3px_0px_0px_#000]">
                        Payment confirmed
                      </div>
                    )}
                    {effectiveStatus === 'PNYP' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-center w-full h-11 border-[3px] border-dashed border-[#c0b9a8] rounded-lg font-dm-mono text-[11px] uppercase tracking-widest text-[#7e7576]">
                          Awaiting payment
                        </div>
                        <button
                          onClick={() => handleConfirmPaid(split.participantId)}
                          disabled={isConfirming}
                          className="w-full h-11 font-dm-sans text-xs font-medium text-[#4d4732] hover:text-black hover:underline disabled:opacity-50 transition-colors"
                        >
                          {isConfirming ? 'Confirming...' : 'Mark as paid manually'}
                        </button>
                      </div>
                    )}
                  </>
                ) : isPaid ? (
                  <div className="flex items-center justify-center w-full h-11 border-[3px] border-black rounded-lg bg-[#b5ead7] font-dm-mono font-bold text-sm uppercase shadow-[3px_3px_0px_0px_#000]">
                    Payment confirmed
                  </div>
                ) : effectiveStatus === 'PCIP' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-center w-full h-11 border-[3px] border-dashed border-[#c0b9a8] rounded-lg font-dm-mono text-[11px] uppercase tracking-widest text-[#7e7576]">
                      Awaiting confirmation
                    </div>
                    <button
                      onClick={() => handleResetPayment(split.participantId)}
                      disabled={isResetting}
                      className="w-full font-dm-mono text-xs text-[#4d4732] hover:text-black hover:underline transition-colors disabled:opacity-50"
                    >
                      {isResetting ? 'Undoing...' : "I didn't pay yet"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGcashClick(split.participantId, gcashUrl)}
                    className="flex items-center justify-center gap-2 w-full h-11 border-[3px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#0066FF] text-white shadow-[3px_3px_0px_0px_#000] hover:bg-[#0052cc] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    {payerName ? `Pay ${payerName} via GCash` : 'Pay via GCash'}
                  </button>
                ))}
              </div>
            )}
          </article>
        );
      })}

      {toastName && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-black text-white font-dm-mono text-xs font-bold uppercase tracking-widest rounded-lg shadow-[3px_3px_0px_0px_#FFD700] whitespace-nowrap">
          {toastName} marked as paid
        </div>
      )}
    </>
  );
}
