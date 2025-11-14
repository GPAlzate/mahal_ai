import React from 'react';
import { Card } from './Card';

interface LineItemCardProps {
  description: string;
  quantity: number;
  unitPrice: number;
  children?: React.ReactNode;
}

export function LineItemCard({
  description,
  quantity,
  unitPrice,
  children,
}: LineItemCardProps) {
  const total = quantity * unitPrice;

  return (
    <Card padding="md" className="mb-4">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-bold text-xl uppercase tracking-wider mb-2">
            {description}
          </h3>
          <p className="font-mono text-sm">
            {quantity} × ${unitPrice.toFixed(2)} = ${total.toFixed(2)}
          </p>
        </div>
      </div>
      {children}
    </Card>
  );
}
