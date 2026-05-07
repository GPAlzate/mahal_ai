'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ParticipantSplit } from '@/lib/schemas/receipt/public/ParticipantSplit';

const PARTICIPANT_COLORS = ['#ffd9de', '#cee7f0', '#ffe16d', '#b5ead7', '#e2d1f9', '#fce1a4', '#b8e0ff'];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  participantSplits: ParticipantSplit[];
  formatCurrency: (amount: number) => string;
}

export function ParticipantSplits({ participantSplits, formatCurrency }: Props) {
  const [expandedParticipants, setExpandedParticipants] = useState<Set<number>>(new Set());

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

  return (
    <>
      <h2 className="font-dm-sans font-bold text-2xl uppercase mt-2">Participant Shares</h2>

      {participantSplits.map((split, i) => {
        const isExpanded = expandedParticipants.has(split.participantId);
        const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];

        return (
          <article key={split.participantId} className="bg-white border-4 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] overflow-hidden">
            <div
              className="flex items-center justify-between p-4 cursor-pointer transition-colors"
              style={{ backgroundColor: isExpanded ? color : 'white' }}
              onClick={() => toggleParticipantExpanded(split.participantId)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-dm-sans text-[10px] font-bold shadow-[2px_2px_0px_0px_#000] flex-shrink-0"
                  style={{ backgroundColor: isExpanded ? 'white' : color }}
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

                <div className="flex justify-between font-dm-mono border-t-4 border-black pt-3">
                  <span className="font-bold text-sm uppercase">Total:</span>
                  <span className="font-bold text-sm">{formatCurrency(split.total)}</span>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </>
  );
}
