'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { api } from '@/lib/client/api-client';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const receiptId = parseInt(resolvedParams.id);
  const router = useRouter();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const data = await api.receipts.getSummary(receiptId);
        setSummary(data);
        setFinalized(data.receipt.status === 'FLZD');
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load summary');
        setLoading(false);
      }
    }

    fetchSummary();
  }, [receiptId]);

  const handleFinalize = async () => {
    try {
      setFinalizing(true);
      setError(null);

      const finalizedSummary = await api.receipts.finalize(receiptId);
      setSummary(finalizedSummary);
      setFinalized(true);
      setFinalizing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to finalize receipt');
      setFinalizing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card padding="lg">
            <p className="font-mono text-center">Loading summary...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card padding="lg" className="border-red-600">
            <p className="font-bold uppercase tracking-wider text-red-600 mb-4">Error</p>
            <p className="font-mono">{error || 'Failed to load summary'}</p>
            <Button className="mt-4" onClick={() => router.back()}>
              Go Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-wider mb-4">
            Receipt Summary
          </h1>
          {finalized && (
            <div className="inline-block bg-green-100 border-4 border-green-600 px-6 py-3 mb-4">
              <p className="font-bold uppercase tracking-wider text-green-600">✓ Finalized</p>
            </div>
          )}
        </div>

        {/* Share Code */}
        <Card padding="lg" className="bg-yellow-50">
          <div className="text-center">
            <p className="font-mono text-sm uppercase tracking-wider mb-2">Share Code</p>
            <p className="text-4xl md:text-5xl font-bold uppercase tracking-widest">
              {summary.receipt.shareCode}
            </p>
            <p className="font-mono text-xs mt-2 text-gray-600">
              Share this code with others to view the split
            </p>
          </div>
        </Card>

        {/* Receipt Totals */}
        <Card padding="lg">
          <h2 className="text-2xl font-bold uppercase tracking-wider mb-4">Receipt Totals</h2>
          <div className="space-y-2 font-mono">
            <div className="flex justify-between py-2 border-b-2 border-gray-200">
              <span>Subtotal:</span>
              <span className="font-bold">{formatCurrency(summary.subtotal)}</span>
            </div>
            {summary.tax > 0 && (
              <div className="flex justify-between py-2 border-b-2 border-gray-200">
                <span>Tax:</span>
                <span className="font-bold">{formatCurrency(summary.tax)}</span>
              </div>
            )}
            {summary.tip > 0 && (
              <div className="flex justify-between py-2 border-b-2 border-gray-200">
                <span>Tip:</span>
                <span className="font-bold">{formatCurrency(summary.tip)}</span>
              </div>
            )}
            {summary.serviceCharge > 0 && (
              <div className="flex justify-between py-2 border-b-2 border-gray-200">
                <span>Service Charge:</span>
                <span className="font-bold">{formatCurrency(summary.serviceCharge)}</span>
              </div>
            )}
            {summary.discount > 0 && (
              <div className="flex justify-between py-2 border-b-2 border-gray-200 text-green-600">
                <span>Discount:</span>
                <span className="font-bold">-{formatCurrency(summary.discount)}</span>
              </div>
            )}
            <div className="flex justify-between py-3 border-t-4 border-black">
              <span className="text-xl font-bold uppercase">Total:</span>
              <span className="text-xl font-bold">{formatCurrency(summary.total)}</span>
            </div>
          </div>
        </Card>

        {/* Participant Splits */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold uppercase tracking-wider">Participant Splits</h2>
          {summary.participantSplits.map((split) => (
            <Card key={split.participantId} padding="lg">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold uppercase tracking-wider">
                  {split.displayName}
                </h3>
                <div className="text-right">
                  <p className="text-sm font-mono text-gray-600">Total Owed</p>
                  <p className="text-2xl font-bold">{formatCurrency(split.total)}</p>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2 mb-4">
                <p className="font-bold uppercase tracking-wider text-sm">Items</p>
                {split.lineItems.map((item) => (
                  <div
                    key={item.receiptLineId}
                    className="flex justify-between font-mono text-sm py-1"
                  >
                    <span>
                      {item.itemName} ({item.shareQuantity}/{item.quantity})
                    </span>
                    <span>{formatCurrency(item.shareAmount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-mono border-t-2 border-gray-200 pt-2">
                  <span className="font-bold">Subtotal:</span>
                  <span className="font-bold">{formatCurrency(split.subtotal)}</span>
                </div>
              </div>

              {/* Misc Charges */}
              <div className="space-y-1 font-mono text-sm">
                {split.taxShare > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax (proportional):</span>
                    <span>{formatCurrency(split.taxShare)}</span>
                  </div>
                )}
                {split.tipShare > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tip (proportional):</span>
                    <span>{formatCurrency(split.tipShare)}</span>
                  </div>
                )}
                {split.serviceChargeShare > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Service Charge (proportional):</span>
                    <span>{formatCurrency(split.serviceChargeShare)}</span>
                  </div>
                )}
                {split.discountShare > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount (proportional):</span>
                    <span>-{formatCurrency(split.discountShare)}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 sticky bottom-4">
          {!finalized ? (
            <Button
              fullWidth
              size="lg"
              onClick={handleFinalize}
              disabled={finalizing}
            >
              {finalizing ? 'Finalizing...' : 'Finalize Receipt'}
            </Button>
          ) : (
            <div className="space-y-4">
              <Card padding="md" className="bg-green-50 border-green-600">
                <p className="font-mono text-center text-green-600">
                  Receipt finalized! Share the code <strong>{summary.receipt.shareCode}</strong> with participants.
                </p>
              </Card>
              <Button
                fullWidth
                size="lg"
                variant="secondary"
                onClick={() => router.push('/')}
              >
                Create New Receipt
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
