'use client';

import React from 'react';
import { X, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

interface Participant {
  id: number;
  displayName: string;
}

interface ReceiptLine {
  id: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  receiptLineType: string;
}

interface ParticipantAssignModalProps {
  isOpen: boolean;
  line: ReceiptLine | null;
  participants: Participant[];
  lineAssignments: { [participantId: number]: number };
  onToggle: (participantId: number) => void;
  onClose: () => void;
  participantColors: string[];
  getInitials: (name: string) => string;
}

export function ParticipantAssignModal({
  isOpen,
  line,
  participants,
  lineAssignments,
  onToggle,
  onClose,
  participantColors,
  getInitials,
}: ParticipantAssignModalProps) {
  if (!isOpen || !line) return null;

  const assignedCount = Object.values(lineAssignments).filter(v => v > 0).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-md bg-white border-4 border-b-0 sm:border-b-4 border-black shadow-[0px_-6px_0px_0px_#000] sm:shadow-[6px_6px_0px_0px_#000] rounded-t-2xl sm:rounded-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Bottom-sheet drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-[#d0d0d0] rounded-full" />
        </div>

        {/* Header: item name + price + close */}
        <div className="border-b-4 border-black px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="font-dm-sans font-black text-lg uppercase tracking-tight leading-tight truncate">
              {line.itemName}
            </h2>
            <span className="font-dm-mono text-[11px] font-bold text-[#7e7576]">
              {line.quantity} × {formatCurrency(line.unitPrice)} = {formatCurrency(line.quantity * line.unitPrice)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex-shrink-0 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Participant grid */}
        <div className="p-4 grid grid-cols-3 gap-3">
          {participants.map((p, i) => {
            const isAssigned = !!lineAssignments[p.id];
            const color = participantColors[i % participantColors.length];
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all min-h-[80px] justify-center cursor-pointer ${
                  isAssigned
                    ? 'border-black bg-[#fffbe6] shadow-[2px_2px_0px_0px_#000]'
                    : 'border-[#d0d0d0] bg-white hover:border-black hover:bg-[#f9f9f9]'
                }`}
              >
                <div
                  className="w-11 h-11 rounded-full border-2 border-black flex items-center justify-center font-dm-sans text-sm font-bold"
                  style={{ backgroundColor: color }}
                >
                  {getInitials(p.displayName)}
                </div>
                <span className="font-dm-mono text-[10px] uppercase font-bold text-[#1b1b1b] text-center leading-tight">
                  {p.displayName.split(' ')[0]}
                </span>
                {isAssigned && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#FFD700] border-2 border-black rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-black" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer: assignment count + Done */}
        <div className="border-t-4 border-black px-4 py-3 flex items-center justify-between pb-[calc(12px+env(safe-area-inset-bottom))] sm:pb-3">
          <span className="font-dm-mono text-[11px] font-bold uppercase text-[#7e7576]">
            {assignedCount === 0
              ? 'No one assigned yet'
              : `${assignedCount} of ${participants.length} assigned`}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#FFD700] border-2 border-black font-dm-sans font-bold uppercase text-sm shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
