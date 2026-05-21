'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
  onDelete?: () => Promise<void>;
  hasAssignments?: boolean;
  showLineTypeSelector?: boolean;
  lineType?: string;
}

export function LineItemModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onCancel,
  onDelete,
  hasAssignments = false,
  showLineTypeSelector = false,
  lineType,
}: LineItemModalProps) {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [receiptLineType, setReceiptLineType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setItemName(initialData.itemName);
        setQuantity(String(initialData.quantity));
        setUnitPrice(initialData.unitPrice.toFixed(2));
        setReceiptLineType(initialData.receiptLineType || '');
      } else {
        setItemName('');
        setQuantity('');
        setUnitPrice('');
        setReceiptLineType(lineType || '');
      }
      setError(null);
      setSaving(false);
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
    if (isNaN(priceNum) || unitPrice === '-') {
      setError('Price must be a valid number');
      return;
    }

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
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!saving && !deleting) {
      onCancel();
    }
  };

  const handleDelete = async () => {
    if (!onDelete) {
      return;
    }
    try {
      setDeleting(true);
      await onDelete();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleLineTypeChange = (newType: string) => {
    setReceiptLineType(newType);
    if (newType === 'DSCT') {
      const stripped = unitPrice.replace(/^-/, '');
      setUnitPrice(`-${stripped}`);
    } else if (receiptLineType === 'DSCT') {
      setUnitPrice(unitPrice.replace(/^-/, ''));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    if (receiptLineType === 'DSCT') {
      const stripped = val.replace(/^-*/, '');
      setUnitPrice(`-${stripped}`);
    } else {
      setUnitPrice(val);
    }
  };

  const handleUnitPriceFocus = () => {
    if (receiptLineType === 'DSCT' && unitPrice === '') {
      setUnitPrice('-');
    }
  };

  const handleUnitPriceBlur = () => {
    if (unitPrice === '-') {
      setUnitPrice('');
    }
  };

  const totalPrice = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);

  const inputClass = "w-full h-12 border-2 border-black rounded-lg px-4 font-dm-mono text-base focus:border-[4px] focus:outline-none focus:bg-[#cee7f0] bg-white placeholder:text-[#7e775f] transition-all disabled:opacity-50";
  const labelClass = "font-dm-mono text-[10px] uppercase font-bold tracking-widest text-[#4d4732]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleCancel} />

      <div className="relative z-10 w-full max-w-md bg-white rounded-xl border-[4px] border-black shadow-[4px_4px_0px_0px_#000] flex flex-col p-4 gap-4 max-h-[90dvh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="font-dm-sans font-bold text-2xl uppercase tracking-tight">
            {mode === 'create' ? 'Add Item' : 'Edit Item'}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="w-8 h-8 flex items-center justify-center border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Item Name */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Item Name</label>
            <input
              className={inputClass}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={receiptLineType === 'DSCT' ? 'e.g. Senior Citizen' : 'e.g. Burger'}
              disabled={saving}
            />
          </div>

          {/* Line Type Selector */}
          {showLineTypeSelector && (
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Line Type</label>
              <select
                value={receiptLineType}
                onChange={(e) => handleLineTypeChange(e.target.value)}
                disabled={saving}
                className="w-full h-12 border-2 border-black rounded-lg px-4 font-dm-mono text-base focus:border-[4px] focus:outline-none bg-white disabled:opacity-50 transition-all"
              >
                <option value="">Select type...</option>
                <option value="TAX">Tax</option>
                <option value="TIP">Tip</option>
                <option value="SRVC">Service Charge</option>
                <option value="DSCT">Discount</option>
                <option value="DADJ">Adjustment</option>
              </select>
            </div>
          )}

          {/* Qty + Unit Price */}
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 w-1/3">
              <label className={labelClass}>Qty</label>
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                step="1"
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className={labelClass}>
                Unit Price PHP{receiptLineType === 'DSCT' ? ' (−)' : ''}
              </label>
              <input
                className={inputClass}
                type="text"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                onFocus={handleUnitPriceFocus}
                onBlur={handleUnitPriceBlur}
                placeholder={receiptLineType === 'DSCT' ? '-100.00' : '0.00'}
                disabled={saving}
              />
            </div>
          </div>

          {/* Total preview */}
          <div className="bg-[#eeeeee] border-2 border-black rounded-lg p-2 flex justify-center items-center">
            <span className="font-dm-sans font-bold text-lg">
              {quantity} × PHP{unitPrice} = PHP{totalPrice.toFixed(2)}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="border-2 border-red-600 bg-red-50 px-4 py-3 rounded-lg">
              <p className="font-dm-mono text-xs font-bold uppercase tracking-wider text-red-600">
                {error}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving || deleting}
              className="flex-1 h-12 border-2 border-black rounded font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="flex-1 h-12 border-[4px] border-black rounded font-dm-mono font-bold text-sm uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Add Item' : 'Save Changes'}
            </button>
          </div>

          {/* Delete — edit mode only */}
          {mode === 'edit' && onDelete && (
            <div className="border-t-2 border-[#e2e2e2] pt-3">
              {confirmingDelete ? (
                <div className="flex flex-col gap-2">
                  <p className="font-dm-mono text-[11px] text-center text-[#4d4732]">
                    Remove this item and all its assignments?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="flex-1 h-10 border-2 border-black rounded font-dm-mono font-bold text-xs uppercase bg-white shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 h-10 border-2 border-red-600 rounded font-dm-mono font-bold text-xs uppercase bg-red-50 text-red-600 shadow-[2px_2px_0px_0px_#991b1b] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={saving || deleting}
                  className="w-full font-dm-mono text-[11px] uppercase tracking-widest text-[#7e7576] hover:text-red-600 transition-colors text-center py-1 disabled:opacity-50"
                >
                  Delete Item
                </button>
              )}
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
