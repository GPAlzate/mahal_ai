'use client';

import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';

interface LineItemModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: {
    itemName: string;
    quantity: number;
    unitPrice: number;
  };
  onSave: (data: { itemName: string; quantity: number; unitPrice: number }) => Promise<void>;
  onCancel: () => void;
  hasAssignments?: boolean;
}

export function LineItemModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onCancel,
  hasAssignments = false,
}: LineItemModalProps) {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0.00');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setItemName(initialData.itemName);
        setQuantity(String(initialData.quantity));
        setUnitPrice(initialData.unitPrice.toFixed(2));
      } else {
        setItemName('');
        setQuantity('1');
        setUnitPrice('0.00');
      }
      setError(null);
      setSaving(false); // Reset saving state when modal opens
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!itemName.trim()) {
      setError('Item name is required');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    const priceNum = parseFloat(unitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Price must be 0 or greater');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        itemName: itemName.trim(),
        quantity: qtyNum,
        unitPrice: priceNum,
      });
      // Don't reset form here - let parent handle closing modal
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!saving) {
      onCancel();
    }
  };

  const totalPrice = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md">
        <Card padding="lg">
          <h2 className="text-2xl font-bold uppercase tracking-wider mb-4">
            {mode === 'create' ? 'Add New Item' : 'Edit Item'}
          </h2>

          {mode === 'edit' && hasAssignments && (
            <div className="mb-4 p-3 border-2 border-yellow-600 bg-yellow-50">
              <p className="font-mono text-sm text-yellow-900">
                ⚠️ Editing quantity or price will clear participant assignments for this item.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 mb-6">
              {/* Item Name */}
              <Input
                label="Item Name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Burger"
                fullWidth
                disabled={saving}
                autoFocus
              />

              {/* Quantity */}
              <Input
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                step="0.01"
                min="0.01"
                fullWidth
                disabled={saving}
              />

              {/* Unit Price */}
              <Input
                label="Unit Price (PHP)"
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                fullWidth
                disabled={saving}
              />

              {/* Total Preview */}
              <div className="p-3 bg-gray-100 border-2 border-black">
                <div className="font-mono text-sm">
                  <span className="font-bold">Total:</span> PHP{totalPrice.toFixed(2)}
                </div>
                <div className="font-mono text-xs text-gray-600 mt-1">
                  {quantity} × PHP{unitPrice} = PHP{totalPrice.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 border-2 border-red-600 bg-red-50">
                <p className="font-bold uppercase tracking-wider text-red-600 text-sm">
                  {error}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                fullWidth
                disabled={saving}
              >
                {saving ? 'Saving...' : mode === 'create' ? 'Add Item' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
