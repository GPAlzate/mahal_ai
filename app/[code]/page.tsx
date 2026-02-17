'use client';

import { useState, useEffect, use } from 'react';
import { X, Eye } from 'lucide-react';
import { Card } from '@/components/Card';
import { api } from '@/lib/client/api-client';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';

export default function ShareCodePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const shareCode = resolvedParams.code.toUpperCase();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReceiptExpanded, setIsReceiptExpanded] = useState(false);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<number>>(new Set());
  const [showReceiptImage, setShowReceiptImage] = useState(false);

  const toggleParticipantExpanded = (participantId: number) => {
    setExpandedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  };

  useEffect(() => {
    async function fetchSummary() {
      try {
        const data = await api.receipts.getByShareCode(shareCode);

        // Only show finalized receipts
        if (data.receipt.status !== 'FLZD') {
          setError('This receipt has not been finalized yet.');
          setLoading(false);
          return;
        }

        setSummary(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
        setLoading(false);
      }
    }

    fetchSummary();
  }, [shareCode]);

  const formatCurrency = (amount: number) => {
    return `PHP${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-yellow-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card padding="lg">
            <p className="font-mono text-center">Loading receipt...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-yellow-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card padding="lg" className="border-red-600">
            <p className="font-bold uppercase tracking-wider text-red-600 mb-4">Error</p>
            <p className="font-mono">{error || 'Failed to load receipt'}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 p-4 bg-black text-white inline-block transform -rotate-1">
            mahal ai &lt;3
          </h1>
          {summary.receipt.imageURI && (
            <button
              onClick={() => setShowReceiptImage(true)}
              className="mt-1 border-4 border-black bg-white w-14 h-14 font-bold hover:bg-black hover:text-white transition-colors flex items-center justify-center flex-shrink-0 rotate-2"
              style={{ borderRadius: '60% 40% 55% 45% / 45% 55% 40% 60%' }}
            >
              <Eye className="w-5 h-5" />
                          </button>
          )}
        </div>

        {/* Share Code */}
        <div className="text-center font-mono text-sm text-gray-500 bg-green-100 border-2 border-green-300 px-4 py-2">
          URL Share Code: <span className="font-bold tracking-widest text-black">{summary.receipt.shareCode}</span>
        </div>

        {/* Itemized Receipt */}
        <Card padding="lg">
          {/* Header */}
          <h2 className="text-2xl font-bold uppercase tracking-wider mb-4">Receipt</h2>

          {/* Total - always visible */}
          <div className="flex justify-between items-center py-3 font-mono">
            <span className="text-xl font-bold uppercase">Total:</span>
            <span className="text-2xl font-bold">{formatCurrency(summary.total)}</span>
          </div>

          {/* Expandable details section */}
          <button
            onClick={() => setIsReceiptExpanded(!isReceiptExpanded)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-mono text-gray-600 hover:text-black transition-colors"
          >
            <span>{isReceiptExpanded ? 'Hide Details' : 'Show Details'}</span>
            <span className="text-lg">{isReceiptExpanded ? '▲' : '▼'}</span>
          </button>

          {isReceiptExpanded && (
            <div className="space-y-1 font-mono text-sm mt-4 pt-4 border-t-2 border-gray-200">
              {/* 1. All purchase/misc lines */}
              {summary.receipt.lines
                ?.filter(line => line.totalPrice !== 0)
                .map(line => {
                  const isDiscount = line.receiptLineType === 'DSCT';
                  return (
                    <div
                      key={line.id}
                      className={`flex justify-between py-1 ${isDiscount ? 'text-green-600' : ''}`}
                    >
                      <span className="flex-1">
                        {line.itemName}
                        {line.quantity !== 1 && ` (×${line.quantity})`}
                      </span>
                      <span className="font-bold ml-4">
                        {formatCurrency(line.totalPrice)}
                      </span>
                    </div>
                  );
                })}

              {/* 2. Subtotal */}
              <div className="flex justify-between py-2 border-t-2 border-gray-200 mt-2">
                <span className="font-bold">Subtotal:</span>
                <span className="font-bold">{formatCurrency(summary.subtotal)}</span>
              </div>

              {/* 3. Receipt summary fields (tax, tip, service, discount) */}
              {summary.tax !== 0 && (
                <div className="flex justify-between py-1">
                  <span>Tax:</span>
                  <span className="font-bold">{formatCurrency(summary.tax)}</span>
                </div>
              )}
              {summary.tip !== 0 && (
                <div className="flex justify-between py-1">
                  <span>Tip:</span>
                  <span className="font-bold">{formatCurrency(summary.tip)}</span>
                </div>
              )}
              {summary.serviceCharge !== 0 && (
                <div className="flex justify-between py-1">
                  <span>Service Charge:</span>
                  <span className="font-bold">{formatCurrency(summary.serviceCharge)}</span>
                </div>
              )}
              {summary.discount !== 0 && (
                <div className="flex justify-between py-1 text-green-600">
                  <span>Discount:</span>
                  <span className="font-bold">{formatCurrency(summary.discount)}</span>
                </div>
              )}

              {/* 4. Total */}
              <div className="flex justify-between py-3 border-t-4 border-black mt-2">
                <span className="text-xl font-bold uppercase">Total:</span>
                <span className="text-xl font-bold">{formatCurrency(summary.total)}</span>
              </div>
            </div>
          )}
        </Card>

        <hr className="border-t border-gray-300 my-4" />

        {/* Participant Splits */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold uppercase tracking-wider">Participant Splits</h2>
          {summary.participantSplits.map((split) => {
            const isExpanded = expandedParticipants.has(split.participantId);

            return (
            <Card key={split.participantId} padding={isExpanded ? 'lg' : 'md'}>
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => toggleParticipantExpanded(split.participantId)}
              >
                <h3 className={`font-bold uppercase tracking-wider ${isExpanded ? 'text-xl' : 'text-base'}`}>
                  {split.displayName}
                </h3>
                <div className="flex items-center gap-3">
                  <span className={`font-mono font-bold ${isExpanded ? 'text-2xl' : 'text-lg'}`}>
                    {formatCurrency(split.total)}
                  </span>
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isExpanded && (
                <>
                  {/* Line Items */}
                  <div className="space-y-2 mb-4 mt-4 pt-4 border-t-2 border-gray-200">
                    <p className="font-bold uppercase tracking-wider text-sm">Items</p>
                    {split.lineItems.map((item) => {
                      const isDiscount = item.shareAmount < 0;
                      const adjustedDenominator = item.shareQuantity > 0
                        ? item.quantity / item.shareQuantity
                        : item.quantity;

                      return (
                        <div
                          key={item.receiptLineId}
                          className={`flex justify-between font-mono text-sm py-1 ${isDiscount ? 'text-green-600' : ''}`}
                        >
                          <span>
                            {item.itemName} (1/{adjustedDenominator.toFixed(0)})
                          </span>
                          <span>{formatCurrency(item.shareAmount)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between font-mono border-t-2 border-gray-200 pt-2 mt-2">
                      <span className="font-bold">Subtotal:</span>
                      <span className="font-bold">{formatCurrency(split.subtotal)}</span>
                    </div>
                  </div>

                  {/* Misc Charges */}
                  <div className="space-y-1 font-mono text-sm mb-4">
                    {split.taxShare !== 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Tax (proportional):</span>
                        <span>+{formatCurrency(split.taxShare)}</span>
                      </div>
                    )}
                    {split.tipShare !== 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Tip (proportional):</span>
                        <span>+{formatCurrency(split.tipShare)}</span>
                      </div>
                    )}
                    {split.serviceChargeShare !== 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Service Charge (proportional):</span>
                        <span>+{formatCurrency(split.serviceChargeShare)}</span>
                      </div>
                    )}
                    {split.discountShare !== 0 && (() => {
                      const assignedDiscountAmount = split.lineItems
                        .filter(item => item.shareAmount < 0)
                        .reduce((sum, item) => sum + item.shareAmount, 0);
                      const proportionalDiscountAmount = split.discountShare - assignedDiscountAmount;

                      return (
                        <>
                          {assignedDiscountAmount !== 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Discount (assigned):</span>
                              <span>{formatCurrency(assignedDiscountAmount)}</span>
                            </div>
                          )}
                          {proportionalDiscountAmount !== 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Discount (proportional):</span>
                              <span>{formatCurrency(proportionalDiscountAmount)}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Total repeated at bottom of breakdown */}
                  <div className="flex justify-between py-3 border-t-4 border-black mt-2 font-mono">
                    <span className="text-xl font-bold uppercase">Total:</span>
                    <span className="text-xl font-bold">{formatCurrency(split.total)}</span>
                  </div>
                </>
              )}
            </Card>
            );
          })}
        </div>
      </div>

      {/* Receipt Image Modal */}
      {showReceiptImage && summary.receipt.imageURI && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowReceiptImage(false)}
        >
          <div
            className="relative max-w-lg w-full mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowReceiptImage(false)}
              className="absolute -top-3 -right-3 z-10 bg-white border-4 border-black p-2 hover:bg-red-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="overflow-auto bg-white border-4 border-black">
              <img
                src={summary.receipt.imageURI}
                alt="Original receipt"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
