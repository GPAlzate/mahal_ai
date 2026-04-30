'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { X, Pencil, Plus, Trash2, ArrowLeft, ArrowRight, MoreVertical, Eye } from 'lucide-react';
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
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<ReceiptLine | null>(null);

  useEffect(() => {
    async function fetchSplitGroup() {
      try {
        const splitGroup = await api.splitGroups.get(receiptId);

        if (splitGroup.receipt.status === 'FLZD') {
          setLoading(false);
          router.push(`/${splitGroup.receipt.shareCode}`);
          return;
        }

        const lines = splitGroup.receipt.lines || [];
        setAllLines(lines);
        setParticipants(splitGroup.participants);
        setReceiptImageURI(splitGroup.receipt.imageURI || null);

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

  const purchaseLines = allLines.filter((line) => line.receiptLineType === 'PRCH');
  const discountLines = allLines.filter((line) => line.receiptLineType === 'DSCT');
  const miscChargeLines = allLines.filter((line) => line.receiptLineType !== 'PRCH' && line.receiptLineType !== 'DSCT');
  const lines = currentView === 'items' ? purchaseLines : currentView === 'discounts' ? discountLines : miscChargeLines;

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getPurchaseSubtotal = () =>
    purchaseLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

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
      return { ...prev, [lineId]: nextLineAssignments };
    });

    if (unassignedLineIds.has(lineId)) {
      setUnassignedLineIds((prev) => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }

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
    if (activeParticipantId) {
      toggleAssignment(lineId, activeParticipantId);
      setActiveLineId(null);
    } else {
      setActiveLineId((prev) => (prev === lineId ? null : lineId));
    }
  };

  const handleParticipantSelection = (participantId: number) => {
    setError(null);
    if (activeLineId) {
      toggleAssignment(activeLineId, participantId);
      setActiveParticipantId(null);
    } else {
      setActiveParticipantId((prev) => (prev === participantId ? null : participantId));
    }
  };

  const handleContinue = async () => {
    if (currentView === 'items') {
      const unassignedLines = purchaseLines.filter(
        (line) => !assignments[line.id] || Object.keys(assignments[line.id]).length === 0
      );

      if (unassignedLines.length > 0) {
        setUnassignedLineIds(new Set(unassignedLines.map((line) => line.id)));
        setError('Please assign the highlighted items to at least one participant.');
        return;
      }

      try {
        setSaving(true);
        setError(null);
        setUnassignedLineIds(new Set());

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

        await api.assignments.batchAssign(receiptId, assignmentsList);
        setActiveLineId(null);
        setActiveParticipantId(null);
        if (miscChargeLines.length > 0) {
          setCurrentView('misc-charges');
        } else if (discountLines.length > 0) {
          setCurrentView('discounts');
        } else {
          router.push(`/receipts/${receiptId}/summary`);
        }
        setSaving(false);
      } catch (err: any) {
        setError(err.message || 'Unable to save assignments');
        setSaving(false);
      }
    } else if (currentView === 'misc-charges') {
      setActiveLineId(null);
      setActiveParticipantId(null);
      if (discountLines.length > 0) {
        setCurrentView('discounts');
      } else {
        router.push(`/receipts/${receiptId}/summary`);
      }
    } else if (currentView === 'discounts') {
      try {
        setSaving(true);
        setError(null);

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

        if (discountAssignmentsList.length > 0) {
          await api.assignments.batchAssign(receiptId, discountAssignmentsList);
        }

        setActiveLineId(null);
        setActiveParticipantId(null);
        router.push(`/receipts/${receiptId}/summary`);
      } catch (err: any) {
        setError(err.message || 'Unable to save assignments');
        setSaving(false);
      }
    }
  };

  const getAssignedParticipants = (lineId: number) => {
    const lineAssignments = assignments[lineId] || {};
    return participants.filter((p: Participant) => lineAssignments[p.id]);
  };

  const getParticipantAssignmentCount = (participantId: number) => {
    return lines.reduce((count, line) => {
      return count + (assignments[line.id]?.[participantId] ? 1 : 0);
    }, 0);
  };

  const hasAssignments = (lineId: number) => {
    return assignments[lineId] && Object.keys(assignments[lineId]).length > 0;
  };

  const getParticipantTotal = (participantId: number) => {
    return purchaseLines.reduce((total, line) => {
      if (assignments[line.id]?.[participantId]) {
        const splitCount = Object.keys(assignments[line.id]).length;
        return total + (line.quantity * line.unitPrice) / splitCount;
      }
      return total;
    }, 0);
  };

  const stepLabels = [
    { num: '01', label: 'Assign', view: 'items' as const },
    { num: '02', label: 'Misc', view: 'misc-charges' as const },
    { num: '03', label: 'Discount', view: 'discounts' as const },
    { num: '04', label: 'Summary', view: null },
  ];

  const PARTICIPANT_COLORS = ['#ffd9de', '#cee7f0', '#ffe16d', '#b5ead7', '#e2d1f9', '#fce1a4', '#b8e0ff'];
  const currentStepIndex = stepLabels.findIndex(s => s.view === currentView);

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
        const updateData: any = {
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
        };
        if (data.receiptLineType) updateData.receiptLineType = data.receiptLineType;

        await api.lines.update(receiptId, editingLine.id, updateData);
        setAllLines((prev) =>
          prev.map((line) =>
            line.id === editingLine.id
              ? { ...line, ...data, receiptLineType: data.receiptLineType || line.receiptLineType }
              : line
          )
        );

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
        const receiptLineType = data.receiptLineType || (currentView === 'items' ? 'PRCH' : 'SRVC');
        const newLine = await api.lines.create(receiptId, {
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          receiptLineType,
        });
        setAllLines((prev) => [...prev, newLine]);
      }
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

  const handleDeleteLineItem = (line: ReceiptLine) => {
    setDeleteConfirmLine(line);
  };

  const confirmDeleteLineItem = async () => {
    if (!deleteConfirmLine) return;
    const line = deleteConfirmLine;
    setDeleteConfirmLine(null);
    try {
      await api.lines.delete(receiptId, line.id);
      setAllLines((prev) => prev.filter((l) => l.id !== line.id));
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

  const continueLabel = saving
    ? 'Saving...'
    : currentView === 'items'
      ? miscChargeLines.length > 0 ? 'Misc Charges' : discountLines.length > 0 ? 'Discounts' : 'Summary'
      : currentView === 'misc-charges'
        ? discountLines.length > 0 ? 'Discounts' : 'Summary'
        : 'Summary';

  return (
    <div className="min-h-dvh flex flex-col bg-[#f9f9f9] text-[#1b1b1b] font-['Work_Sans'] pb-[140px]">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-black w-full">
        <div className="px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (currentView === 'misc-charges') setCurrentView('items');
                else if (currentView === 'discounts') setCurrentView(miscChargeLines.length > 0 ? 'misc-charges' : 'items');
                else router.push(`/receipts/${receiptId}/participants`);
              }}
              className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-dm-sans font-black text-xl tracking-tight uppercase">
              {currentView === 'items' ? 'Assign Items' : currentView === 'discounts' ? 'Assign Discounts' : 'Misc Charges'}
            </h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowKebabMenu(v => !v)}
              className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showKebabMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowKebabMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] w-44 flex flex-col">
                  {receiptImageURI && (
                    <button
                      onClick={() => { setShowReceiptImage(true); setShowKebabMenu(false); }}
                      className="flex items-center gap-2 px-4 py-3 border-b-2 border-black font-dm-mono text-[11px] font-bold uppercase tracking-wide hover:bg-[#FFD700] transition-colors text-left"
                    >
                      <Eye className="w-4 h-4 flex-shrink-0" />
                      View Receipt
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="px-5 pb-2.5 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stepLabels.map((step, i) => {
            const isActive = step.view === currentView;
            const isPast = i < currentStepIndex;
            return (
              <React.Fragment key={step.num}>
                <div className="flex items-center gap-1 font-dm-mono text-[11px] font-bold whitespace-nowrap">
                  <span className={`px-1 ${isActive ? 'bg-black text-white' : isPast ? 'bg-[#e2e2e2] text-[#1b1b1b]' : 'text-[#7e7576]'}`}>
                    {step.num}
                  </span>
                  <span className={`uppercase ${isActive ? 'underline decoration-[#FFD700] decoration-[3px] underline-offset-4' : isPast ? '' : 'opacity-40'}`}>
                    {step.label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <span className={`text-[10px] ${isPast ? 'text-black' : 'text-black/20'}`}>›</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div className="px-4 pt-3 max-w-2xl mx-auto w-full">
          <div className="border-4 border-red-600 bg-red-50 p-3">
            <p className="font-bold uppercase tracking-wider text-red-600 font-dm-mono text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-4 pt-3 pb-2 flex flex-col gap-2 max-w-2xl mx-auto w-full">

        {/* Items view */}
        {currentView === 'items' && (
          <>
            {purchaseLines.length === 0 && (
              <p className="text-center font-bold py-4 font-dm-sans text-sm">No items yet — add one below.</p>
            )}

            {/* Add Item Button */}
            <button
              onClick={handleOpenCreateModal}
              className="w-full bg-white border-4 border-black border-dashed p-3 rounded-lg flex items-center justify-center gap-3 hover:bg-[#f3f3f3] transition-colors group"
            >
              <div className="p-1 bg-black text-white rounded-full group-hover:scale-110 transition-transform flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-dm-sans font-bold uppercase text-sm">ADD ITEM</span>
            </button>

            {purchaseLines.map((line) => {
              const assignedParticipants = getAssignedParticipants(line.id);
              const isSelected = activeLineId === line.id;
              const isAssignmentMode = activeParticipantId !== null;
              const isAssignedToSelectedParticipant = activeParticipantId && assignments[line.id]?.[activeParticipantId];
              const isUnassigned = unassignedLineIds.has(line.id);

              return (
                <div
                  key={line.id}
                  onClick={() => handleLineSelection(line.id)}
                  className={`bg-white border-4 border-black p-[12px_16px] rounded-lg flex flex-col gap-2 cursor-pointer transition-all shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000] ${
                    isUnassigned ? 'border-orange-500 bg-orange-50' :
                    isSelected ? 'border-[#FFD700] bg-yellow-50' :
                    isAssignedToSelectedParticipant ? 'border-green-500 bg-green-50' :
                    isAssignmentMode ? 'hover:bg-purple-50 hover:border-purple-400' : 'hover:bg-[#f9f9f9]'
                  }`}
                >
                  {/* Row 1: name + edit/delete */}
                  <div className="flex items-center gap-2">
                    <h2 className="font-dm-sans font-bold text-[16px] uppercase leading-tight flex-1 truncate">{line.itemName}</h2>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(line); }}
                      className="p-1 border-2 border-black bg-white rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex-shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteLineItem(line); }}
                      className="p-1 border-2 border-black bg-[#ffdad6] text-[#93000a] rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Row 2: price pill + participant circles */}
                  <div className="flex justify-between items-end">
                    <div className="bg-[#e2e2e2] border-2 border-black rounded-full px-2 py-0.5 flex items-center w-max">
                      <span className="font-dm-mono text-[10px] uppercase font-bold text-[#1b1b1b]">
                        {line.quantity} × PHP{line.unitPrice.toFixed(2)} = PHP{(line.quantity * line.unitPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex -space-x-2">
                      {assignedParticipants.length > 0 ? assignedParticipants.map((p, idx) => {
                        const colorIdx = participants.findIndex(pp => pp.id === p.id);
                        const color = PARTICIPANT_COLORS[colorIdx % PARTICIPANT_COLORS.length];
                        return (
                          <div
                            key={p.id}
                            style={{ backgroundColor: color, zIndex: assignedParticipants.length - idx }}
                            className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center font-dm-sans text-[10px] font-bold"
                          >
                            {getInitials(p.displayName)}
                          </div>
                        );
                      }) : (
                        <div className="w-7 h-7 rounded-full border-2 border-black border-dashed flex items-center justify-center">
                          <Plus className="w-3 h-3 text-[#7e7576]" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Discounts view */}
        {currentView === 'discounts' && (
          <>
            <p className="font-dm-mono text-xs text-[#4c4546] px-1">Unassigned discounts split proportionally.</p>
            {discountLines.map((line) => {
              const assignedParticipants = getAssignedParticipants(line.id);
              const isSelected = activeLineId === line.id;
              const isAssignmentMode = activeParticipantId !== null;
              const isAssignedToSelectedParticipant = activeParticipantId && assignments[line.id]?.[activeParticipantId];

              return (
                <div
                  key={line.id}
                  onClick={() => handleLineSelection(line.id)}
                  className={`bg-white border-4 border-black p-[12px_16px] rounded-lg flex flex-col gap-2 cursor-pointer transition-all shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000] ${
                    isSelected ? 'border-[#FFD700] bg-yellow-50' :
                    isAssignedToSelectedParticipant ? 'border-green-500 bg-green-50' :
                    isAssignmentMode ? 'hover:bg-purple-50 hover:border-purple-400' : 'hover:bg-[#f9f9f9]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <h2 className="font-dm-sans font-bold text-[16px] uppercase leading-tight flex-1 truncate text-green-700">{line.itemName}</h2>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(line); }}
                      className="p-1 border-2 border-black bg-white rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex-shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteLineItem(line); }}
                      className="p-1 border-2 border-black bg-[#ffdad6] text-[#93000a] rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="bg-green-100 border-2 border-green-600 rounded-full px-2 py-0.5 flex items-center w-max">
                      <span className="font-dm-mono text-[10px] uppercase font-bold text-green-700">
                        PHP{(line.quantity * line.unitPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex -space-x-2">
                      {assignedParticipants.length > 0 ? assignedParticipants.map((p, idx) => {
                        const colorIdx = participants.findIndex(pp => pp.id === p.id);
                        const color = PARTICIPANT_COLORS[colorIdx % PARTICIPANT_COLORS.length];
                        return (
                          <div
                            key={p.id}
                            style={{ backgroundColor: color, zIndex: assignedParticipants.length - idx }}
                            className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center font-dm-sans text-[10px] font-bold"
                          >
                            {getInitials(p.displayName)}
                          </div>
                        );
                      }) : (
                        <span className="font-dm-sans text-[9px] text-[#7e7576] border border-dashed border-[#cfc4c5] px-2 py-0.5 rounded-full">
                          proportional
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Misc charges view */}
        {currentView === 'misc-charges' && (
          <>
            <p className="font-dm-mono text-xs text-[#4c4546] px-1">Review tax, tip, and service charges.</p>

            <button
              onClick={handleOpenCreateModal}
              className="w-full bg-white border-4 border-black border-dashed p-3 rounded-lg flex items-center justify-center gap-3 hover:bg-[#f3f3f3] transition-colors group"
            >
              <div className="p-1 bg-black text-white rounded-full group-hover:scale-110 transition-transform flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-dm-sans font-bold uppercase text-sm">ADD ITEM</span>
            </button>

            {miscChargeLines.map((line) => (
              <div key={line.id} className="bg-white border-4 border-black p-[12px_16px] rounded-lg flex flex-col gap-2 shadow-[3px_3px_0px_0px_#000]">
                <div className="flex items-center gap-2">
                  <h2 className="font-dm-sans font-bold text-[16px] uppercase leading-tight flex-1 truncate">{line.itemName}</h2>
                  <span className="font-dm-sans text-[9px] uppercase tracking-wide text-[#7e7576] border border-[#e2e2e2] px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {line.receiptLineType === 'TAX' && 'Tax'}
                    {line.receiptLineType === 'TIP' && 'Tip'}
                    {line.receiptLineType === 'SRVC' && 'Service'}
                  </span>
                  <button
                    onClick={() => handleOpenEditModal(line)}
                    className="p-1 border-2 border-black bg-white rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex-shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteLineItem(line)}
                    className="p-1 border-2 border-black bg-[#ffdad6] text-[#93000a] rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-[#e2e2e2] border-2 border-black rounded-full px-2 py-0.5 flex items-center w-max">
                  <span className="font-dm-mono text-[10px] uppercase font-bold text-[#1b1b1b]">
                    {line.quantity} × PHP{line.unitPrice.toFixed(2)} = PHP{(line.quantity * line.unitPrice).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </main>

      {/* Fixed bottom nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex flex-col bg-white border-t-4 border-black">

        {/* Participant chips row — items + discounts views only */}
        {(currentView === 'items' || currentView === 'discounts') && (
          <div className="flex items-center gap-4 overflow-x-auto px-4 py-2 border-b-4 border-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {participants.length === 0 ? (
              <span className="font-dm-mono text-xs text-[#7e7576]">No participants yet.</span>
            ) : participants.map((participant, i) => {
              const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];
              const isActive = activeParticipantId === participant.id;
              const isAlreadyAssigned = activeLineId && assignments[activeLineId]?.[participant.id];
              const assignCount = getParticipantAssignmentCount(participant.id);

              return (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => handleParticipantSelection(participant.id)}
                  className={`flex flex-col items-center gap-0.5 min-w-[40px] flex-shrink-0 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-55 hover:opacity-80'
                  } ${isAlreadyAssigned ? '!opacity-100' : ''}`}
                >
                  <div
                    className={`relative w-7 h-7 rounded-full border-2 border-black flex items-center justify-center font-dm-sans text-[10px] font-bold shadow-[2px_2px_0px_0px_#000] transition-all ${
                      isActive ? 'ring-2 ring-black ring-offset-1' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {getInitials(participant.displayName)}
                    {assignCount > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 bg-[#FFD700] border-2 border-black rounded-full w-[18px] h-[18px] flex items-center justify-center font-dm-sans text-[9px] font-bold leading-none z-10">
                        {assignCount}
                      </div>
                    )}
                  </div>
                  <span className="font-dm-mono text-[9px] uppercase font-bold text-[#1b1b1b]">
                    {participant.displayName.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Action row: subtotal + continue */}
        <div className="flex items-stretch h-16">
          {/* Subtotal */}
          <div className="flex flex-col items-center justify-center w-1/3 border-r-4 border-black px-3 gap-0.5">
            <span className="font-dm-mono text-[8px] uppercase font-bold text-[#7e7576] tracking-wider">Subtotal</span>
            <span className="font-dm-sans font-bold text-sm leading-tight">
              PHP {getPurchaseSubtotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            disabled={saving}
            className="flex-1 bg-[#FFD700] text-black border-l-0 flex items-center justify-center gap-2 font-dm-sans font-bold uppercase text-sm tracking-wide shadow-none hover:bg-[#FFE44D] active:bg-[#e6c200] transition-colors disabled:opacity-50"
          >
            {continueLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Line Item Modal */}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmLine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setDeleteConfirmLine(null)}
        >
          <div
            className="bg-white border-[4px] border-black shadow-[6px_6px_0px_0px_#000] rounded-lg p-4 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-dm-sans font-bold text-xl uppercase text-center border-b-2 border-black pb-2">
                Delete Item?
              </h2>
              <div className="text-center py-2">
                <p className="font-['Work_Sans'] text-base text-[#4d4732]">"{deleteConfirmLine.itemName}"</p>
                <p className="font-dm-mono text-[10px] uppercase tracking-wide text-[#7e7576] mt-1">
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmLine(null)}
                className="flex-1 py-2 px-3 bg-white border-2 border-black font-dm-mono font-bold text-sm uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteLineItem}
                className="flex-1 py-2 px-3 bg-[#ba1a1a] text-white border-2 border-black font-dm-mono font-bold text-sm uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
              <img src={receiptImageURI} alt="Original receipt" className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
