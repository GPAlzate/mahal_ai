'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';

interface Props {
  summary: ReceiptSummary;
  formatCurrency: (amount: number) => string;
}

export function ReceiptCard({ summary, formatCurrency }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="bg-white border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] p-5">
      <h2 className="font-dm-sans font-bold text-2xl uppercase mb-4">Receipt</h2>

      <div className="flex justify-between items-end pb-3 border-b-2 border-black">
        <span className="font-dm-sans font-bold text-2xl uppercase">Total:</span>
        <span className="font-dm-mono font-bold text-2xl">{formatCurrency(summary.total)}</span>
      </div>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center gap-1 py-2 font-dm-mono text-xs text-[#4d4732] hover:text-black transition-colors"
      >
        {isExpanded ? 'Hide Details' : 'Show Details'}
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {isExpanded && (
        <div className="pt-4 border-t-4 border-black">
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

          <div className="flex justify-between font-dm-mono text-[12px] py-2 border-t-2 border-black">
            <span className="font-bold">Subtotal:</span>
            <span className="font-bold">{formatCurrency(summary.subtotal)}</span>
          </div>

          <div className="space-y-0.5 mt-1">
            {summary.receipt.lines
              ?.filter(line => line.receiptLineType !== 'PRCH' && line.receiptLineType !== 'DSCT' && line.receiptLineType !== 'DADJ' && line.totalPrice !== 0)
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
            {summary.receipt.lines
              ?.filter(line => line.receiptLineType === 'DADJ')
              .map(line => (
                <div key={line.id} className="flex justify-between font-dm-mono text-[12px] py-1 text-[#4d4732]">
                  <span className="flex-1 italic">{line.itemName}</span>
                  <span className="font-bold ml-4">{line.totalPrice >= 0 ? '+' : ''}{formatCurrency(line.totalPrice)}</span>
                </div>
              ))}
          </div>

          <div className="flex justify-between font-dm-mono py-3 border-t-4 border-black mt-2">
            <span className="font-bold text-sm uppercase">Total:</span>
            <span className="font-bold text-sm">{formatCurrency(summary.total)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
