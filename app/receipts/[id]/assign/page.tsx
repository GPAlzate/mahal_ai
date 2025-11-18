'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineItemCard } from '@/components/LineItemCard';
import { LineItemModal } from '@/components/LineItemModal';
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

  const [allLines, setAllLines] = useState<ReceiptLine[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [assignments, setAssignments] = useState<LineAssignments>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeLineId, setActiveLineId] = useState<number | null>(null);
  const [activeParticipantId, setActiveParticipantId] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<'items' | 'misc-charges'>('items');
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [lineItemModalMode, setLineItemModalMode] = useState<'create' | 'edit'>('create');
  const [editingLine, setEditingLine] = useState<ReceiptLine | null>(null);
  const [unassignedLineIds, setUnassignedLineIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchSplitGroup() {
      try {
        const splitGroup = await api.splitGroups.get(receiptId);

        // Redirect to share code page if finalized
        if (splitGroup.receipt.status === 'FLZD') {
          setLoading(false);
          router.push(`/${splitGroup.receipt.shareCode}`);
          return;
        }

        // Store all lines
        setAllLines(splitGroup.receipt.lines || []);
        setParticipants(splitGroup.participants);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }

    fetchSplitGroup();
  }, [receiptId, router]);

  // Filter lines based on current view
  const purchaseLines = allLines.filter((line) => line.receiptLineType === 'PRCH');
  const miscChargeLines = allLines.filter((line) => line.receiptLineType !== 'PRCH');
  const lines = currentView === 'items' ? purchaseLines : miscChargeLines;

  const toggleAssignment = (lineId: number, participantId: number) => {
    setAssignments((prev) => {
      const currentQuantity = prev[lineId]?.[participantId] || 0;
      const nextQuantity = currentQuantity > 0 ? 0 : 1;

      const nextLineAssignments = { ...(prev[lineId] || {}) };
      if (nextQuantity === 0) {
        delete nextLineAssignments[participantId];
      } else {
        nextLineAssignments[participantId] = nextQuantity;
      }

      return {
        ...prev,
        [lineId]: nextLineAssignments,
      };
    });

    // Clear unassigned highlight for this line if it's being assigned
    if (unassignedLineIds.has(lineId)) {
      setUnassignedLineIds((prev) => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }

    // Clear error if all lines are now assigned
    if (error) {
      const stillUnassigned = purchaseLines.filter(
        (line) =>
          line.id !== lineId &&
          (!assignments[line.id] || Object.keys(assignments[line.id]).length === 0)
      );
      if (stillUnassigned.length === 0) {
        setError(null);
        setUnassignedLineIds(new Set());
      }
    }
  };

  const handleLineSelection = (lineId: number) => {
    setError(null);

    // If a participant is already selected, assign them together and keep participant selected
    if (activeParticipantId) {
      toggleAssignment(lineId, activeParticipantId);
      // Keep participant selected, clear line selection
      setActiveLineId(null);
    } else {
      // Toggle line selection
      setActiveLineId((prev) => (prev === lineId ? null : lineId));
    }
  };

  const handleParticipantSelection = (participantId: number) => {
    setError(null);

    // If a line is already selected, assign them together and keep line selected
    if (activeLineId) {
      toggleAssignment(activeLineId, participantId);
      // Keep line selected, clear participant selection
      setActiveParticipantId(null);
    } else {
      // Toggle participant selection
      setActiveParticipantId((prev) => (prev === participantId ? null : participantId));
    }
  };

  const handleContinue = async () => {
    const unassignedLines = purchaseLines.filter(
      (line) => !assignments[line.id] || Object.keys(assignments[line.id]).length === 0
    );

    if (unassignedLines.length > 0) {
      setUnassignedLineIds(new Set(unassignedLines.map((line) => line.id)));
      setError('Please assign the highlighted items in red to at least one participant.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setUnassignedLineIds(new Set());

      // Convert local assignments to batch API format with proper share quantities
      const purchaseLinesMap = new Map(purchaseLines.map(line => [+line.id, line]));
      const assignmentsList = Object.entries(assignments).flatMap(([lineId, participants]) => {
        const lineIdNum = +lineId;
        const line = purchaseLinesMap.get(lineIdNum);

        if (!line) {
          console.log(`Line ${lineIdNum} not found in purchaseLines!`);
          return [];
        }

        const participantIds = Object.keys(participants);
        const shareQuantity = line.quantity / participantIds.length;

        return participantIds.map((participantId) => ({
          receiptLineId: lineIdNum,
          participantId: Number(participantId),
          shareQuantity,
        }));
      });

      // Batch persist all assignments to API
      await api.assignments.batchAssign(receiptId, assignmentsList);

      // Switch to misc charges view instead of navigating
      setCurrentView('misc-charges');
      setSaving(false);
    } catch (err: any) {
      setError(err.message || 'Unable to save assignments');
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

  const hasAssignments = (lineId: number) => {
    return assignments[lineId] && Object.keys(assignments[lineId]).length > 0;
  };

  const handleOpenEditModal = (line: ReceiptLine) => {
    setEditingLine(line);
    setLineItemModalMode('edit');
    setShowLineItemModal(true);
  };

  const handleOpenCreateModal = () => {
    setEditingLine(null);
    setLineItemModalMode('create');
    setShowLineItemModal(true);
  };

  const handleSaveLineItem = async (data: {
    itemName: string;
    quantity: number;
    unitPrice: number;
  }) => {
    try {
      if (lineItemModalMode === 'edit' && editingLine) {
        // Update existing line
        await api.lines.update(receiptId, editingLine.id, {
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
        });

        // Update local state
        setAllLines((prev) =>
          prev.map((line) =>
            line.id === editingLine.id
              ? { ...line, ...data }
              : line
          )
        );

        // Clear assignments if quantity or price changed
        if (
          data.quantity !== editingLine.quantity ||
          data.unitPrice !== editingLine.unitPrice
        ) {
          setAssignments((prev) => {
            const next = { ...prev };
            delete next[editingLine.id];
            return next;
          });
        }
      } else {
        // Create new line
        const newLine = await api.lines.create(receiptId, {
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          receiptLineType: 'PRCH',
        });

        // Add to local state
        setAllLines((prev) => [...prev, newLine]);
      }

      // Close modal
      setShowLineItemModal(false);
      setEditingLine(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save line item');
      throw err;
    }
  };

  const handleCancelLineItemModal = () => {
    setShowLineItemModal(false);
    setEditingLine(null);
  };

  const handleDeleteLineItem = async (line: ReceiptLine) => {
    if (!confirm(`Delete "${line.itemName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await api.lines.delete(receiptId, line.id);

      // Remove from local state
      setAllLines((prev) => prev.filter((l) => l.id !== line.id));

      // Clear assignments for this line
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[line.id];
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to delete line item');
    }
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
    <div className="h-screen flex flex-col bg-white">
      {/* Header - fixed */}
      <div className="p-4 md:p-8 border-b-4 border-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-wider mb-3">
            {currentView === 'items' ? 'Assign Items' : 'Review Misc Charges'}
          </h1>
          <p className="text-lg font-mono">
            {currentView === 'items'
              ? 'Tap a line and a participant to pair them. Repeat to split items together.'
              : 'Review tax, tip, service charges, and discounts. Add or edit as needed.'}
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 max-w-5xl mx-auto w-full">
          <Card padding="md" className="border-red-600">
            <p className="font-bold uppercase tracking-wider text-red-600">
              {error}
            </p>
          </Card>
        </div>
      )}

      {/* Items list - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <section className="space-y-4 max-w-5xl mx-auto">
          {currentView === 'items' ? (
            // Items assignment view
            <>
              {purchaseLines.length === 0 && (
                <Card padding="md">
                  <p className="font-mono text-center">No purchase lines found for this receipt.</p>
                </Card>
              )}

              {purchaseLines.map((line) => {
                const assignedParticipants = getAssignedParticipants(line.id);
                const isSelected = activeLineId === line.id;
                const isAssignmentMode = activeParticipantId !== null;
                const isAssignedToSelectedParticipant =
                  activeParticipantId && assignments[line.id]?.[activeParticipantId];
                const isUnassigned = unassignedLineIds.has(line.id);

                return (
                  <div key={line.id} className="mb-4">
                    <Card
                      padding="md"
                      className={`transition-all ${
                        isUnassigned
                          ? 'border-4 border-orange-600 bg-orange-50'
                          : isSelected
                            ? 'border-8 border-yellow-400 bg-yellow-50 shadow-[6px_6px_0_0_#000] -translate-y-1'
                            : isAssignedToSelectedParticipant
                              ? 'border-4 border-green-400 bg-green-50'
                              : isAssignmentMode
                                ? 'hover:bg-purple-100 hover:border-purple-500 cursor-pointer hover:scale-[1.02]'
                                : ''
                      }`}
                    >
                      {/* Line item header with edit button */}
                      <div className="flex justify-between items-start">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => handleLineSelection(line.id)}
                        >
                          <h3 className="font-bold text-xl uppercase tracking-wider mb-2">
                            {line.itemName}
                          </h3>
                          <p className="font-mono text-sm">
                            {line.quantity} × PHP{line.unitPrice.toFixed(2)} = PHP
                            {(line.quantity * line.unitPrice).toFixed(2)}
                          </p>

                          {/* Assigned participants - shown inline below item details */}
                          {assignedParticipants.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {assignedParticipants.map((participant) => (
                                <span
                                  key={participant.id}
                                  className="border-2 border-black px-3 py-1 text-sm font-bold uppercase tracking-wider"
                                >
                                  {participant.displayName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(line);
                            }}
                            className="p-2 border-2 border-black hover:bg-black hover:text-white transition-colors"
                            title="Edit item"
                          >
                            <span className="text-lg">✎</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLineItem(line);
                            }}
                            className="p-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                            title="Delete item"
                          >
                            <span className="text-lg">🗑</span>
                          </button>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}

              {/* Add New Item Button */}
              <button
                onClick={handleOpenCreateModal}
                className="w-full border-4 border-dashed border-gray-400 bg-gray-50 p-8 hover:border-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl">+</span>
                  <span className="font-bold uppercase tracking-wider">Add Item</span>
                </div>
              </button>
            </>
          ) : (
            // Misc charges review view
            <>
              {miscChargeLines.length === 0 ? (
                // Manual entry placeholder when no misc charges
                <button
                  type="button"
                  onClick={() => setShowManualEntryModal(true)}
                  className="border-4 border-dashed border-black p-8 w-full hover:bg-gray-50 transition-colors flex items-center justify-center min-h-[120px]"
                >
                  <div className="text-center">
                    <div className="text-6xl mb-2">+</div>
                    <p className="font-mono text-sm uppercase tracking-wider">Add Line Item</p>
                  </div>
                </button>
              ) : (
                // Display misc charge lines as read-only cards
                <>
                  {miscChargeLines.map((line) => (
                    <LineItemCard
                      key={line.id}
                      itemName={line.itemName}
                      quantity={line.quantity}
                      unitPrice={line.unitPrice}
                      onClick={() => setShowManualEntryModal(true)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-mono text-xs uppercase tracking-wide text-gray-500">
                        Click to edit (coming soon)
                      </p>
                    </LineItemCard>
                  ))}

                  {/* Add button below existing misc charges */}
                  <button
                    type="button"
                    onClick={() => setShowManualEntryModal(true)}
                    className="border-4 border-dashed border-black p-8 w-full hover:bg-gray-50 transition-colors flex items-center justify-center min-h-[120px]"
                  >
                    <div className="text-center">
                      <div className="text-6xl mb-2">+</div>
                      <p className="font-mono text-sm uppercase tracking-wider">Add Line Item</p>
                    </div>
                  </button>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {/* Participants - fixed at bottom with horizontal scroll (only show in items view) */}
      {currentView === 'items' && (
        <div className="border-t-4 border-black bg-white">
          {/* Status indicators */}
          {(activeLineId || activeParticipantId) && (
            <div className="px-4 pt-3 pb-2 border-b-2 border-gray-300 max-w-5xl mx-auto">
              <div className="flex flex-wrap gap-4 text-sm font-mono">
                {activeLineId && (
                  <span>
                    Assigning to:{' '}
                    <strong>
                      {purchaseLines.find((line) => line.id === activeLineId)?.itemName ||
                        'Select a line'}
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
          )}

          {/* Participants horizontal scroll */}
          <div className="overflow-x-auto">
            <div className="p-4">
              {participants.length === 0 ? (
                <div className="text-center font-mono text-gray-500">
                  No participants yet. Add them first to start assigning.
                </div>
              ) : (
                <div className="flex gap-4 pb-2">
                  {participants.map((participant: Participant) => {
                    const isActive = activeParticipantId === participant.id;
                    const assignedCount = getParticipantAssignmentCount(participant.id);
                    const isLineAssignmentMode = activeLineId !== null;
                    const isAlreadyAssigned =
                      activeLineId && assignments[activeLineId]?.[participant.id];

                    return (
                      <button
                        key={participant.id}
                        type="button"
                        onClick={() => handleParticipantSelection(participant.id)}
                        className={`
                          border-4 px-4 py-3 flex flex-col gap-1
                          uppercase tracking-wider text-left min-w-[160px]
                          transition-all flex-shrink-0
                          ${
                            isActive
                              ? 'bg-yellow-300 border-yellow-400 text-black font-extrabold shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
                              : isLineAssignmentMode && !isAlreadyAssigned
                                ? 'border-black bg-green-100 hover:bg-green-300 hover:scale-105 cursor-pointer'
                                : 'border-black bg-white hover:bg-gray-100'
                          }
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
            </div>
          </div>

          {/* Continue button */}
          <div className="p-4 border-t-4 border-black bg-white">
            <div className="max-w-5xl mx-auto">
              <Button fullWidth size="lg" onClick={handleContinue} disabled={saving}>
                {saving ? 'Continuing...' : 'Continue to Misc Charges'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize button (only show in misc charges view) */}
      {currentView === 'misc-charges' && (
        <div className="border-t-4 border-black bg-white p-4">
          <div className="max-w-5xl mx-auto">
            <Button
              fullWidth
              size="lg"
              onClick={() => router.push(`/receipts/${receiptId}/summary`)}
            >
              Continue to Summary
            </Button>
          </div>
        </div>
      )}

      {/* Line Item Modal (for both create and edit) */}
      <LineItemModal
        isOpen={showLineItemModal}
        mode={lineItemModalMode}
        initialData={
          editingLine
            ? {
                itemName: editingLine.itemName,
                quantity: editingLine.quantity,
                unitPrice: editingLine.unitPrice,
              }
            : undefined
        }
        hasAssignments={editingLine ? hasAssignments(editingLine.id) : false}
        onSave={handleSaveLineItem}
        onCancel={handleCancelLineItemModal}
      />

      {/* Manual entry modal */}
      {showManualEntryModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowManualEntryModal(false)}
        >
          <div
            className="bg-white border-4 border-black max-w-md w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold uppercase tracking-wider mb-4">Coming Soon</h2>
            <p className="font-mono mb-6">Manual line edits coming soon!</p>
            <Button fullWidth onClick={() => setShowManualEntryModal(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
