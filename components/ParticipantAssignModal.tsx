'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';
import { KebabMenu } from '@/components/KebabMenu';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    if (!isOpen) setMenuOpen(false);
  }, [isOpen]);

  if (!isOpen || !line) return null;

  const assignedCount = Object.values(lineAssignments).filter(v => v > 0).length;
  const anyAssigned = assignedCount > 0;
  const totalCost = line.quantity * line.unitPrice;
  const perPersonCost = assignedCount > 0 ? totalCost / assignedCount : null;
  const hasItemActions = onEdit || onDelete;

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
        {/* Drag handle / dismiss (mobile only) */}
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
          {hasItemActions && (
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-1.5 rounded bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <KebabMenu
                  className="z-20 w-36"
                  items={[
                    ...(onEdit ? [{ label: 'Edit item', icon: <Pencil className="w-3.5 h-3.5 flex-shrink-0" />, onClick: () => { setMenuOpen(false); onEdit(); } }] : []),
                    ...(onDelete ? [{ label: 'Delete item', icon: <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />, onClick: () => { setMenuOpen(false); onDelete(); }, variant: 'destructive' as const }] : []),
                  ]}
                />
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
