'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  getPushSupport,
  getPermissionState,
  getExistingSubscription,
  subscribeToPush,
  type PushSupport,
} from '@/lib/client/push';

const DISMISSED_KEY = 'mahal_push_prompt_dismissed';

interface Props {
  // Ties a guest device to their participant so they get pings for this receipt
  participantId?: number | null;
  // Collector sees "when people pay"; everyone else "when it's time to pay"
  isCollector?: boolean;
}

type Phase = 'checking' | 'prompt' | 'needs-install' | 'subscribing' | 'done' | 'hidden';

export function NotificationOptIn({ participantId = null, isCollector = false }: Props) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (localStorage.getItem(DISMISSED_KEY)) {
        setPhase('hidden');
        return;
      }

      const support: PushSupport = getPushSupport();
      if (support === 'unsupported') {
        setPhase('hidden');
        return;
      }
      if (support === 'needs-install') {
        setPhase('needs-install');
        return;
      }

      if (getPermissionState() === 'denied') {
        setPhase('hidden');
        return;
      }

      const existing = await getExistingSubscription();
      if (cancelled) {
        return;
      }
      setPhase(existing ? 'hidden' : 'prompt');
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setPhase('hidden');
  };

  const handleEnable = async () => {
    setPhase('subscribing');
    setFailed(false);
    try {
      const ok = await subscribeToPush(participantId ?? undefined);
      if (ok) {
        setPhase('done');
        setTimeout(() => setPhase('hidden'), 2500);
      } else if (getPermissionState() === 'denied') {
        setPhase('hidden');
      } else {
        setFailed(true);
        setPhase('prompt');
      }
    } catch {
      setFailed(true);
      setPhase('prompt');
    }
  };

  if (phase === 'checking' || phase === 'hidden') {
    return null;
  }

  if (phase === 'needs-install') {
    return (
      <div className="bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="font-dm-mono text-[11px] font-bold text-black uppercase tracking-widest">
            Want a ping when it&apos;s time to pay?
          </p>
          <p className="font-dm-mono text-[10px] text-[#4d4732]">
            Add mahal to your home screen first: tap Share, then &quot;Add to Home Screen&quot;.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="p-1 border-2 border-black bg-white rounded-lg flex-shrink-0 shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="bg-[#b5ead7] border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] px-4 py-3">
        <p className="font-dm-mono text-[11px] font-bold text-black uppercase tracking-widest">
          You&apos;re on the list. We&apos;ll ping you here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="font-dm-mono text-[11px] font-bold text-[#4d4732] uppercase tracking-widest">
          {isCollector ? 'Get pinged when people pay?' : "Get pinged when it's time to pay?"}
        </p>
        {failed && (
          <p className="font-dm-mono text-[10px] font-bold uppercase tracking-wider text-red-600">
            Couldn&apos;t turn that on. Try again.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleEnable}
          disabled={phase === 'subscribing'}
          className="h-9 px-4 border-2 border-black rounded-lg font-dm-mono font-bold text-[11px] uppercase tracking-widest bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#fff9ef] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {phase === 'subscribing' ? '...' : 'Turn on'}
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="p-1 border-2 border-black bg-white rounded-lg shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
