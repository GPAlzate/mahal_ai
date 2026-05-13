'use client';

import React from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
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
  onAssignAll: () => void;
  onClear: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;

  participantColors: string[];
  getInitials: (name: string) => string;
}

export function ParticipantAssignModal({
  isOpen,
  line,
  participants,
  lineAssignments,
  onToggle,
  onAssignAll,
  onClear,
  onClose,
  onEdit,
  onDelete,
  participantColors,
  getInitials,
}: ParticipantAssignModalProps) {
  if (!isOpen || !line) return null;

  const assignedCount = Object.values(lineAssignments).filter(v => v > 0).length;
  const anyAssigned = assignedCount > 0;
  const totalCost = line.quantity * line.unitPrice;
  const perPersonCost = assignedCount > 0 ? totalCost / assignedCount : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-md bg-white border-4 border-b-0 sm:border-b-4 border-black shadow-[0px_-6px_0px_0px_#000] sm:shadow-[6px_6px_0px_0px_#000] rounded-t-[24px] sm:rounded-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <button onClick={onClose} className="p-0 leading-none" aria-label="Close">
            <div className="w-10 h-1 bg-[#d0d0d0] rounded-full" />
          </button>
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b-4 border-black flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="font-dm-sans font-black text-xl uppercase tracking-tight leading-tight truncate">
              {line.itemName}
            </h2>
            <span className="font-dm-mono text-[11px] font-bold text-[#7e7576]">
              {line.quantity} × {formatCurrency(line.unitPrice)} = {formatCurrency(line.quantity * line.unitPrice)}
            </span>
            {perPersonCost !== null && (
              <span className="font-dm-mono text-[13px] font-bold text-[#1b1b1b]">
                ~{formatCurrency(perPersonCost)} each
              </span>
            )}
          </div>
          {(onEdit || onDelete) && (
            <div className="flex gap-2 flex-shrink-0">
              {onEdit && (
                <button
                  onClick={onEdit}
                  aria-label="Edit item"
                  className="w-10 h-10 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  aria-label="Delete item"
                  className="w-10 h-10 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4 text-[#93000a]" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Section label */}
        <div className="px-4 pt-3 pb-0">
          <span className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-[#7e7576]">
            Split with:
          </span>
        </div>

        {/* Participant grid */}
        <div className="p-4 grid grid-cols-3 gap-y-6 gap-x-4">
          {participants.map((p, i) => {
            const isAssigned = !!lineAssignments[p.id];
            const color = participantColors[i % participantColors.length];
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                className="relative flex flex-col items-center gap-2 cursor-pointer"
              >
                <div
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center relative transition-all ${
                    isAssigned
                      ? 'bg-[#fffbe6] border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none'
                      : 'bg-white border-[#d0d0d0] active:scale-95'
                  }`}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-dm-sans text-sm font-bold"
                    style={{ backgroundColor: color, opacity: isAssigned ? 1 : 0.7 }}
                  >
                    {getInitials(p.displayName)}
                  </div>
                  {isAssigned && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FFD700] border-2 border-black flex items-center justify-center z-10">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                </div>
                <span
                  className={`font-dm-mono text-[10px] uppercase font-bold text-center leading-tight ${
                    isAssigned ? 'text-[#1b1b1b]' : 'text-[#7e7576]'
                  }`}
                >
                  {p.displayName.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t-4 border-black px-4 py-3 flex items-center justify-between gap-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:pb-3">
          <button
            onClick={anyAssigned ? onClear : onAssignAll}
            className="px-4 py-3 rounded border-2 border-black bg-white font-dm-mono font-bold text-[10px] uppercase tracking-wide shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            {anyAssigned ? 'Unselect All' : 'Assign All'}
          </button>
          <button
            onClick={onClose}
            className="px-8 py-3 rounded bg-[#FFD700] border-2 border-black font-dm-sans font-bold uppercase text-sm shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
