'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Eye, MoreVertical, X } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/client/api-client';
import LoadingScreen from '@/components/LoadingScreen';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import { ReceiptCard } from '@/components/ReceiptCard';
import { ParticipantSplits } from '@/components/ParticipantSplits';
import { KebabMenu } from '@/components/KebabMenu';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

function normalizeGcash(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return digits;
  }
  return null;
}

function formatGcashDisplay(raw: string): string {
  return `0${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`;
}

export default function CollectPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const shareCode = resolvedParams.code.toUpperCase();
  const router = useRouter();
  const { userId, isLoaded } = useAuth();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [gcashInput, setGcashInput] = useState('');
  const [gcashSaving, setGcashSaving] = useState(false);
  const [gcashSaved, setGcashSaved] = useState(false);
  const [gcashError, setGcashError] = useState('');
  const [gcashCopied, setGcashCopied] = useState(false);
  const [isEditingGcash, setIsEditingGcash] = useState(true);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    async function fetchAndVerify() {
      try {
        const data = await api.receipts.getByShareCode(shareCode);
        const { status, id } = data.receipt;

        if (status === 'ULIP' || status === 'PRSP') {
          router.replace(`/receipts/${id}/participants`);
          return;
        }
        if (status === 'DRFT') {
          router.replace(`/receipts/${id}/assign`);
          return;
        }

        const payerParticipant = data.participantSplits.find(
          p => p.participantId === data.receipt.payerParticipantId
        );
        if (userId && payerParticipant?.userId && userId === payerParticipant.userId) {
          setSummary(data);
          setGcashInput(data.receipt.gcashNumber ? formatGcashDisplay(data.receipt.gcashNumber) : '');
          setIsEditingGcash(!data.receipt.gcashNumber);
          setLoading(false);
          return;
        }

        const urlSecret = new URLSearchParams(window.location.search).get('c');
        if (urlSecret) {
          const { valid } = await api.receipts.verifyCollector(id, urlSecret).catch(() => ({ valid: false }));
          if (valid) {
            setSummary(data);
            setGcashInput(data.receipt.gcashNumber ? formatGcashDisplay(data.receipt.gcashNumber) : '');
            setIsEditingGcash(!data.receipt.gcashNumber);
            setLoading(false);
            return;
          }
        }

        router.replace(`/${shareCode}`);
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
        setLoading(false);
      }
    }

    fetchAndVerify();
  }, [shareCode, router, userId, isLoaded]);

  const handleSaveGcash = async () => {
    if (!summary) {
      return;
    }
    const trimmed = gcashInput.trim();
    if (trimmed === '') {
      setGcashError('');
      setGcashSaving(true);
      try {
        await api.receipts.updateGcashNumber(summary.receipt.id, null);
        setSummary(prev => prev ? { ...prev, receipt: { ...prev.receipt, gcashNumber: null }, payerGcashNumber: null } : prev);
        setGcashSaved(true);
        setTimeout(() => setGcashSaved(false), 2000);
      } catch {
        // silent
      } finally {
        setGcashSaving(false);
      }
      return;
    }
    const normalized = normalizeGcash(trimmed);
    if (normalized === null) {
      setGcashError('Enter a valid PH number (09XX XXX XXXX)');
      return;
    }
    setGcashError('');
    setGcashSaving(true);
    try {
      await api.receipts.updateGcashNumber(summary.receipt.id, normalized);
      setSummary(prev => prev ? { ...prev, receipt: { ...prev.receipt, gcashNumber: normalized }, payerGcashNumber: normalized } : prev);
      setGcashInput(formatGcashDisplay(normalized));
      setGcashSaved(true);
      setIsEditingGcash(false);
      setTimeout(() => setGcashSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setGcashSaving(false);
    }
  };

  const handleCopyGcash = () => {
    if (!summary?.receipt.gcashNumber) {
      return;
    }
    navigator.clipboard.writeText(formatGcashDisplay(summary.receipt.gcashNumber));
    setGcashCopied(true);
    setTimeout(() => setGcashCopied(false), 2000);
  };

  if (loading) {
    return <LoadingScreen message="Loading receipt..." />;
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-[#fff9ef] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-red-600 shadow-[4px_4px_0px_0px_#000] rounded-xl p-6 max-w-sm w-full">
          <p className="font-dm-mono font-bold uppercase tracking-wider text-red-600 mb-2 text-xs">Error</p>
          <p className="font-dm-mono text-sm">{error || 'Failed to load receipt'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff9ef] pb-[88px]">
      <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <Link href="/">
            <h1 className="font-dm-sans text-2xl font-black uppercase px-3 py-2 bg-black text-white inline-block -rotate-1">
              mahal ai &lt;3
            </h1>
          </Link>
          <div className="relative">
            <button
              onClick={() => setShowKebabMenu(v => !v)}
              className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showKebabMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowKebabMenu(false)} />
                <KebabMenu
                  className="z-50"
                  items={[
                    ...(summary.receipt.imageURI ? [{
                      label: 'View Receipt',
                      icon: <Eye className="w-4 h-4 flex-shrink-0" />,
                      onClick: () => { setShowReceiptImage(true); setShowKebabMenu(false); },
                    }] : []),
                  ]}
                />
              </>
            )}
          </div>
        </div>

        {/* Collector context badge */}
        <div className="flex items-center gap-2 bg-[#FFD700] border-2 border-black rounded-lg px-3 py-2 self-start shadow-[2px_2px_0px_0px_#000]">
          <span className="font-dm-mono text-[10px] uppercase font-bold tracking-widest">Collector view</span>
        </div>

        <ReceiptCard summary={summary} formatCurrency={formatCurrency} />

        {/* GCash management */}
        <div className="border-4 border-black rounded-xl bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden">
          <div className="bg-[#0066FF] px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-white">Your GCash number</p>
              <p className="font-dm-mono text-[11px] text-blue-200">So people know where to send payment</p>
            </div>
            {!isEditingGcash && summary.receipt.gcashNumber && (
              <button
                onClick={() => setIsEditingGcash(true)}
                className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-blue-200 hover:text-white transition-colors"
              >
                Edit
              </button>
            )}
          </div>
          <div className="px-4 py-3 flex flex-col gap-2">
            {isEditingGcash ? (
              <>
                <div className="flex gap-2 items-center">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="09XX XXX XXXX"
                    value={gcashInput}
                    onChange={e => {
                      setGcashInput(e.target.value);
                      setGcashSaved(false);
                      setGcashError('');
                    }}
                    className="flex-1 h-10 border-2 border-black rounded-lg px-3 font-dm-mono text-sm bg-white focus:outline-none focus:border-[#0066FF] transition-colors"
                  />
                  <button
                    onClick={handleSaveGcash}
                    disabled={gcashSaving}
                    className="h-10 px-4 border-2 border-black rounded-lg font-dm-mono text-xs font-bold uppercase bg-[#FFD700] shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-50"
                  >
                    {gcashSaving ? '...' : gcashSaved ? 'Saved!' : 'Save'}
                  </button>
                </div>
                {gcashError && (
                  <p className="font-dm-mono text-[11px] text-red-600">{gcashError}</p>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <p className="font-dm-mono font-bold text-xl tracking-wider">
                  {formatGcashDisplay(summary.receipt.gcashNumber!)}
                </p>
                <button
                  onClick={handleCopyGcash}
                  className="h-9 px-4 border-2 border-black rounded-lg font-dm-mono text-xs font-bold bg-white hover:bg-[#fff9ef] shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  {gcashCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>

        <ParticipantSplits
          receiptId={summary.receipt.id}
          participantSplits={summary.participantSplits}
          payerParticipantId={summary.receipt.payerParticipantId ?? null}
          formatCurrency={formatCurrency}
          isCollector={true}
        />

        <div className="h-4" />
      </div>

      {/* Fixed Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-white border-t-4 border-black px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => router.push('/')}
          className="w-full h-14 border-[4px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
        >
          Create New Receipt →
        </button>
      </nav>

      {/* Receipt Image Modal */}
      {showReceiptImage && summary.receipt.imageURI && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowReceiptImage(false)}
        >
          <div
            className="relative max-w-lg w-full mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowReceiptImage(false)}
              className="absolute -top-3 -right-3 z-10 bg-white border-4 border-black p-2 hover:bg-red-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="overflow-auto bg-white border-4 border-black">
              <img src={summary.receipt.imageURI} alt="Original receipt" className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
