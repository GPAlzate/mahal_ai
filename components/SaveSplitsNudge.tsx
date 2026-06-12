'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, SignUpButton } from '@clerk/nextjs';
import { Check } from 'lucide-react';
const FEATURES = [
  'Upload a receipt and mahal splits it automatically',
  'Share one link: everyone sees exactly what they owe',
  'Track who\'s paid and confirm with one tap',
];

interface Props {
  claimedName?: string;
}

export function SaveSplitsNudge({ claimedName }: Props) {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (isSignedIn || dismissed) return null;

  if (claimedName) {
    const firstName = claimedName.split(' ')[0];
    return (
      <div className="border-t-2 border-b-2 border-black py-5 flex flex-col gap-4">
        <div>
          <h2 className="font-dm-sans font-black text-xl uppercase leading-tight">
            You&apos;re {firstName} on this receipt
          </h2>
          <p className="font-dm-sans text-sm text-[#7e7576] mt-1">
            That only sticks on this phone. Sign up and this receipt follows you anywhere.
          </p>
        </div>

        <SignUpButton mode="redirect" signInFallbackRedirectUrl={pathname} forceRedirectUrl={pathname}>
          <button className="w-full h-12 border-[4px] border-black rounded-lg font-dm-sans font-bold text-sm uppercase bg-black text-white hover:bg-[#1a1a1a] transition-all cursor-pointer">
            Sign Up Free →
          </button>
        </SignUpButton>
        <button
          onClick={() => setDismissed(true)}
          className="text-center font-dm-mono text-[10px] uppercase tracking-widest text-[#7e7576] hover:text-black transition-colors cursor-pointer"
        >
          Maybe later
        </button>
      </div>
    );
  }

  return (
    <div className="border-t-2 border-b-2 border-black py-5 flex flex-col gap-4">
      <div>
        <h2 className="font-dm-sans font-black text-xl uppercase leading-tight">
          Paying for the group next time?
        </h2>
        <p className="font-dm-sans text-sm text-[#7e7576] mt-1">
          Sign up and manage your group bills with mahal ai &lt;3
        </p>
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

      <SignUpButton mode="redirect" signInFallbackRedirectUrl="/" forceRedirectUrl="/sign-up">
        <button className="w-full h-12 border-[4px] border-black rounded-lg font-dm-sans font-bold text-sm uppercase bg-black text-white hover:bg-[#1a1a1a] transition-all cursor-pointer">
          Sign Up Free →
        </button>
      </SignUpButton>
      <button
        onClick={() => setDismissed(true)}
        className="text-center font-dm-mono text-[10px] uppercase tracking-widest text-[#7e7576] hover:text-black transition-colors cursor-pointer"
      >
        Maybe later
      </button>
    </div>
  );
}
