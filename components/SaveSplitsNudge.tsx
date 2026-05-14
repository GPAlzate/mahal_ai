'use client';

import { useState } from 'react';
import { useAuth, SignUpButton } from '@clerk/nextjs';
import { Check } from 'lucide-react';

const FEATURES = [
  'See your receipt history',
  'Split with friends in real time',
  'Link your GCash and get paid instantly'
];

export function SaveSplitsNudge() {
  const { isSignedIn } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (isSignedIn || dismissed) {
    return null;
  }

  return (
    <div className="border-t-2 border-b-2 border-black py-5 flex flex-col gap-4">
      <div>
        <h2 className="font-dm-sans font-black text-xl uppercase leading-tight">
          Do more with mahal &lt;3
        </h2>
      </div>

      <ul className="flex flex-col gap-2.5">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 border-2 border-black bg-black flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </span>
            <span className="font-dm-sans text-[13px] text-[#1b1b1b]">{feature}</span>
          </li>
        ))}
      </ul>

      <button disabled className="w-full h-12 border-[4px] border-[#d0c6ab] rounded-lg font-dm-sans font-bold text-sm uppercase bg-[#e7e2d8] text-[#7e775f] cursor-not-allowed">
        Sign Up <span className="normal-case font-normal">(coming soon!)</span>
      </button>
{/* 
      <button
        onClick={() => setDismissed(true)}
        className="text-center font-dm-sans text-[11px] uppercase tracking-widest text-[#7e7576] hover:text-black transition-colors cursor-pointer"
      >
        Maybe later
      </button> */}
    </div>
  );
}
