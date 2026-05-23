'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareCodeBadgeProps {
  shareCode: string;
  title?: string;
}

export function ShareCodeBadge({ shareCode, title }: ShareCodeBadgeProps) {
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/${shareCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: title || 'Receipt', url });
      } catch {
        // user dismissed the share sheet
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 bg-green-100 border-2 border-black rounded-lg px-3 py-2 shadow-[2px_2px_0px_0px_#000] hover:bg-green-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
    >
      {shared
        ? <Check className="w-3.5 h-3.5 text-green-800" strokeWidth={2.5} />
        : <Share2 className="w-3.5 h-3.5 text-green-800" strokeWidth={2.5} />
      }
      <span className="font-dm-mono text-[10px] uppercase font-bold tracking-widest text-green-800">
        {shared ? 'Copied!' : 'Share with group'}
      </span>
      <span className="font-dm-mono font-bold text-sm tracking-widest text-black">{shareCode}</span>
    </button>
  );
}
