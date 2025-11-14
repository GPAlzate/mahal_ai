'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineItemCard } from '@/components/LineItemCard';
import { ShareQuantityPicker } from '@/components/ShareQuantityPicker';
import { useParticipants } from '@/lib/client/hooks/useParticipants';
import { api } from '@/lib/client/api-client';

interface ReceiptLine {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  receiptLineType: string;
}

interface LineAssignments {
  [lineId: number]: {
    [participantId: number]: number; // participantId -> shareQuantity
  };
}

export default function AssignPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const receiptId = parseInt(resolvedParams.id);
  const router = useRouter();

  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [assignments, setAssignments] = useState<LineAssignments>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { participants } = useParticipants(receiptId);

  // Fetch receipt lines (only PRCH items)
  useEffect(() => {
    async function fetchLines() {
      try {
        const allLines = await api.lines.list(receiptId);
        const purchaseLines = allLines.filter(
          (line: ReceiptLine) => line.receiptLineType === 'PRCH'
        );
        setLines(purchaseLines);

        // Fetch existing assignments for each line
        const assignmentsData: LineAssignments = {};
        for (const line of purchaseLines) {
          const lineAssignments = await api.assignments.list(receiptId, line.id);
          assignmentsData[line.id] = {};
          lineAssignments.forEach((assignment: any) => {
            assignmentsData[line.id][assignment.participantId] = assignment.shareQuantity;
          });
        }
        setAssignments(assignmentsData);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }

    fetchLines();
  }, [receiptId]);

  const handleShareChange = async (
    lineId: number,
    participantId: number,
    newQuantity: number
  ) => {
    // Update local state immediately (optimistic update)
    setAssignments((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [participantId]: newQuantity,
      },
    }));

    try {
      if (newQuantity === 0) {
        // Unassign participant
        await api.assignments.unassign(receiptId, lineId, participantId);

        // Remove from local state
        setAssignments((prev) => {
          const newAssignments = { ...prev };
          delete newAssignments[lineId][participantId];
          return newAssignments;
        });
      } else {
        // Assign or update share quantity
        await api.assignments.assign(receiptId, lineId, participantId, newQuantity);
      }
    } catch (err: any) {
      // Revert on error
      setError(err.message);
      // Refetch to get correct state
      const lineAssignments = await api.assignments.list(receiptId, lineId);
      setAssignments((prev) => {
        const updated = { ...prev };
        updated[lineId] = {};
        lineAssignments.forEach((assignment: any) => {
          updated[lineId][assignment.participantId] = assignment.shareQuantity;
        });
        return updated;
      });
    }
  };

  const handleContinue = async () => {
    // Check if all lines have at least one assignment
    const unassignedLines = lines.filter(
      (line) => !assignments[line.id] || Object.keys(assignments[line.id]).length === 0
    );

    if (unassignedLines.length > 0) {
      setError(
        `Please assign participants to all items. Missing: ${unassignedLines.map((l) => l.description).join(', ')}`
      );
      return;
    }

    // TODO: Navigate to review page when it's built
    setError('Review page coming soon! Assignments saved.');
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card padding="lg">
            <p className="font-mono text-center">Loading receipt...</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-wider mb-4">
            Assign Items
          </h1>
          <p className="text-lg font-mono">
            Who&apos;s paying for what? Assign shares for each item.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <Card padding="md" className="mb-6 border-red-600">
            <p className="font-bold uppercase tracking-wider text-red-600">{error}</p>
          </Card>
        )}

        {/* Line Items */}
        {lines.map((line) => (
          <LineItemCard
            key={line.id}
            description={line.description}
            quantity={line.quantity}
            unitPrice={line.unitPrice}
          >
            <div className="space-y-3">
              {participants.map((participant) => {
                const shareQuantity = assignments[line.id]?.[participant.id] || 0;
                return (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 border-2 border-black"
                  >
                    <span className="font-bold uppercase tracking-wider">
                      {participant.displayName}
                    </span>
                    <ShareQuantityPicker
                      value={shareQuantity}
                      onChange={(newQuantity) =>
                        handleShareChange(line.id, participant.id, newQuantity)
                      }
                      min={0}
                    />
                  </div>
                );
              })}
            </div>
          </LineItemCard>
        ))}

        {/* Continue Button */}
        <div className="sticky bottom-4">
          <Button
            fullWidth
            size="lg"
            onClick={handleContinue}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Continue to Review'}
          </Button>
        </div>
      </div>
    </div>
  );
}
