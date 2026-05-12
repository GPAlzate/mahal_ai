'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User } from 'lucide-react';

type Tab =
  | { label: string; icon: React.ElementType; href: string; comingSoon?: false }
  | { label: string; icon: React.ElementType; href: null; comingSoon: true };

const TABS: Tab[] = [
  { label: 'Home', icon: Home, href: '/' },
  { label: 'Account', icon: User, href: null, comingSoon: true },
];

const TOP_LEVEL_ROUTES = ['/'];

export function BottomTabBar() {
  const pathname = usePathname();

  if (!TOP_LEVEL_ROUTES.includes(pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 bg-white border-t-4 border-black pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex max-w-lg mx-auto">
        {TABS.map(({ label, icon: Icon, href, comingSoon }) => {
          const isActive = href !== null && pathname === href;
          const inner = (
            <div
              className={`p-1.5 transition-colors duration-150 ${
                isActive
                  ? 'bg-[#FFD700] border-2 border-black'
                  : 'border-2 border-transparent'
              }`}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.5 : 2}
              />
            </div>
          );

          if (comingSoon) {
            return (
              <button
                key={label}
                disabled
                aria-label={`${label} — coming soon`}
                className="flex-1 flex flex-col items-center justify-center pt-2 pb-0 min-h-[44px] text-[#c0bbb8] cursor-not-allowed select-none"
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={label}
              href={href}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center pt-2 pb-0 min-h-[44px] transition-colors duration-150 ${
                isActive ? 'text-black' : 'text-[#7e7576] hover:text-black'
              }`}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
