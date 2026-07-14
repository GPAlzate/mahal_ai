'use client';

import React, { useState, useEffect } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

interface Participant {
  id: number;
  displayName: string;
}

type SplitModeId = 'equal' | 'pieces' | 'shares';

// The split options offered in the picker, in display order.
// To remove an option from the app, comment out its line here — the code for it
// stays intact below. 'pieces' is additionally gated to whole-number quantities
// ≥ 2 at runtime (see canSplitByPiece), since the piece UI needs discrete units.
const ENABLED_SPLIT_MODES: SplitModeId[] = [
  'equal',
  'pieces',
  'shares',
];

const SPLIT_MODE_LABELS: Record<SplitModeId, string> = {
  equal: 'equal',
  pieces: 'by piece',
  shares: 'shares',
};

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
  onSetShares: (participantId: number, shares: number) => void;
  onAssignAll: () => void;
  onClear: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  participantColors: string[];
  getInitials: (name: string) => string;
  equalSplitOnly?: boolean;
}

export function ParticipantAssignModal({
  isOpen,
  line,
  participants,
  lineAssignments,
  onToggle,
  onSetShares,
  onAssignAll,
  onClear,
  onClose,
  onEdit,
  onDelete,
  participantColors,
  getInitials,
  equalSplitOnly = false,
}: ParticipantAssignModalProps) {
  const [splitMode, setSplitMode] = useState<'equal' | 'shares' | 'pieces'>('equal');
  // Per-unit layout for "By piece" mode: one Set of participant ids per unit of
  // the line's quantity. Local-only — it's converted to share weights on edit
  // and never persisted as pieces.
  const [pieces, setPieces] = useState<Set<number>[]>([]);
  const [piecesDirty, setPiecesDirty] = useState(false);

  // "By piece" only makes sense for a whole-numbered quantity of 2 or more.
  const canSplitByPiece =
    !!line && !equalSplitOnly && Number.isInteger(line.quantity) && line.quantity >= 2;

  const enabledModes = ENABLED_SPLIT_MODES.filter(mode =>
    mode === 'pieces' ? canSplitByPiece : true
  );

  useEffect(() => {
    if (line) {
      const values = Object.values(lineAssignments);
      // Never default to 'pieces' — only equal/shares are auto-selected.
      setSplitMode(values.some(v => v > 1) ? 'shares' : 'equal');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.id]);

  // Seed the piece layout when the user opts into "By piece". Starts every piece
  // with whoever is currently assigned, so an equal split reads as "everyone on
  // every piece" and the user just removes people from the pieces they skipped.
  // Nothing is written until a piece is actually edited (see togglePiece).
  useEffect(() => {
    if (splitMode !== 'pieces' || !line) {
      return;
    }
    const assigned = participants
      .filter(p => (lineAssignments[p.id] || 0) > 0)
      .map(p => p.id);
    setPieces(Array.from({ length: line.quantity }, () => new Set(assigned)));
    setPiecesDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitMode, line?.id]);

  if (!isOpen || !line) return null;

  // A participant's weight is the sum, over every piece they're on, of 1/(people
  // on that piece). Whole piece alone => 1; shared four ways => 0.25. Absolute
  // scale is irrelevant since the summary splits proportionally.
  const computePieceWeights = (layout: Set<number>[]): Record<number, number> => {
    const weights: Record<number, number> = {};
    participants.forEach(p => { weights[p.id] = 0; });
    layout.forEach(piece => {
      if (piece.size === 0) {
        return;
      }
      const portion = 1 / piece.size;
      piece.forEach(pid => { weights[pid] += portion; });
    });
    return weights;
  };

  const applyPieces = (layout: Set<number>[]) => {
    const weights = computePieceWeights(layout);
    participants.forEach(p => onSetShares(p.id, weights[p.id] || 0));
  };

  const togglePiece = (pieceIndex: number, participantId: number) => {
    const next = pieces.map((piece, i) => (i === pieceIndex ? new Set(piece) : piece));
    if (next[pieceIndex].has(participantId)) {
      next[pieceIndex].delete(participantId);
    } else {
      next[pieceIndex].add(participantId);
    }
    setPieces(next);
    setPiecesDirty(true);
    applyPieces(next);
  };

  const togglePieceAll = (pieceIndex: number) => {
    const everyone = pieces[pieceIndex].size === participants.length;
    const next = pieces.map((piece, i) => (i === pieceIndex ? new Set(piece) : piece));
    next[pieceIndex] = everyone ? new Set() : new Set(participants.map(p => p.id));
    setPieces(next);
    setPiecesDirty(true);
    applyPieces(next);
  };

  const resetPieces = () => {
    const next = pieces.map(() => new Set<number>());
    setPieces(next);
    setPiecesDirty(true);
    applyPieces(next);
  };

  // Always surface the active mode, even if it isn't offered for this line —
  // otherwise a multi-quantity line with pre-existing unequal shares would
  // auto-select a mode missing from the picker and risk being silently
  // flattened.
  const splitModes = enabledModes.includes(splitMode)
    ? enabledModes
    : [...enabledModes, splitMode];

  const handleDone = () => {
    if (splitMode === 'equal') {
      participants.forEach(p => {
        const current = lineAssignments[p.id] || 0;
        if (current > 1) {
          onSetShares(p.id, 1);
        }
      });
    }
    onClose();
  };

  const totalCost = line.quantity * line.unitPrice;

  const assignedCount = Object.values(lineAssignments).filter(v => v > 0).length;
  const anyAssigned = assignedCount > 0;
  const perPersonCost = assignedCount > 0 ? totalCost / assignedCount : null;

  const totalShares = Object.values(lineAssignments).reduce((sum, v) => sum + v, 0);
  const perShareCost = totalShares > 0 ? totalCost / totalShares : null;

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
              {line.quantity} × {formatCurrency(line.unitPrice)} = {formatCurrency(totalCost)}
            </span>
            {splitMode === 'equal' && perPersonCost !== null && (
              <span className="font-dm-mono text-[13px] font-bold text-[#1b1b1b]">
                ~{formatCurrency(perPersonCost)} each
              </span>
            )}
            {splitMode === 'shares' && perShareCost !== null && (
              <span className="font-dm-mono text-[13px] font-bold text-[#1b1b1b]">
                {formatCurrency(perShareCost)} / share · {totalShares} total
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

        {/* Split mode pill selector */}
        {!equalSplitOnly && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex rounded-full border-2 border-black bg-white p-[3px] gap-[3px]">
              {splitModes.map(mode => (
                <button
                  key={mode}
                  onClick={() => setSplitMode(mode)}
                  className={`flex-1 py-1.5 rounded-full font-dm-mono text-[10px] font-bold uppercase tracking-wide transition-all ${
                    splitMode === mode
                      ? 'bg-[#FFD700] border-2 border-black shadow-[1px_1px_0px_0px_#000] text-[#1b1b1b]'
                      : 'text-[#7e7576]'
                  }`}
                >
                  {SPLIT_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Equal mode: chip grid */}
        {splitMode === 'equal' && (
          <>
            <div className="px-4 pt-1 pb-0">
              <span className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-[#7e7576]">
                Split with:
              </span>
            </div>
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
          </>
        )}

        {/* Shares mode: stepper list */}
        {splitMode === 'shares' && (
          <div className="flex flex-col divide-y-2 divide-[#d0d0d0]">
            {participants.map((p, i) => {
              const shares = lineAssignments[p.id] || 0;
              const color = participantColors[i % participantColors.length];
              const amount = perShareCost !== null && shares > 0 ? shares * perShareCost : null;
              return (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-dm-sans text-sm font-bold flex-shrink-0 transition-all ${
                      shares > 0 ? 'border-black' : 'border-[#d0d0d0]'
                    }`}
                    style={{ backgroundColor: color, opacity: shares > 0 ? 1 : 0.6 }}
                  >
                    {getInitials(p.displayName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-dm-mono text-[11px] uppercase font-bold ${shares > 0 ? 'text-[#1b1b1b]' : 'text-[#7e7576]'}`}>
                      {p.displayName.split(' ')[0]}
                    </div>
                    {amount !== null && (
                      <div className="font-dm-mono text-[10px] text-[#7e7576]">
                        = {formatCurrency(amount)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onSetShares(p.id, Math.max(0, shares - 1))}
                      disabled={shares === 0}
                      className="w-8 h-8 rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:active:shadow-[2px_2px_0px_0px_#000] disabled:active:translate-x-0 disabled:active:translate-y-0 transition-all flex items-center justify-center font-dm-sans font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-dm-mono text-base font-bold">
                      {shares}
                    </span>
                    <button
                      onClick={() => onSetShares(p.id, shares + 1)}
                      className="w-8 h-8 rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center font-dm-sans font-bold text-base"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* By piece mode: one row per unit, tap who shared each */}
        {splitMode === 'pieces' && (
          <div className="px-4 pt-1 pb-2 flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
            {pieces.map((piece, pieceIndex) => {
              const size = piece.size;
              const everyone = size === participants.length;
              let breakdown: string;
              if (size === 0) {
                breakdown = 'Tap who shared this';
              } else if (size === 1) {
                const onlyId = [...piece][0];
                const only = participants.find(p => p.id === onlyId);
                breakdown = `${formatCurrency(line.unitPrice)} · ${only ? only.displayName.split(' ')[0] : '1 person'}`;
              } else {
                breakdown = `${formatCurrency(line.unitPrice / size)} each · split ${size} ways`;
              }
              return (
                <div key={pieceIndex} className="border-2 border-black rounded-lg bg-white">
                  <div className="flex items-center justify-between px-3 py-2 border-b-2 border-[#d0d0d0]">
                    <span className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-[#4d4732]">
                      Piece {pieceIndex + 1} / {line.quantity}
                    </span>
                    <button
                      onClick={() => togglePieceAll(pieceIndex)}
                      className={`px-2 py-1 rounded font-dm-mono text-[9px] font-bold uppercase tracking-wide border-2 border-black transition-all ${
                        everyone
                          ? 'bg-[#FFD700] shadow-[1px_1px_0px_0px_#000]'
                          : 'bg-white text-[#7e7576]'
                      }`}
                    >
                      All
                    </button>
                  </div>
                  <div className="px-3 py-3 flex flex-wrap gap-3">
                    {participants.map((p, i) => {
                      const isOn = piece.has(p.id);
                      const color = participantColors[i % participantColors.length];
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePiece(pieceIndex, p.id)}
                          className="flex flex-col items-center gap-1 cursor-pointer"
                        >
                          <div
                            className={`w-11 h-11 rounded-full border-2 flex items-center justify-center relative transition-all ${
                              isOn
                                ? 'border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none'
                                : 'border-[#d0d0d0] active:scale-95'
                            }`}
                            style={{ backgroundColor: color, opacity: isOn ? 1 : 0.5 }}
                          >
                            <span className="font-dm-sans text-xs font-bold">
                              {getInitials(p.displayName)}
                            </span>
                            {isOn && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FFD700] border-2 border-black flex items-center justify-center z-10">
                                <Check className="w-2.5 h-2.5 text-black" />
                              </div>
                            )}
                          </div>
                          <span
                            className={`font-dm-mono text-[9px] uppercase font-bold leading-tight ${
                              isOn ? 'text-[#1b1b1b]' : 'text-[#7e7576]'
                            }`}
                          >
                            {p.displayName.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-3 pb-2 -mt-1">
                    <span className="font-dm-mono text-[10px] text-[#7e7576]">
                      {breakdown}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="border-t-4 border-black px-4 py-3 flex items-center justify-between gap-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:pb-3">
          {splitMode === 'equal' ? (
            <button
              onClick={anyAssigned ? onClear : onAssignAll}
              className="px-4 py-3 rounded border-2 border-black bg-white font-dm-mono font-bold text-[10px] uppercase tracking-wide shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              {anyAssigned ? 'Unselect All' : 'Assign All'}
            </button>
          ) : (
            <button
              onClick={splitMode === 'pieces' ? resetPieces : onClear}
              className="px-4 py-3 rounded border-2 border-black bg-white font-dm-mono font-bold text-[10px] uppercase tracking-wide shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleDone}
            className="px-8 py-3 rounded bg-[#FFD700] border-2 border-black font-dm-sans font-bold uppercase text-sm shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
