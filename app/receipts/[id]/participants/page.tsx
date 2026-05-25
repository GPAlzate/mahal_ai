'use client';

import { useState, use, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { api } from '@/lib/client/api-client';
import { ShareCodeBadge } from '@/components/ShareCodeBadge';
import type { ReceiptStatus } from '@/lib/schemas/receipt/public/Receipt';
import type { Participant } from '@/lib/schemas/participant/public/Participant';

interface LocalParticipant {
  tempId: string;
  participantId?: number;
  displayName: string;
  userId?: string;
  username?: string;
}

interface UserSearchResult {
  userId: string;
  username: string;
  displayName: string | null;
}

export default function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const receiptId = parseInt(resolvedParams.id);
  const router = useRouter();
  const { user } = useUser();

  const [participantName, setParticipantName] = useState('');
  const [participants, setParticipants] = useState<LocalParticipant[]>([]);
  const [payerTempId, setPayerTempId] = useState<string | null>(null);
  const [linesReady, setLinesReady] = useState(false);
  const [checkingLines, setCheckingLines] = useState(true);
  const [parseStatus, setParseStatus] = useState<ReceiptStatus>('ULIP');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptTitle, setReceiptTitle] = useState('');
  const [shareCode, setShareCode] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const participantsInitialized = useRef(false);

  const trimmedInput = participantName.trim();
  const showDropdown = !!user && trimmedInput.length >= 1 && (searching || searchResults.length > 0 || trimmedInput.length >= 2);

  useEffect(() => {
    if (participantsInitialized.current) {
      return;
    }
    if (user === undefined) {
      return;
    }
    participantsInitialized.current = true;

    api.participants.list(receiptId).then(async (existing) => {
      if (existing.length > 0) {
        setParticipants(
          existing.map((p) => ({
            tempId: `saved-${p.id}`,
            participantId: p.id,
            displayName: p.displayName,
          }))
        );
      } else if (user) {
        const profile = await api.user.get().catch(() => null);
        const name = profile?.displayName ?? user.fullName ?? user.firstName ?? '';
        if (name) {
          setParticipants([{ tempId: `creator-${user.id}`, displayName: name, userId: user.id }]);
        }
      }
    }).catch(() => {});
  }, [receiptId, user]);

  useEffect(() => {
    let cancelled = false;

    const checkReceiptStatus = async () => {
      try {
        const receipt = await api.receipts.get(receiptId);
        if (cancelled) {
          return;
        }

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
        if (!cancelled) {
          setTimeout(checkReceiptStatus, 1000);
        }
      }
    };

    checkReceiptStatus();
    return () => { cancelled = true; };
  }, [receiptId, router]);

  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (!trimmedInput) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (!user) {
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await api.users.search(trimmedInput);
        const linkedUserIds = new Set(participants.filter((p) => p.userId).map((p) => p.userId!));
        setSearchResults(results.filter((r) => !linkedUserIds.has(r.userId)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
  }, [trimmedInput, participants, user]);

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedInput) {
      return;
    }
    setParticipants((prev) => [...prev, { tempId: `temp-${Date.now()}`, displayName: trimmedInput }]);
    setParticipantName('');
    setSearchResults([]);
  };

  const handleSelectSearchResult = (result: UserSearchResult) => {
    setParticipants((prev) => [
      ...prev,
      {
        tempId: `search-${Date.now()}`,
        displayName: result.displayName ?? result.username,
        userId: result.userId,
        username: result.username,
      },
    ]);
    setParticipantName('');
    setSearchResults([]);
    inputRef.current?.focus();
  };

  const handleRemoveParticipant = async (tempId: string) => {
    const participant = participants.find((p) => p.tempId === tempId);
    if (!participant) {
      return;
    }
    setParticipants((prev) => prev.filter((p) => p.tempId !== tempId));
    if (payerTempId === tempId) {
      setPayerTempId(null);
    }
    if (participant.participantId) {
      await api.participants.delete(receiptId, participant.participantId).catch(() => {});
    }
  };

  const handleContinue = async () => {
    if (participants.length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const newParticipants = participants
        .filter((p) => !p.participantId)
        .map(({ displayName, userId }) => ({ displayName, ...(userId ? { userId } : {}) }));

      const [created] = await Promise.all([
        newParticipants.length > 0
          ? api.participants.create(receiptId, newParticipants)
          : Promise.resolve([] as Participant[]),
        receiptTitle.trim() ? api.receipts.updateTitle(receiptId, receiptTitle.trim()) : Promise.resolve(null),
      ]);

      const effectivePayerTempId = payerTempId ?? participants[0]?.tempId;
      const payerLocal = participants.find((p) => p.tempId === effectivePayerTempId);
      if (payerLocal) {
        let payerParticipantId: number | undefined;
        if (payerLocal.participantId) {
          payerParticipantId = payerLocal.participantId;
        } else {
          const newIdx = newParticipants.findIndex((np) => np.displayName === payerLocal.displayName);
          if (newIdx >= 0 && created[newIdx]) {
            payerParticipantId = created[newIdx].id;
          }
        }
        if (payerParticipantId) {
          await api.receipts.updatePayer(receiptId, payerParticipantId);
        }
      }

      router.push(`/receipts/${receiptId}/assign`);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  };

  const canContinue = participants.length > 0 && linesReady && !saving;

  return (
    <div className="min-h-screen bg-[#fff9ef] pb-20">

      <header className="sticky top-0 z-40 bg-white border-b-4 border-black w-full">
        <div className="px-5 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-dm-sans font-black text-sm uppercase tracking-tight text-[#7e7576]">Participants</span>
          {shareCode
            ? <ShareCodeBadge shareCode={shareCode} />
            : <div className="w-8" />
          }
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">

        <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl p-5 flex flex-col gap-4">

          <h2 className="font-dm-sans font-bold text-2xl">Who&apos;s splitting the bill?</h2>

          <div className="flex flex-col">
            <form onSubmit={handleAddParticipant} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder={user ? 'Name or @username' : 'Name'}
                autoComplete="off"
                spellCheck={false}
                className="flex-1 h-12 border-2 border-black rounded-lg px-4 font-dm-mono text-base focus:border-[4px] focus:outline-none focus:bg-[#cee7f0] bg-white placeholder:text-[#7e775f] transition-all"
              />
              <button
                type="submit"
                disabled={!trimmedInput}
                className="h-12 w-12 border-[4px] border-black rounded-lg bg-[#98FB98] shadow-[2px_2px_0px_0px_#000] hover:bg-[#7de87d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </form>

            {showDropdown && (
              <div
                ref={dropdownRef}
                className="border-2 border-t-0 border-black rounded-b-lg bg-white overflow-hidden"
              >
                {searching && (
                  <div className="px-4 py-2.5 flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#4d4732] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <span className="font-dm-mono text-xs text-[#7e775f]">Searching...</span>
                  </div>
                )}

                {!searching && searchResults.length > 0 && searchResults.map((result, i) => (
                  <button
                    key={result.userId}
                    type="button"
                    onClick={() => handleSelectSearchResult(result)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fff9ef] active:bg-[#f5edd8] transition-colors text-left ${i > 0 ? 'border-t border-[#e8e0d0]' : ''}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#e8e0d0] border-2 border-black flex items-center justify-center flex-shrink-0">
                      <span className="font-dm-mono font-bold text-[10px] text-black uppercase">
                        {(result.displayName ?? result.username).charAt(0)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0 min-w-0">
                      <span className="font-dm-mono font-bold text-sm text-black leading-tight truncate">
                        {result.displayName ?? result.username}
                      </span>
                      <span className="font-dm-mono text-[11px] text-[#7e775f] leading-tight">
                        @{result.username}
                      </span>
                    </div>
                  </button>
                ))}

                {!searching && searchResults.length === 0 && trimmedInput.length >= 2 && (
                  <div className="px-4 py-2.5">
                    <span className="font-dm-mono text-xs text-[#7e775f]">No users found — press + to add as plain name</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {participants.length > 0 && (
            <div className="flex flex-col border-2 border-black rounded-lg overflow-hidden">
              {participants.map((participant, index) => {
                const isPayer = payerTempId === null
                  ? participant.tempId === participants[0].tempId
                  : participant.tempId === payerTempId;
                return (
                  <div
                    key={participant.tempId}
                    className={`flex items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t-2 border-black' : ''} ${isPayer ? 'bg-[#FFFDE7]' : 'bg-white'}`}
                  >
                    <div className="flex flex-col gap-0 flex-1 min-w-0">
                      <span className="font-dm-mono font-bold text-sm leading-tight">{participant.displayName}</span>
                      {participant.username && (
                        <span className="font-dm-mono text-[11px] text-[#7e775f] leading-tight">@{participant.username}</span>
                      )}
                    </div>
                    {isPayer ? (
                      <span className="font-dm-mono text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-[#FFD700] border-2 border-black rounded shadow-[2px_2px_0px_0px_#000]">
                        Paid the bill
                      </span>
                    ) : (
                      participants.length >= 2 && (
                        <button
                          type="button"
                          onClick={() => setPayerTempId(participant.tempId)}
                          className="font-dm-mono text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] hover:bg-[#fff9ef] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-[#4d4732] hover:text-black"
                        >
                          Set as payer
                        </button>
                      )
                    )}
                    <button
                      onClick={() => handleRemoveParticipant(participant.tempId)}
                      className="w-7 h-7 flex items-center justify-center border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-red-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {error && (
          <div className="mt-4 border-2 border-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <p className="font-dm-mono text-xs font-bold uppercase tracking-wider text-red-600">{error}</p>
          </div>
        )}

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
