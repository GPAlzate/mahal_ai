'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText } from 'lucide-react';

type Tab = { label: string; icon: React.ElementType; href: string };

const TABS: Tab[] = [
  { label: 'Home', icon: Home, href: '/' },
  { label: 'Receipts', icon: FileText, href: '/receipts' },
];

const HIDDEN_PATTERNS = [
  /^\/receipts\/\d+\//,
  /^\/[A-Z0-9]{5}$/i,
  /^\/login/,
  /^\/sign-up/,
];

export function BottomTabBar() {
  const pathname = usePathname();

  if (HIDDEN_PATTERNS.some((p) => p.test(pathname))) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 bg-white border-t-4 border-black pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex max-w-lg mx-auto">
        {TABS.map(({ label, icon: Icon, href }) => {
          const isActive = href === '/' ? pathname === '/' : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 transition-colors duration-150 ${
                isActive ? 'text-black' : 'text-[#7e7576] hover:text-black'
              }`}
            >
              <div
                className={`p-1.5 transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#FFD700] border-2 border-black rounded-lg'
                    : 'border-2 border-transparent'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={`font-dm-mono text-[9px] uppercase tracking-widest ${
                  isActive ? 'font-bold text-black' : 'font-medium text-[#7e7576]'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
