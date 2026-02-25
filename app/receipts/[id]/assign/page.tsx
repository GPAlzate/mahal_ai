'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { X, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
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
  const [currentView, setCurrentView] = useState<'items' | 'discounts' | 'misc-charges'>('items');
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [lineItemModalMode, setLineItemModalMode] = useState<'create' | 'edit'>('create');
  const [editingLine, setEditingLine] = useState<ReceiptLine | null>(null);
  const [unassignedLineIds, setUnassignedLineIds] = useState<Set<number>>(new Set());
  const [receiptImageURI, setReceiptImageURI] = useState<string | null>(null);
  const [showReceiptImage, setShowReceiptImage] = useState(false);

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

        // Store all lines and image URI
        const lines = splitGroup.receipt.lines || [];
        setAllLines(lines);
        setParticipants(splitGroup.participants);
        setReceiptImageURI(splitGroup.receipt.imageURI || null);

        // Build assignments data from the response
        const assignmentsData: LineAssignments = {};
        splitGroup.assignments.forEach((assignment) => {
          if (!assignmentsData[assignment.receiptLineId]) {
            assignmentsData[assignment.receiptLineId] = {};
          }
          assignmentsData[assignment.receiptLineId][assignment.participantId] = assignment.shareQuantity;
        });

        setAssignments(assignmentsData);
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
  const discountLines = allLines.filter((line) => line.receiptLineType === 'DSCT');
  const miscChargeLines = allLines.filter((line) => line.receiptLineType !== 'PRCH' && line.receiptLineType !== 'DSCT');
  const lines = currentView === 'items' ? purchaseLines : currentView === 'discounts' ? discountLines : miscChargeLines;

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
    if (currentView === 'items') {
      // Validate all purchase lines are assigned
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

        // Convert purchase assignments to batch API format with proper share quantities
        const purchaseLinesMap = new Map(purchaseLines.map(line => [+line.id, line]));
        const assignmentsList = Object.entries(assignments).flatMap(([lineId, participants]) => {
          const lineIdNum = +lineId;
          const line = purchaseLinesMap.get(lineIdNum);

          if (!line) return [];

          const participantIds = Object.keys(participants);
          const shareQuantity = line.quantity / participantIds.length;

          return participantIds.map((participantId) => ({
            receiptLineId: lineIdNum,
            participantId: Number(participantId),
            shareQuantity,
          }));
        });

        // Batch persist purchase assignments to API
        await api.assignments.batchAssign(receiptId, assignmentsList);

        // Move to discounts view (or skip to misc-charges if no discount lines)
        setActiveLineId(null);
        setActiveParticipantId(null);
        setCurrentView(discountLines.length > 0 ? 'discounts' : 'misc-charges');
        setSaving(false);
      } catch (err: any) {
        setError(err.message || 'Unable to save assignments');
        setSaving(false);
      }
    } else if (currentView === 'discounts') {
      // Discount assignments are optional — save any that exist and move on
      try {
        setSaving(true);
        setError(null);

        // Build discount assignment list (only for lines that have assignments)
        const discountLinesMap = new Map(discountLines.map(line => [+line.id, line]));
        const discountAssignmentsList = Object.entries(assignments).flatMap(([lineId, participants]) => {
          const lineIdNum = +lineId;
          const line = discountLinesMap.get(lineIdNum);

          if (!line) return [];

          const participantIds = Object.keys(participants);
          if (participantIds.length === 0) return [];

          const shareQuantity = 1 / participantIds.length;

          return participantIds.map((participantId) => ({
            receiptLineId: lineIdNum,
            participantId: Number(participantId),
            shareQuantity,
          }));
        });

        // Save discount assignments if any
        if (discountAssignmentsList.length > 0) {
          await api.assignments.batchAssign(receiptId, discountAssignmentsList);
        }

        setActiveLineId(null);
        setActiveParticipantId(null);
        setCurrentView('misc-charges');
        setSaving(false);
      } catch (err: any) {
        setError(err.message || 'Unable to save assignments');
        setSaving(false);
      }
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
    receiptLineType?: string;
  }) => {
    try {
      if (lineItemModalMode === 'edit' && editingLine) {
        // Update existing line
        const updateData: any = {
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
        };
        if (data.receiptLineType) {
          updateData.receiptLineType = data.receiptLineType;
        }

        await api.lines.update(receiptId, editingLine.id, updateData);

        // Update local state
        setAllLines((prev) =>
          prev.map((line) =>
            line.id === editingLine.id
              ? { ...line, ...data, receiptLineType: data.receiptLineType || line.receiptLineType }
              : line
          )
        );

        // Clear assignments if quantity or price changed (only for purchase items)
        if (
          editingLine.receiptLineType === 'PRCH' &&
          (data.quantity !== editingLine.quantity || data.unitPrice !== editingLine.unitPrice)
        ) {
          setAssignments((prev) => {
            const next = { ...prev };
            delete next[editingLine.id];
            return next;
          });
        }
      } else {
        // Create new line
        const receiptLineType = data.receiptLineType || (currentView === 'items' ? 'PRCH' : 'SRVC');
        const newLine = await api.lines.create(receiptId, {
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          receiptLineType,
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
      <div className="min-h-screen bg-yellow-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card padding="lg">
            <p className="font-mono text-center">Loading receipt...</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-yellow-50">
      {/* Header - fixed */}
      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto mb-8">
          <PageHeader
            onBack={() => router.push(`/receipts/${receiptId}/participants`)}
            onViewReceipt={receiptImageURI ? () => setShowReceiptImage(true) : undefined}
          />
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
      <div className="flex-1 overflow-y-auto px-4 md:px-8">
        <section className="space-y-4 max-w-5xl mx-auto">
          {currentView === 'items' && (
            // Items assignment view
            <Card padding="lg" className="mb-6">
              <h2 className="text-2xl font-bold mb-6">Tap an item or a person to pair them</h2>

              {purchaseLines.length === 0 && (
                <p className="text-center font-bold py-4">No receipt lines yet! Add an item below</p>
              )}

              <div className="space-y-4">
              {/* Add New Item Button */}
              <button
                onClick={handleOpenCreateModal}
                className="w-full border-4 border-dashed border-gray-400 bg-gray-50 p-4 hover:border-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">+</span>
                  <span className="font-bold uppercase tracking-wider">Add Item</span>
                </div>
              </button>

              {purchaseLines.map((line) => {
                const assignedParticipants = getAssignedParticipants(line.id);
                const isSelected = activeLineId === line.id;
                const isAssignmentMode = activeParticipantId !== null;
                const isAssignedToSelectedParticipant =
                  activeParticipantId && assignments[line.id]?.[activeParticipantId];
                const isUnassigned = unassignedLineIds.has(line.id);

                return (
                  <div
                    key={line.id}
                    className={`p-4 border-4 border-black transition-all ${
                      isUnassigned
                        ? 'border-orange-600 bg-orange-50'
                        : isSelected
                          ? 'border-8 border-yellow-400 bg-yellow-50 -translate-y-1'
                          : isAssignedToSelectedParticipant
                            ? 'border-green-400 bg-green-50'
                            : isAssignmentMode
                              ? 'hover:bg-purple-100 hover:border-purple-500 cursor-pointer hover:scale-[1.02] bg-white'
                              : 'bg-white'
                    }`}
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => handleLineSelection(line.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
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
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLineItem(line);
                            }}
                            className="p-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                            title="Delete item"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </Card>
          )}

          {currentView === 'discounts' && (
            // Discounts assignment view
            <Card padding="lg" className="mb-6">
              <h2 className="text-2xl font-bold mb-4">Assign Discounts (Optional)</h2>
              <p className="text-sm mb-6">
                Tap a discount and a person to assign it. Unassigned discounts will be split proportionally.
              </p>

              <div className="space-y-4">
              {discountLines.map((line) => {
                const assignedParticipants = getAssignedParticipants(line.id);
                const isSelected = activeLineId === line.id;
                const isAssignmentMode = activeParticipantId !== null;
                const isAssignedToSelectedParticipant =
                  activeParticipantId && assignments[line.id]?.[activeParticipantId];

                return (
                  <div
                    key={line.id}
                    className={`p-4 border-4 border-black transition-all ${
                      isSelected
                        ? 'border-8 border-yellow-400 bg-yellow-50 -translate-y-1'
                        : isAssignedToSelectedParticipant
                          ? 'border-green-400 bg-green-50'
                          : isAssignmentMode
                            ? 'hover:bg-purple-100 hover:border-purple-500 cursor-pointer hover:scale-[1.02] bg-white'
                            : 'bg-white'
                    }`}
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => handleLineSelection(line.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-xl uppercase tracking-wider mb-2 text-green-700">
                            {line.itemName}
                          </h3>
                          <p className="font-mono text-sm text-green-600">
                            PHP{(line.quantity * line.unitPrice).toFixed(2)}
                          </p>

                          {/* Assigned participants */}
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
                            title="Edit discount"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLineItem(line);
                            }}
                            className="p-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                            title="Delete discount"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </Card>
          )}

          {currentView === 'misc-charges' && (
            // Misc charges review view
            <Card padding="lg" className="mb-6">
              <h2 className="text-2xl font-bold mb-4">Review Misc Charges</h2>
              <p className="text-sm mb-6">
                Review tax, tip, and service charges. Add or edit as needed.
              </p>

              <div className="space-y-4">
              {/* Add New Item Button */}
              <button
                onClick={handleOpenCreateModal}
                className="w-full border-4 border-dashed border-gray-400 bg-gray-50 p-4 hover:border-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">+</span>
                  <span className="font-bold uppercase tracking-wider">Add Item</span>
                </div>
              </button>

              {miscChargeLines.map((line) => (
                <div key={line.id} className="relative p-4 border-4 border-black bg-white">
                  {/* Delete button - top right corner */}
                  <button
                    onClick={() => handleDeleteLineItem(line)}
                    className="absolute top-2 right-2 p-1 hover:text-red-600"
                    title="Delete item"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex justify-between items-start pr-8">
                    <div className="flex-1">
                      <h3 className="font-bold text-xl uppercase tracking-wider mb-2">
                        {line.itemName}
                      </h3>
                      <p className="font-mono text-sm">
                        {line.quantity} × PHP{line.unitPrice.toFixed(2)} = PHP
                        {(line.quantity * line.unitPrice).toFixed(2)}
                      </p>
                      <p className="font-mono text-xs uppercase tracking-wide text-gray-500 mt-1">
                        {line.receiptLineType === 'TAX' && 'Tax'}
                        {line.receiptLineType === 'TIP' && 'Tip'}
                        {line.receiptLineType === 'SRVC' && 'Service Charge'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenEditModal(line)}
                      className="p-2 border-2 border-black hover:bg-black hover:text-white transition-colors flex-shrink-0"
                      title="Edit item"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </Card>
          )}
        </section>
      </div>

      {/* Participants - fixed at bottom with horizontal scroll (show in items and discounts views) */}
      {(currentView === 'items' || currentView === 'discounts') && (
        <div className="border-t-4 border-black bg-white">
          {/* Status indicators */}
          {(activeLineId || activeParticipantId) && (
            <div className="px-4 pt-3 pb-2 border-b-2 border-gray-300 max-w-5xl mx-auto">
              <div className="flex flex-wrap gap-4 text-sm font-mono">
                {activeLineId && (
                  <span>
                    Assigning to:{' '}
                    <strong>
                      {lines.find((line) => line.id === activeLineId)?.itemName ||
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
            <div className="p-3">
              {participants.length === 0 ? (
                <div className="text-center font-mono text-gray-500 text-sm">
                  No participants yet. Add them first to start assigning.
                </div>
              ) : (
                <div className="flex gap-3 pb-1">
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
                          border-4 px-3 py-2 flex flex-col gap-0.5
                          uppercase tracking-wider text-left min-w-[100px]
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
                        <span className="font-bold text-sm">{participant.displayName}</span>
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
                {saving
                  ? 'Continuing...'
                  : currentView === 'items'
                    ? 'Continue to Discounts'
                    : 'Continue to Misc Charges'}
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
                receiptLineType: editingLine.receiptLineType,
              }
            : undefined
        }
        hasAssignments={editingLine ? hasAssignments(editingLine.id) : false}
        showLineTypeSelector={currentView === 'misc-charges' || currentView === 'discounts'}
        onSave={handleSaveLineItem}
        onCancel={handleCancelLineItemModal}
      />

      {/* Receipt Image Modal */}
      {showReceiptImage && receiptImageURI && (
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
                src={receiptImageURI}
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
