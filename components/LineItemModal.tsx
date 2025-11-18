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
    receiptLineType?: string;
  };
  onSave: (data: {
    itemName: string;
    quantity: number;
    unitPrice: number;
    receiptLineType?: string;
  }) => Promise<void>;
  onCancel: () => void;
  hasAssignments?: boolean;
  showLineTypeSelector?: boolean; // For misc charges
}

export function LineItemModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onCancel,
  hasAssignments = false,
  showLineTypeSelector = false,
}: LineItemModalProps) {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0.00');
  const [receiptLineType, setReceiptLineType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setItemName(initialData.itemName);
        setQuantity(String(initialData.quantity));
        setUnitPrice(initialData.unitPrice.toFixed(2));
        setReceiptLineType(initialData.receiptLineType || '');
      } else {
        setItemName('');
        setQuantity('1');
        setUnitPrice('0.00');
        setReceiptLineType('');
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
    if (isNaN(priceNum)) {
      setError('Price must be a valid number');
      return;
    }

    // Validate price based on line type
    if (receiptLineType === 'DSCT' && priceNum >= 0) {
      setError('Discount price must be negative (e.g., -10.00)');
      return;
    } else if (receiptLineType !== 'DSCT' && priceNum < 0) {
      setError('Price cannot be negative (only discounts can be negative)');
      return;
    }

    if (showLineTypeSelector && !receiptLineType) {
      setError('Please select a line type');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        itemName: itemName.trim(),
        quantity: qtyNum,
        unitPrice: priceNum,
        ...(showLineTypeSelector && { receiptLineType }),
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

              {/* Line Type Selector (only for misc charges) */}
              {showLineTypeSelector && (
                <div>
                  <label className="block font-bold uppercase tracking-wider text-sm mb-2">
                    Line Type
                  </label>
                  <select
                    value={receiptLineType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setReceiptLineType(newType);

                      // Auto-populate negative sign when discount is selected
                      if (newType === 'DSCT') {
                        const currentPrice = parseFloat(unitPrice);
                        if (!isNaN(currentPrice) && currentPrice >= 0) {
                          setUnitPrice((-Math.abs(currentPrice)).toFixed(2));
                        } else if (unitPrice === '0.00' || unitPrice === '') {
                          setUnitPrice('-0.00');
                        }
                      }
                      // Remove negative sign when switching away from discount
                      else if (receiptLineType === 'DSCT') {
                        const currentPrice = parseFloat(unitPrice);
                        if (!isNaN(currentPrice) && currentPrice < 0) {
                          setUnitPrice(Math.abs(currentPrice).toFixed(2));
                        }
                      }
                    }}
                    disabled={saving}
                    className="w-full border-2 border-black p-2 font-mono focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Select type...</option>
                    <option value="TAX">Tax</option>
                    <option value="TIP">Tip</option>
                    <option value="SRVC">Service Charge</option>
                    <option value="DSCT">Discount</option>
                  </select>
                </div>
              )}

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
                label={`Unit Price (PHP)${receiptLineType === 'DSCT' ? ' - Enter as negative' : ''}`}
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder={receiptLineType === 'DSCT' ? '-10.00' : '0.00'}
                step="0.01"
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
