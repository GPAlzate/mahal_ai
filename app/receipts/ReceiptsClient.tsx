'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import type { MyReceipt } from '@/lib/client/api-client';

function formatParticipants(names: string[]): string | null {
  if (names.length === 0) {
    return null;
  }
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  const suffix = rest > 0 ? ` and ${rest} other${rest > 1 ? 's' : ''}` : '';
  return 'with ' + shown.join(', ') + suffix;
}

function receiptStatusLabel(status: string): string {
  if (status === 'STLD') {
    return 'Settled';
  }
  if (status === 'FLZD') {
    return 'Finalized';
  }
  if (status === 'DRFT') {
    return 'Draft';
  }
  return 'Processing';
}

function receiptStatusClass(status: string): string {
  if (status === 'STLD') {
    return 'bg-[oklch(87%_0.14_148)] border-black text-black';
  }
  if (status === 'FLZD') {
    return 'bg-[oklch(84%_0.10_270)] border-black text-black';
  }
  if (status === 'DRFT') {
    return 'bg-[oklch(88%_0.15_82)] border-black text-black';
  }
  return 'bg-[oklch(91%_0.02_80)] border-black text-[oklch(55%_0.04_80)]';
}

interface Props {
  receipts: MyReceipt[];
}

export default function ReceiptsClient({ receipts }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? receipts.filter((r) =>
        (r.title ?? 'Untitled receipt').toLowerCase().includes(query.trim().toLowerCase())
      )
    : receipts;

  return (
    <main className="min-h-screen bg-[#faf8f3] px-4 py-6 flex flex-col gap-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/')}
          aria-label="Back to home"
          className="w-10 h-10 flex items-center justify-center border-2 border-black rounded-lg bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <h1 className="font-dm-sans font-bold text-2xl">My Receipts</h1>
        <span className="ml-auto font-dm-mono text-xs font-bold uppercase tracking-widest text-[#7e775f]">
          {receipts.length} total
        </span>
      </div>

      {/* Search */}
      {receipts.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7e775f]" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search receipts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-4 border-2 border-black rounded-lg font-dm-mono text-sm bg-white shadow-[2px_2px_0px_0px_#000] placeholder:text-[#b0a98e] focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      )}

      {/* List */}
      {receipts.length === 0 ? (
        <div className="bg-white border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl p-6 text-center">
          <p className="font-dm-mono text-sm text-[#7e775f]">No receipts yet — split a bill to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl p-6 text-center">
          <p className="font-dm-mono text-sm text-[#7e775f]">No receipts match &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="flex flex-col border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl overflow-hidden bg-white">
          {filtered.map((r, index) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                if (r.status === 'DRFT') {
                  router.push(`/receipts/${r.id}/assign`);
                } else if (r.status === 'ULIP' || r.status === 'PRSP') {
                  router.push(`/receipts/${r.id}/participants`);
                } else {
                  router.push(`/${r.shareCode}`);
                }
              }}
              className={`flex items-center justify-between px-4 py-3 bg-white hover:bg-[#fff9ef] active:bg-[#f3f3f3] transition-colors cursor-pointer text-left ${index > 0 ? 'border-t-2 border-black' : ''}`}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-dm-sans font-bold text-sm truncate">{r.title || 'Untitled receipt'}</span>
                  <span className={`font-dm-mono text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 ${receiptStatusClass(r.status)}`}>
                    {receiptStatusLabel(r.status)}
                  </span>
                </div>
                <span className="font-dm-mono text-[10px] text-[#7e775f]">
                  {new Date(r.receiptTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {formatParticipants(r.participantNames) && ` · ${formatParticipants(r.participantNames)}`}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 flex-shrink-0 ml-3 text-[#4d4732]" strokeWidth={2.5} />
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
