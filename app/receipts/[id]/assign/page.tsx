'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineItemCard } from '@/components/LineItemCard';
import { useParticipants } from '@/lib/client/hooks/useParticipants';
import { api } from '@/lib/client/api-client';

interface ReceiptLine {
  id: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  receiptLineType: string;
}

interface LineAssignments {
  [lineId: number]: {
    [participantId: number]: number;
  };
}

interface Participant {
  id: number;
  displayName: string;
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
  const [activeLineId, setActiveLineId] = useState<number | null>(null);
  const [activeParticipantId, setActiveParticipantId] = useState<number | null>(null);

  const {
    participants,
    loading: participantsLoading,
    error: participantsError,
  } = useParticipants(receiptId);

  const combinedLoading = loading || participantsLoading;

  useEffect(() => {
    async function fetchLines() {
      try {
        const allLines = await api.lines.list(receiptId);
        const purchaseLines = allLines.filter(
          (line: ReceiptLine) => line.receiptLineType === 'PRCH'
        );
        setLines(purchaseLines);

        const assignmentsData: LineAssignments = {};
        await Promise.all(
          purchaseLines.map(async (line) => {
            const lineAssignments = await api.assignments.list(receiptId, line.id);
            assignmentsData[line.id] = {};
            lineAssignments.forEach((assignment: any) => {
              assignmentsData[line.id][assignment.participantId] = assignment.shareQuantity;
            });
          })
        );
        setAssignments(assignmentsData);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }

    fetchLines();
  }, [receiptId]);

  const refreshLineAssignments = async (lineId: number) => {
    const lineAssignments = await api.assignments.list(receiptId, lineId);
    setAssignments((prev) => {
      const updated = { ...prev };
      updated[lineId] = {};
      lineAssignments.forEach((assignment: any) => {
        updated[lineId][assignment.participantId] = assignment.shareQuantity;
      });
      return updated;
    });
  };

  const updateAssignment = async (
    lineId: number,
    participantId: number,
    newQuantity: number
  ) => {
    setAssignments((prev) => {
      const nextLineAssignments = { ...(prev[lineId] || {}) };
      if (newQuantity === 0) {
        delete nextLineAssignments[participantId];
      } else {
        nextLineAssignments[participantId] = newQuantity;
      }

      return {
        ...prev,
        [lineId]: nextLineAssignments,
      };
    });

    try {
      if (newQuantity === 0) {
        await api.assignments.unassign(receiptId, lineId, participantId);
      } else {
        await api.assignments.assign(receiptId, lineId, participantId, newQuantity);
      }
    } catch (err: any) {
      setError(err.message);
      await refreshLineAssignments(lineId);
    }
  };

  const toggleAssignment = async (lineId: number, participantId: number) => {
    const currentQuantity = assignments[lineId]?.[participantId] || 0;
    const nextQuantity = currentQuantity > 0 ? 0 : 1;
    await updateAssignment(lineId, participantId, nextQuantity);
  };

  const handleLineSelection = async (lineId: number) => {
    setError(null);
    if (activeParticipantId) {
      await toggleAssignment(lineId, activeParticipantId);
    }
    setActiveLineId((prev) => (prev === lineId ? null : lineId));
  };

  const handleParticipantSelection = async (participantId: number) => {
    setError(null);
    if (activeLineId) {
      await toggleAssignment(activeLineId, participantId);
    }
    setActiveParticipantId((prev) => (prev === participantId ? null : participantId));
  };

  const handleContinue = async () => {
    const unassignedLines = lines.filter(
      (line) => !assignments[line.id] || Object.keys(assignments[line.id]).length === 0
    );

    if (unassignedLines.length > 0) {
      setError(
        `Assign at least one participant to every item: ${unassignedLines
          .map((line) => line.itemName)
          .join(', ')}`
      );
      return;
    }

    try {
      setSaving(true);
      router.push(`/receipts/${receiptId}/misc-charges`);
    } catch (err: any) {
      setError(err.message || 'Unable to continue');
      setSaving(false);
    }
  };

  const getAssignedParticipants = (lineId: number) => {
    const lineAssignments = assignments[lineId] || {};
    return participants.filter((participant: Participant) => lineAssignments[participant.id]);
  };

  const getParticipantAssignmentCount = (participantId: number) => {
    return lines.reduce((count, line) => {
      return count + (assignments[line.id]?.[participantId] ? 1 : 0);
    }, 0);
  };

  if (combinedLoading) {
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
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-wider mb-3">
            Assign Items
          </h1>
          <p className="text-lg font-mono">
            Tap a line and a participant to pair them. Repeat to split items together.
          </p>
        </div>

        {(error || participantsError) && (
          <Card padding="md" className="border-red-600">
            <p className="font-bold uppercase tracking-wider text-red-600">
              {error || participantsError}
            </p>
          </Card>
        )}

        <section className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {lines.length === 0 && (
            <Card padding="md">
              <p className="font-mono text-center">No purchase lines found for this receipt.</p>
            </Card>
          )}

          {lines.map((line) => {
            const assignedParticipants = getAssignedParticipants(line.id);
            return (
              <LineItemCard
                key={line.id}
                itemName={line.itemName}
                quantity={line.quantity}
                unitPrice={line.unitPrice}
                onClick={() => handleLineSelection(line.id)}
                isActive={activeLineId === line.id}
              >
                <div className="flex flex-wrap gap-2">
                  {assignedParticipants.length === 0 ? (
                    <span className="font-mono text-xs uppercase tracking-wide text-gray-500">
                      Select participants below to assign this item
                    </span>
                  ) : (
                    assignedParticipants.map((participant) => (
                      <span
                        key={participant.id}
                        className="border-2 border-black px-3 py-1 text-sm font-bold uppercase tracking-wider"
                      >
                        {participant.displayName}
                      </span>
                    ))
                  )}
                </div>
              </LineItemCard>
            );
          })}
        </section>

        <section className="pb-24 border-t-4 border-black pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold uppercase tracking-wider">Participants</h2>
            <div className="flex flex-wrap gap-4 text-sm font-mono">
              {activeLineId && (
                <span>
                  Assigning to:{' '}
                  <strong>
                    {lines.find((line) => line.id === activeLineId)?.itemName || 'Select a line'}
                  </strong>
                </span>
              )}
              {activeParticipantId && (
                <span>
                  Assigning from:{' '}
                  <strong>
                    {participants.find((p) => p.id === activeParticipantId)?.displayName ||
                      'Select a participant'}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {participants.length === 0 ? (
            <Card padding="md">
              <p className="font-mono text-center">
                No participants yet. Add them first to start assigning.
              </p>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-4">
              {participants.map((participant: Participant) => {
                const isActive = activeParticipantId === participant.id;
                const assignedCount = getParticipantAssignmentCount(participant.id);

                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => handleParticipantSelection(participant.id)}
                    className={`
                      border-4 border-black px-4 py-3 flex flex-col gap-1
                      uppercase tracking-wider text-left min-w-[160px]
                      ${isActive ? 'bg-black text-white' : 'bg-white'}
                    `}
                  >
                    <span className="font-bold">{participant.displayName}</span>
                    <span className="font-mono text-xs">
                      {assignedCount > 0
                        ? `${assignedCount} item${assignedCount > 1 ? 's' : ''}`
                        : 'Unassigned'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="sticky bottom-0 left-0 right-0 bg-white border-t-4 border-black pt-4 pb-2">
          <Button
            fullWidth
            size="lg"
            onClick={handleContinue}
            disabled={saving}
          >
            {saving ? 'Continuing...' : 'Continue to Misc Charges'}
          </Button>
        </div>
      </div>
    </div>
  );
}
