'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { api } from '@/lib/client/api-client';
import { ShareCodeBadge } from '@/components/ShareCodeBadge';
import type { ReceiptStatus } from '@/lib/schemas/receipt/public/Receipt';

interface LocalParticipant {
  tempId: string;
  participantId?: number;
  displayName: string;
}

export default function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const receiptId = parseInt(resolvedParams.id);
  const router = useRouter();
  const { user } = useUser();

  const [participantName, setParticipantName] = useState('');
  const [participants, setParticipants] = useState<LocalParticipant[]>([]);
  const [linesReady, setLinesReady] = useState(false);
  const [checkingLines, setCheckingLines] = useState(true);
  const [parseStatus, setParseStatus] = useState<ReceiptStatus>('ULIP');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptTitle, setReceiptTitle] = useState('');
  const [shareCode, setShareCode] = useState<string | null>(null);

  // Pre-populate participants if navigating back to this page
  useEffect(() => {
    api.participants.list(receiptId).then((existing) => {
      if (existing.length > 0) {
        setParticipants(
          existing.map((p) => ({
            tempId: `saved-${p.id}`,
            participantId: p.id,
            displayName: p.displayName,
          }))
        );
      } else if (user) {
        // Auto-add signed-in user as the first participant
        const name = user.fullName ?? user.firstName ?? '';
        if (name) {
          setParticipants([{ tempId: `creator-${user.id}`, displayName: name }]);
        }
      }
    }).catch(() => {});
  }, [receiptId, user]);

  // Poll until parsing completes. Parse is triggered on the home page as soon as
  // the blob upload finishes, so by the time the user is done entering names it
  // will usually already be DRFT.
  useEffect(() => {
    let cancelled = false;

    const checkReceiptStatus = async () => {
      try {
        const receipt = await api.receipts.get(receiptId);
        if (cancelled) return;

        setShareCode(receipt.shareCode);
        setParseStatus(receipt.status);

        if (receipt.status === 'FLZD') {
          setCheckingLines(false);
          router.push(`/${receipt.shareCode}`);
        } else if (receipt.status === 'DRFT') {
          setLinesReady(true);
          setCheckingLines(false);
        } else if (receipt.status === 'DLTD') {
          setError('Failed to parse receipt. Please try uploading again.');
          setCheckingLines(false);
        } else {
          setTimeout(checkReceiptStatus, 1000);
        }
      } catch (err) {
        if (!cancelled) setTimeout(checkReceiptStatus, 1000);
      }
    };

    checkReceiptStatus();
    return () => { cancelled = true; };
  }, [receiptId, router]);

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantName.trim()) return;
    setParticipants((prev) => [...prev, { tempId: `temp-${Date.now()}`, displayName: participantName.trim() }]);
    setParticipantName('');
  };

  const handleRemoveParticipant = async (tempId: string) => {
    const participant = participants.find((p) => p.tempId === tempId);
    if (!participant) return;
    setParticipants((prev) => prev.filter((p) => p.tempId !== tempId));
    if (participant.participantId) {
      await api.participants.delete(receiptId, participant.participantId).catch(() => {});
    }
  };

  const handleContinue = async () => {
    if (participants.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const newParticipants = participants.filter((p) => !p.participantId);
      await Promise.all([
        newParticipants.length > 0 ? api.participants.create(receiptId, newParticipants) : Promise.resolve(),
        receiptTitle.trim() ? api.receipts.updateTitle(receiptId, receiptTitle.trim()) : Promise.resolve(),
      ]);
      router.push(`/receipts/${receiptId}/assign`);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  };

  const canContinue = participants.length > 0 && linesReady && !saving;

  return (
    <div className="min-h-screen bg-[#fff9ef] p-4 pb-20">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1 font-dm-mono text-xs font-bold uppercase tracking-widest text-[#4d4732] hover:text-black transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            {shareCode && <ShareCodeBadge shareCode={shareCode} />}
          </div>
          <h1 className="font-dm-sans text-2xl font-black uppercase px-3 py-2 bg-black text-white inline-block -rotate-1">
            mahal ai &lt;3
          </h1>
        </div>

        {/* Main card */}
        <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl p-5 flex flex-col gap-4">

          <h2 className="font-dm-sans font-bold text-2xl">Who&apos;s splitting the bill?</h2>

          {/* Add participant form */}
          <form onSubmit={handleAddParticipant} className="flex gap-2">
            <input
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="Enter name"
              className="flex-1 h-12 border-2 border-black rounded-lg px-4 font-dm-mono text-base focus:border-[4px] focus:outline-none focus:bg-[#cee7f0] bg-white placeholder:text-[#7e775f] transition-all"
            />
            <button
              type="submit"
              disabled={!participantName.trim()}
              className="h-12 w-12 border-[4px] border-black rounded-lg bg-[#98FB98] shadow-[2px_2px_0px_0px_#000] hover:bg-[#7de87d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </form>

          {/* Participants list */}
          {participants.length > 0 && (
            <div className="flex flex-col border-2 border-black rounded-lg overflow-hidden">
              {participants.map((participant, index) => (
                <div
                  key={participant.tempId}
                  className={`flex items-center justify-between px-4 py-3 bg-white ${index > 0 ? 'border-t-2 border-black' : ''}`}
                >
                  <span className="font-dm-mono font-bold text-sm">{participant.displayName}</span>
                  <button
                    onClick={() => handleRemoveParticipant(participant.tempId)}
                    className="w-7 h-7 flex items-center justify-center border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-red-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 border-2 border-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <p className="font-dm-mono text-xs font-bold uppercase tracking-wider text-red-600">{error}</p>
          </div>
        )}

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full mt-4 h-14 border-[4px] border-black rounded-lg font-dm-mono font-bold text-base uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && 'Saving participants...'}
          {!saving && checkingLines && (
            <span className="flex items-center gap-2 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
              {parseStatus === 'ULIP' ? 'Uploading receipt...' : 'Analyzing receipt...'}
            </span>
          )}
          {!saving && !checkingLines && participants.length === 0 && 'Add participants to continue'}
          {!saving && !checkingLines && participants.length > 0 && 'Assign Items →'}
        </button>

      </div>
    </div>
  );
}
