'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, Pencil } from 'lucide-react';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import type { ReceiptLine } from '@/lib/schemas/receipt/public/ReceiptLine';
import { api } from '@/lib/client/api-client';
import { LineItemModal } from './LineItemModal';

interface Props {
  summary: ReceiptSummary;
  formatCurrency: (amount: number) => string;
  receiptId: number;
  onSummaryUpdate: () => void;
}

const DISCREPANCY_TOOLTIP = "Discrepancies happen when AI-extracted items don't perfectly sum to the receipt total — often due to VAT structures, rounding, or charges that couldn't be individually parsed.";

export function ReceiptCard({ summary, formatCurrency, receiptId, onSummaryUpdate }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [adjInfoLineId, setAdjInfoLineId] = useState<number | null>(null);
  const [editingLine, setEditingLine] = useState<ReceiptLine | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  function lineHasAssignments(lineId: number): boolean {
    return summary.participantSplits.some(split =>
      split.lineItems.some(item => item.receiptLineId === lineId)
    );
  }

  const handleLineSave = async (data: {
    itemName: string;
    quantity: number;
    unitPrice: number;
    receiptLineType?: string;
  }) => {
    if (!editingLine) {
      return;
    }
    await api.lines.update(receiptId, editingLine.id, data);
    setEditingLine(null);
    onSummaryUpdate();
  };

  const handleLineDelete = async () => {
    if (!editingLine) {
      return;
    }
    await api.lines.delete(receiptId, editingLine.id);
    setEditingLine(null);
    onSummaryUpdate();
  };

  const handleTitleEdit = () => {
    setTitleValue(summary.receipt.title || '');
    setEditingTitle(true);
  };

  const handleTitleSave = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed) {
      return;
    }
    try {
      setSavingTitle(true);
      await api.receipts.updateTitle(receiptId, trimmed);
      setEditingTitle(false);
      onSummaryUpdate();
    } finally {
      setSavingTitle(false);
    }
  };

  const handleTitleCancel = () => {
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  return (
    <>
      <section className="bg-white border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] p-5">
        <div className="flex items-start justify-between mb-4 gap-3">
          {editingTitle ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                autoFocus
                className="flex-1 min-w-0 h-9 border-2 border-black rounded-lg px-3 font-dm-sans font-black text-lg uppercase focus:border-[4px] focus:outline-none focus:bg-[#cee7f0] transition-all disabled:opacity-50"
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                disabled={savingTitle}
              />
              <button
                onClick={handleTitleSave}
                disabled={savingTitle || !titleValue.trim()}
                className="flex-shrink-0 px-2 py-1 border-2 border-black rounded bg-[#FFD700] font-dm-mono text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={handleTitleCancel}
                disabled={savingTitle}
                className="flex-shrink-0 px-2 py-1 border-2 border-black rounded bg-white font-dm-mono text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={handleTitleEdit}
              className="group flex items-center gap-1.5 text-left min-w-0"
            >
              <h2 className="font-dm-sans font-bold text-2xl uppercase truncate">
                {summary.receipt.title || 'Receipt'}
              </h2>
              <Pencil className="w-3.5 h-3.5 text-[#7e7576] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          )}
          <p className="font-dm-mono text-[11px] text-[#7e7576] flex-shrink-0 pt-1">
            {new Date(summary.receipt.receiptTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>

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
                  <div key={line.id} className="flex justify-between items-center font-dm-mono text-[12px] py-1">
                    <span className="flex-1">{line.itemName}{line.quantity !== 1 && ` (×${line.quantity})`}</span>
                    <span className="font-bold ml-4">{formatCurrency(line.totalPrice)}</span>
                    <button
                      onClick={() => setEditingLine(line)}
                      className="p-2 -mr-2 flex-shrink-0 text-[#7e7576] hover:text-black transition-colors"
                      aria-label={`Edit ${line.itemName}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
                  <div key={line.id} className="flex justify-between items-center font-dm-mono text-[12px] py-1 text-[#4d4732]">
                    <span className="flex-1">{line.itemName}{line.quantity !== 1 && ` (×${line.quantity})`}</span>
                    <span className="font-bold ml-4">{formatCurrency(line.totalPrice)}</span>
                    <button
                      onClick={() => setEditingLine(line)}
                      className="p-2 -mr-2 flex-shrink-0 text-[#4d4732] hover:text-black transition-colors"
                      aria-label={`Edit ${line.itemName}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              {summary.receipt.lines
                ?.filter(line => line.receiptLineType === 'DSCT' && line.totalPrice !== 0)
                .map(line => (
                  <div key={line.id} className="flex justify-between items-center font-dm-mono text-[12px] py-1 text-green-700">
                    <span className="flex-1">{line.itemName}{line.quantity !== 1 && ` (×${line.quantity})`}</span>
                    <span className="font-bold ml-4">{formatCurrency(line.totalPrice)}</span>
                    <button
                      onClick={() => setEditingLine(line)}
                      className="p-2 -mr-2 flex-shrink-0 text-green-700 hover:text-green-900 transition-colors"
                      aria-label={`Edit ${line.itemName}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              {summary.receipt.lines
                ?.filter(line => line.receiptLineType === 'DADJ')
                .map(line => (
                  <div key={line.id}>
                    <div className="flex justify-between items-center font-dm-mono text-[12px] py-1 text-red-700">
                      <span className="flex-1 italic flex items-center gap-1">
                        {line.itemName}
                        <button
                          onClick={() => setAdjInfoLineId(adjInfoLineId === line.id ? null : line.id)}
                          className="flex-shrink-0 text-red-700 hover:text-red-900 transition-colors"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </span>
                      <span className="font-bold ml-4">{line.totalPrice >= 0 ? '+' : ''}{formatCurrency(line.totalPrice)}</span>
                    </div>
                    {adjInfoLineId === line.id && (
                      <p className="font-dm-mono text-[10px] text-[#4d4732] bg-[#f3f3f3] border border-[#d0c6ab] rounded px-2.5 py-2 mb-1 leading-relaxed">
                        {DISCREPANCY_TOOLTIP}
                      </p>
                    )}
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

      <LineItemModal
        isOpen={editingLine !== null}
        mode="edit"
        initialData={editingLine ? {
          itemName: editingLine.itemName,
          quantity: Number(editingLine.quantity),
          unitPrice: Number(editingLine.unitPrice),
          receiptLineType: editingLine.receiptLineType,
        } : undefined}
        hasAssignments={editingLine ? lineHasAssignments(editingLine.id) : false}
        onSave={handleLineSave}
        onCancel={() => setEditingLine(null)}
        onDelete={handleLineDelete}
      />
    </>
  );
}
