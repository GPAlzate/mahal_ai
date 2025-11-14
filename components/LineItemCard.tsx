import React from 'react';
import { Card } from './Card';

interface LineItemCardProps {
  itemName: string;
  quantity: number;
  unitPrice: number;
  children?: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
}

export function LineItemCard({
  itemName,
  quantity,
  unitPrice,
  children,
  onClick,
  isActive = false,
  className = '',
}: LineItemCardProps) {
  const qty = Number(quantity);
  const price = Number(unitPrice);
  const total = qty * price;
  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        },
      }
    : {};

  const interactiveClasses = onClick ? 'cursor-pointer' : '';
  const activeClasses = isActive ? 'shadow-[6px_6px_0_0_#000] -translate-y-1' : '';

  return (
    <div
      onClick={onClick}
      className={`mb-4 transition-transform duration-150 ${interactiveClasses}`}
      {...interactiveProps}
    >
      <Card padding="md" className={`${activeClasses} ${className}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-xl uppercase tracking-wider mb-2">
              {itemName}
            </h3>
            <p className="font-mono text-sm">
              {qty} × ${price.toFixed(2)} = ${total.toFixed(2)}
            </p>
          </div>
        </div>
        {children}
      </Card>
    </div>
  );
}
