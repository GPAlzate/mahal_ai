'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { MyReceipt } from '@/lib/client/api-client';
import ReceiptStatusBadge from '@/components/ReceiptStatusBadge';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

function formatParticipants(names: string[]): string | null {
  if (names.length === 0) {
    return null;
  }
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  const suffix = rest > 0 ? ` and ${rest} other${rest > 1 ? 's' : ''}` : '';
  return 'with ' + shown.join(', ') + suffix;
}

interface Props {
  owedReceipts: MyReceipt[];
  owingReceipts: MyReceipt[];
  allReceipts: MyReceipt[];
}

type Tab = 'owed' | 'owing' | 'all';

function ReceiptRow({ r, index, showParticipants, onClick }: { r: MyReceipt; index: number; showParticipants: boolean; onClick: () => void }) {
  const participants = formatParticipants(r.participantNames);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-[#fff9ef] active:bg-[#f3f3f3] transition-colors cursor-pointer text-left ${index > 0 ? 'border-t-2 border-black' : ''}`}
    >
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-dm-sans font-bold text-sm truncate">{r.title || 'Untitled receipt'}</span>
        <span className="font-dm-mono text-[10px] text-[#7e775f]">
          {new Date(r.receiptTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {showParticipants && participants && ` · ${participants}`}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {r.userOwedAmount > 0 && (
          <span className="font-dm-mono font-bold text-sm text-black">
            {formatCurrency(r.userOwedAmount)}
          </span>
        )}
        <ReceiptStatusBadge status={r.status} />
      </div>
    </button>
  );
}

export default function ReceiptsClient({ owedReceipts, owingReceipts, allReceipts }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('owed');
  const [query, setQuery] = useState('');

  const tabReceipts: Record<Tab, MyReceipt[]> = {
    owed: owedReceipts,
    owing: owingReceipts,
    all: allReceipts,
  };

  const current = tabReceipts[activeTab];
  const filtered = query.trim()
    ? current.filter((r) =>
        (r.title ?? 'Untitled receipt').toLowerCase().includes(query.trim().toLowerCase())
      )
    : current;

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setQuery('');
  }

  function handleRowClick(r: MyReceipt) {
    if (r.status === 'DRFT') {
      router.push(`/receipts/${r.id}/assign`);
    } else if (r.status === 'ULIP' || r.status === 'PRSP') {
      router.push(`/receipts/${r.id}/participants`);
    } else {
      router.push(`/${r.shareCode}`);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf8f3] px-4 pt-6 pb-28 flex flex-col gap-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="font-dm-sans font-black text-3xl">Receipts</h1>
        {allReceipts.length > 0 && activeTab !== 'all' && (
          <button
            type="button"
            onClick={() => handleTabChange('all')}
            className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-[#7e7576] hover:text-black transition-colors"
          >
            See all ({allReceipts.length})
          </button>
        )}
        {activeTab === 'all' && (
          <button
            type="button"
            onClick={() => handleTabChange('owed')}
            className="font-dm-mono text-[10px] font-bold uppercase tracking-widest text-[#7e7576] hover:text-black transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Toggle — binary, hidden when viewing all */}
      {activeTab !== 'all' && (
        <div className="flex border-2 border-black rounded-lg overflow-hidden shadow-[2px_2px_0px_0px_#000]">
          {([
            { key: 'owed' as Tab, label: "I'm Owed" },
            { key: 'owing' as Tab, label: 'I Owe' },
          ]).map(({ key, label }, i) => (
            <button
              key={key}
              type="button"
              onClick={() => handleTabChange(key)}
              className={`flex-1 py-2 font-dm-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                i > 0 ? 'border-l-2 border-black' : ''
              } ${
                activeTab === key
                  ? 'bg-[#FFD700] text-black'
                  : 'bg-white text-[#7e7576] hover:bg-[#fff9ef]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {current.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7e775f]" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search receipts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-4 border-2 border-black rounded-lg font-dm-mono text-sm bg-white shadow-[2px_2px_0px_0px_#000] placeholder:text-[#b0a98e] focus:outline-none focus:border-[3px] focus:bg-[#cee7f0] transition-all"
          />
        </div>
      )}

      {/* List */}
      {current.length === 0 ? (
        <div className="bg-white border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl p-6 text-center">
          <p className="font-dm-mono text-sm text-[#7e775f]">
            {activeTab === 'owed' && 'No one owes you yet.'}
            {activeTab === 'owing' && "You're all settled up."}
            {activeTab === 'all' && 'No receipts yet — split a bill to get started.'}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl p-6 text-center">
          <p className="font-dm-mono text-sm text-[#7e775f]">No receipts match &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="flex flex-col border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl overflow-hidden bg-white">
          {filtered.map((r, index) => (
            <ReceiptRow key={r.id} r={r} index={index} showParticipants={activeTab === 'all'} onClick={() => handleRowClick(r)} />
          ))}
        </div>
      )}
    </main>
  );
}
