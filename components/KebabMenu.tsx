'use client';

import React from 'react';

export interface KebabMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  className?: string;
}

export function KebabMenu({ items, className = '' }: KebabMenuProps) {
  return (
    <div className={`absolute right-0 top-full mt-1 min-w-[11rem] bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl overflow-hidden flex flex-col ${className}`}>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          className={`flex items-center gap-2 px-3 py-2.5 font-dm-mono text-[11px] font-bold uppercase tracking-wide transition-colors text-left ${
            i < items.length - 1 ? 'border-b-2 border-black' : ''
          } ${
            item.variant === 'destructive'
              ? 'text-[#93000a] hover:bg-[#ffdad6]'
              : 'hover:bg-[#FFD700]'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
