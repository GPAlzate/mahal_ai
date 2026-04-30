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
  hasAssignments?: boolean;
  showLineTypeSelector?: boolean;
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
      setSaving(false);
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!itemName.trim()) { setError('Item name is required'); return; }
    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) { setError('Quantity must be greater than 0'); return; }
    const priceNum = parseFloat(unitPrice);
    if (isNaN(priceNum)) { setError('Price must be a valid number'); return; }
    if (receiptLineType === 'DSCT' && priceNum >= 0) {
      setError('Discount price must be negative (e.g., -10.00)'); return;
    } else if (receiptLineType !== 'DSCT' && priceNum < 0) {
      setError('Price cannot be negative (only discounts can be negative)'); return;
    }
    if (showLineTypeSelector && !receiptLineType) { setError('Please select a line type'); return; }

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

  const handleCancel = () => { if (!saving) onCancel(); };

  const handleLineTypeChange = (newType: string) => {
    setReceiptLineType(newType);
    if (newType === 'DSCT') {
      const cur = parseFloat(unitPrice);
      if (!isNaN(cur) && cur >= 0) setUnitPrice((-Math.abs(cur)).toFixed(2));
      else if (unitPrice === '0.00' || unitPrice === '') setUnitPrice('-0.00');
    } else if (receiptLineType === 'DSCT') {
      const cur = parseFloat(unitPrice);
      if (!isNaN(cur) && cur < 0) setUnitPrice(Math.abs(cur).toFixed(2));
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

        {/* Warning banner */}
        {mode === 'edit' && hasAssignments && (
          <div className="bg-[#FFD700] border-[4px] border-black p-2 flex items-center gap-2">
            <span className="text-base">⚠</span>
            <span className="font-dm-mono text-xs font-bold">Editing qty or price clears assignments</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Item Name */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Item Name</label>
            <input
              className={inputClass}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Burger"
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
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder={receiptLineType === 'DSCT' ? '-10.00' : '0.00'}
                step="0.5"
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
              <p className="font-dm-mono text-xs font-bold uppercase tracking-wider text-red-600">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 h-12 border-2 border-black rounded font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] hover:bg-[#f3f3f3] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 border-[4px] border-black rounded font-dm-mono font-bold text-sm uppercase bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFE44D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Add Item' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
