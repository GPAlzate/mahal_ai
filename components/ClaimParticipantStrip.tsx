'use client';

import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/client/api-client';
import type { ParticipantSplit } from '@/lib/schemas/receipt/public/ParticipantSplit';

const PARTICIPANT_COLORS = ['#ffc8d0', '#ffb5a7', '#b8e8c0', '#a8e4df', '#b8e0ff', '#d0c4f8', '#f0bce8'];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  receiptId: number;
  unclaimedParticipants: ParticipantSplit[];
  onClaimed: () => void;
}

export function ClaimParticipantStrip({ receiptId, unclaimedParticipants, onClaimed }: Props) {
  const storageKey = `mahal_claim_seen_${receiptId}`;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      setOpen(true);
    }
  }, [storageKey]);

  if (claimed || unclaimedParticipants.length === 0) {
    return null;
  }

  const selectedParticipant = unclaimedParticipants.find(p => p.participantId === selected);

  const handleClose = () => {
    if (claiming) {
      return;
    }
    localStorage.setItem(storageKey, '1');
    setOpen(false);
    setSelected(null);
    setError(null);
  };

  const handleOpen = () => {
    setSelected(null);
    setError(null);
    setOpen(true);
  };

  const handleClaim = async () => {
    if (!selected || claiming) {
      return;
    }
    setClaiming(true);
    setError(null);
    try {
      await api.participants.claim(receiptId, selected);
      localStorage.setItem(storageKey, '1');
      setOpen(false);
      setClaimed(true);
      onClaimed();
    } catch {
      setError("Couldn't claim that spot. Try again.");
      setClaiming(false);
    }
  };

  return (
    <>
      {/* Trigger strip — shown after modal is dismissed */}
      {!open && (
        <div className="bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] px-4 py-3 flex items-center justify-between gap-3">
          <p className="font-dm-mono text-[11px] font-bold text-[#4d4732] uppercase tracking-widest">
            On this receipt?
          </p>
          <button
            onClick={handleOpen}
            className="h-9 px-4 border-2 border-black rounded-lg font-dm-mono font-bold text-[11px] uppercase tracking-widest bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#fff9ef] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Find your name
          </button>
        </div>
      )}

      {/* Centered modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Card */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] overflow-hidden rounded-xl">

              {/* Yellow header */}
              <div className="bg-[#FFD700] border-b-4 border-black px-4 py-2 flex items-center justify-between">
                <h2 className="font-dm-sans font-black text-xl uppercase tracking-tight">
                  Which one is you?
                </h2>
                <button
                  onClick={handleClose}
                  disabled={claiming}
                  className="p-1 border-2 border-black bg-white rounded-lg shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Avatar grid */}
              <div className="p-4 grid grid-cols-3 gap-y-6 gap-x-4">
                {unclaimedParticipants.map((p, i) => {
                  const isSelected = selected === p.participantId;
                  const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];
                  return (
                    <button
                      key={p.participantId}
                      onClick={() => setSelected(isSelected ? null : p.participantId)}
                      disabled={claiming}
                      className="relative flex flex-col items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <div
                        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center relative transition-all ${
                          isSelected
                            ? 'bg-[#fffbe6] border-black shadow-[2px_2px_0px_0px_#000]'
                            : 'bg-white border-[#d0d0d0]'
                        }`}
                      >
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center font-dm-sans text-sm font-bold"
                          style={{ backgroundColor: color, opacity: isSelected ? 1 : 0.7 }}
                        >
                          {getInitials(p.displayName)}
                        </div>
                        {isSelected && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FFD700] border-2 border-black flex items-center justify-center z-10">
                            <Check className="w-3 h-3 text-black" />
                          </div>
                        )}
                      </div>
                      <span
                        className={`font-dm-mono text-[10px] uppercase font-bold text-center leading-tight ${
                          isSelected ? 'text-[#1b1b1b]' : 'text-[#7e7576]'
                        }`}
                      >
                        {p.displayName.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Error */}
              {error && (
                <p className="px-4 pb-3 font-dm-mono text-[11px] font-bold uppercase tracking-wider text-red-600">
                  {error}
                </p>
              )}
            </div>

            {/* CTA outside card — tutorial pattern */}
            <button
              onClick={handleClaim}
              disabled={!selectedParticipant || claiming}
              className="mt-3 w-full bg-[#FFD700] border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] font-dm-sans font-black text-lg uppercase tracking-widest py-2.5 hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:bg-[#f3f3f3] disabled:text-[#7e7576] disabled:border-[#c0bbb8] disabled:shadow-none disabled:cursor-not-allowed"
            >
              {claiming
                ? 'Claiming...'
                : selectedParticipant
                  ? `This is me: ${selectedParticipant.displayName.split(' ')[0]}`
                  : 'Pick your name above'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
