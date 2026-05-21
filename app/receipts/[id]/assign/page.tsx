'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Pencil, Plus, Trash2, ArrowLeft, ArrowRight, MoreVertical, Eye, HelpCircle, Users } from 'lucide-react';
import LoadingScreen from '@/components/LoadingScreen';
import { LineItemModal } from '@/components/LineItemModal';
import { ParticipantAssignModal } from '@/components/ParticipantAssignModal';
import { KebabMenu } from '@/components/KebabMenu';
import { ShareCodeBadge } from '@/components/ShareCodeBadge';
import { api } from '@/lib/client/api-client';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

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
  const [receiptTitle, setReceiptTitle] = useState<string>('');
  const [receiptShareCode, setReceiptShareCode] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<ReceiptLine | null>(null);
  const [pendingLineEdit, setPendingLineEdit] = useState<{
    data: { itemName: string; quantity: number; unitPrice: number; receiptLineType?: string };
    line: ReceiptLine;
  } | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [assignModalLine, setAssignModalLine] = useState<ReceiptLine | null>(null);
  const [openKebabId, setOpenKebabId] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('mahal_assign_help_seen')) {
      const t = setTimeout(() => setShowHelpModal(true), 1000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismissHelpModal = () => {
    localStorage.setItem('mahal_assign_help_seen', '1');
    setShowHelpModal(false);
  };

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
        setReceiptTitle(splitGroup.receipt.title || '');
        setReceiptShareCode(splitGroup.receipt.shareCode || null);
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
  const discountLines = allLines.filter(
    (line) => line.receiptLineType === 'DSCT' || (line.receiptLineType === 'DADJ' && line.unitPrice < 0)
  );
  const miscChargeLines = allLines.filter(
    (line) => line.receiptLineType !== 'PRCH' && line.receiptLineType !== 'DSCT' && !(line.receiptLineType === 'DADJ' && line.unitPrice < 0)
  );
  const lines = currentView === 'items' ? purchaseLines : currentView === 'discounts' ? discountLines : miscChargeLines;

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getPurchaseSubtotal = () =>
    purchaseLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  const handleSetShares = (lineId: number, participantId: number, quantity: number) => {
    setAssignments(prev => {
      const nextLineAssignments = { ...(prev[lineId] || {}) };
      if (quantity === 0) {
        delete nextLineAssignments[participantId];
      } else {
        nextLineAssignments[participantId] = quantity;
      }
      return { ...prev, [lineId]: nextLineAssignments };
    });

    if (unassignedLineIds.has(lineId) && quantity > 0) {
      setUnassignedLineIds(prev => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }
  };

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
        const assignmentsList = Object.entries(assignments).flatMap(([lineId, lineParticipants]) => {
          const lineIdNum = +lineId;
          if (!purchaseLinesMap.has(lineIdNum)) {
            return [];
          }
          return Object.entries(lineParticipants).map(([participantId, shareQuantity]) => ({
            receiptLineId: lineIdNum,
            participantId: Number(participantId),
            shareQuantity: shareQuantity as number,
          }));
        });

        await api.assignments.batchAssign(receiptId, assignmentsList);
        setActiveLineId(null);
        setActiveParticipantId(null);
        setCurrentView('misc-charges');
        setSaving(false);
      } catch (err: any) {
        setError(err.message || 'Unable to save assignments');
        setSaving(false);
      }
    } else if (currentView === 'misc-charges') {
      setActiveLineId(null);
      setActiveParticipantId(null);
      setCurrentView('discounts');
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
    { num: '01', label: 'Receipt Items', view: 'items' as const },
    { num: '02', label: 'Misc', view: 'misc-charges' as const },
    { num: '03', label: 'Discount', view: 'discounts' as const },
    { num: '04', label: 'Finalize', view: null },
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
        if (
          editingLine.receiptLineType === 'PRCH' &&
          (data.quantity !== editingLine.quantity || data.unitPrice !== editingLine.unitPrice) &&
          hasAssignments(editingLine.id)
        ) {
          setPendingLineEdit({ data, line: editingLine });
          setShowLineItemModal(false);
          setEditingLine(null);
          return;
        }

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
      } else {
        const receiptLineType = data.receiptLineType || (currentView === 'items' ? 'PRCH' : currentView === 'discounts' ? 'DSCT' : 'SRVC');
        const newLine = await api.lines.create(receiptId, {
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          receiptLineType,
          linePosition: allLines.length,
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

  const confirmLineEdit = async () => {
    if (!pendingLineEdit) return;
    const { data, line } = pendingLineEdit;
    setPendingLineEdit(null);
    try {
      const updateData: any = {
        itemName: data.itemName,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
      };
      if (data.receiptLineType) updateData.receiptLineType = data.receiptLineType;

      await api.lines.update(receiptId, line.id, updateData);
      setAllLines((prev) =>
        prev.map((l) =>
          l.id === line.id
            ? { ...l, ...data, receiptLineType: data.receiptLineType || l.receiptLineType }
            : l
        )
      );
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[line.id];
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    }
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

  const handleTitleBlur = async () => {
    try {
      await api.receipts.updateTitle(receiptId, receiptTitle.trim() || null);
    } catch {
      // non-critical, silently ignore
    }
  };

  const handleSplitEqually = () => {
    setAssignments((prev) => {
      const next = { ...prev };
      purchaseLines.forEach((line) => {
        next[line.id] = {};
        participants.forEach((p) => { next[line.id][p.id] = 1; });
      });
      return next;
    });
    setUnassignedLineIds(new Set());
    setError(null);
  };

  if (loading) return <LoadingScreen message="Loading receipt..." />;

  const continueLabel = saving
    ? 'Saving...'
    : currentView === 'items'
      ? 'Misc Charges'
      : currentView === 'misc-charges'
        ? 'Discounts'
        : 'Summary';

  return (
    <div className={`min-h-dvh flex flex-col bg-[#fff9ef] text-[#1b1b1b] font-['Work_Sans'] ${currentView === 'misc-charges' ? 'pb-[120px]' : 'pb-[200px]'}`}>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-black w-full">
        {/* Row 1: nav */}
        <div className="px-5 h-14 flex items-center justify-between">
          <button
            onClick={() => {
              if (currentView === 'misc-charges') setCurrentView('items');
              else if (currentView === 'discounts') setCurrentView('misc-charges');
              else router.push(`/receipts/${receiptId}/participants`);
            }}
            className="p-1.5 border-2 border-black rounded bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-dm-sans font-black text-sm uppercase tracking-tight text-[#7e7576]">
            {currentView === 'items' ? 'Assign Items' : currentView === 'discounts' ? 'Assign Discounts' : 'Misc Charges'}
          </span>
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
                <KebabMenu
                  className="z-50 w-44"
                  items={[
                    { label: 'How to Use', icon: <HelpCircle className="w-4 h-4 flex-shrink-0" />, onClick: () => { setShowHelpModal(true); setShowKebabMenu(false); } },
                    ...(receiptImageURI ? [{ label: 'View Receipt', icon: <Eye className="w-4 h-4 flex-shrink-0" />, onClick: () => { setShowReceiptImage(true); setShowKebabMenu(false); } }] : []),
                  ]}
                />
              </>
            )}
          </div>
        </div>

        {/* Row 2: editable receipt title + share code */}
        <div className="px-5 pb-3 flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-hidden">
              <input
                ref={titleInputRef}
                type="text"
                value={receiptTitle}
                onChange={(e) => setReceiptTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => e.key === 'Enter' && titleInputRef.current?.blur()}
                placeholder="Untitled receipt"
                maxLength={100}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
                className="bg-transparent border-none p-0 font-dm-sans font-black text-xl tracking-tight uppercase focus:outline-none min-w-[4ch] max-w-[calc(100vw-12rem)] placeholder:text-[#cfc4c5]"
              />
              <button
                type="button"
                onClick={() => titleInputRef.current?.focus()}
                className="p-1 border-2 border-transparent hover:border-black hover:bg-[#f3f3f3] transition-colors flex items-center justify-center flex-shrink-0"
              >
                <Pencil className="w-3.5 h-3.5 text-[#7e7576]" />
              </button>
            </div>
            {receiptShareCode && <ShareCodeBadge shareCode={receiptShareCode} title={receiptTitle || 'Receipt'} />}
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
            {purchaseLines.length === 0 ? (
              <p className="text-center font-bold py-4 font-dm-sans text-sm">No items yet — add one below.</p>
            ) : participants.length > 0 && (
              <p className="font-dm-mono text-xs text-[#4c4546] px-1">Tap any item to choose who shared it, or select a person below first.</p>
            )}

            {purchaseLines.map((line) => {
              const assignedParticipants = getAssignedParticipants(line.id);
              const isAssignmentMode = activeParticipantId !== null;
              const isAssignedToSelectedParticipant = activeParticipantId && assignments[line.id]?.[activeParticipantId];
              const isUnassigned = unassignedLineIds.has(line.id);

              return (
                <div
                  key={line.id}
                  onClick={() => activeParticipantId ? handleLineSelection(line.id) : setAssignModalLine(line)}
                  className={`bg-white border-4 border-black p-[10px_14px] rounded-lg flex flex-col gap-1 cursor-pointer transition-all shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000] ${
                    isUnassigned ? 'border-orange-500 bg-orange-50' :
                    isAssignedToSelectedParticipant ? 'border-green-500 bg-green-50' :
                    isAssignmentMode ? 'hover:bg-purple-50 hover:border-purple-400' :
                    'hover:bg-[#f9f9f0] hover:border-[#ccb800]'
                  }`}
                >
                  {/* Row 1: name (left) + total (right) */}
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-dm-sans font-bold text-[14px] uppercase leading-tight flex-1">{line.itemName}</h2>
                    <span className="font-dm-mono font-bold text-[12px] tabular-nums flex-shrink-0">{formatCurrency(line.quantity * line.unitPrice)}</span>
                  </div>

                  {/* Row 2: unit price (left) + participant circles (right) */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-dm-mono text-[10px] text-[#7e7576]">
                      {line.quantity} × {formatCurrency(line.unitPrice)}
                    </span>
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

            {/* Add Item + Split Equally row */}
            <div className="flex gap-2">
              <button
                onClick={handleOpenCreateModal}
                className="flex-1 bg-white border-4 border-black border-dashed p-3 rounded-lg flex items-center justify-center gap-3 hover:bg-[#f3f3f3] transition-colors group"
              >
                <div className="p-1 bg-black text-white rounded-full group-hover:scale-110 transition-transform flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="font-dm-sans font-bold uppercase text-sm">ADD ITEM</span>
              </button>
              {purchaseLines.length > 0 && participants.length > 0 && (
                <button
                  onClick={handleSplitEqually}
                  className="bg-[#cee7f0] border-4 border-black p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#b8dcea] transition-colors shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <Users className="w-4 h-4" />
                  <span className="font-dm-sans font-bold uppercase text-sm whitespace-nowrap">Split All</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Discounts view */}
        {currentView === 'discounts' && (
          <>
            <p className="font-dm-mono text-xs text-[#4c4546] px-1">Unassigned discounts are applied to all participants.</p>

            {discountLines.map((line) => {
              const assignedParticipants = getAssignedParticipants(line.id);

              return (
                <div
                  key={line.id}
                  onClick={() => setAssignModalLine(line)}
                  className="bg-white border-4 border-black p-[10px_14px] rounded-lg flex flex-col gap-1 cursor-pointer transition-all shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000] hover:bg-[#f3f3f3] hover:border-[#ccb800]"
                >
                  {/* Row 1: name (left) + total (right) + kebab */}
                  <div className="flex items-center gap-2">
                    <h2 className="font-dm-sans font-bold text-[14px] uppercase leading-tight flex-1 text-green-700">{line.itemName}</h2>
                    <span className="font-dm-mono font-bold text-[12px] tabular-nums text-green-700 flex-shrink-0">{formatCurrency(line.quantity * line.unitPrice)}</span>
                    <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenKebabId(openKebabId === line.id ? null : line.id)}
                        className="p-2 border-2 border-black bg-white rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openKebabId === line.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenKebabId(null)} />
                          <KebabMenu
                            className="z-20 w-32"
                            items={[
                              { label: 'Edit', icon: <Pencil className="w-3.5 h-3.5 flex-shrink-0" />, onClick: () => { handleOpenEditModal(line); setOpenKebabId(null); } },
                              { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />, onClick: () => { handleDeleteLineItem(line); setOpenKebabId(null); }, variant: 'destructive' as const },
                            ]}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Row 2: participant circles (or proportional) */}
                  <div className="flex justify-end">
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

            <button
              onClick={handleOpenCreateModal}
              className="w-full bg-white border-4 border-black border-dashed p-3 rounded-lg flex items-center justify-center gap-3 hover:bg-[#f3f3f3] transition-colors group"
            >
              <div className="p-1 bg-black text-white rounded-full group-hover:scale-110 transition-transform flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-dm-sans font-bold uppercase text-sm">ADD DISCOUNT</span>
            </button>
          </>
        )}

        {/* Misc charges view */}
        {currentView === 'misc-charges' && (
          <>
            <p className="font-dm-mono text-xs text-[#4c4546] px-1">Review tax, tip, and service charges.</p>

            {miscChargeLines.map((line) => (
              <div key={line.id} className="bg-white border-2 border-[#c5bdb7] p-[10px_14px] rounded-lg flex flex-col gap-1">
                {/* Row 1: name (left) + total (right) + kebab */}
                <div className="flex items-center gap-2">
                  <h2 className="font-dm-sans font-bold text-[14px] uppercase leading-tight flex-1">{line.itemName}</h2>
                  <span className="font-dm-mono font-bold text-[12px] tabular-nums flex-shrink-0">{formatCurrency(line.quantity * line.unitPrice)}</span>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setOpenKebabId(openKebabId === line.id ? null : line.id)}
                      className="p-2 border-2 border-black bg-white rounded shadow-[1px_1px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openKebabId === line.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenKebabId(null)} />
                        <KebabMenu
                          className="z-20 w-32"
                          items={[
                            { label: 'Edit', icon: <Pencil className="w-3.5 h-3.5 flex-shrink-0" />, onClick: () => { handleOpenEditModal(line); setOpenKebabId(null); } },
                            { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />, onClick: () => { handleDeleteLineItem(line); setOpenKebabId(null); }, variant: 'destructive' as const },
                          ]}
                        />
                      </>
                    )}
                  </div>
                </div>
                {/* Row 2: unit price breakdown */}
                <span className="font-dm-mono text-[10px] text-[#7e7576]">
                  {line.quantity} × {formatCurrency(line.unitPrice)}
                </span>
              </div>
            ))}

            <button
              onClick={handleOpenCreateModal}
              className="w-full bg-white border-4 border-black border-dashed p-3 rounded-lg flex items-center justify-center gap-3 hover:bg-[#f3f3f3] transition-colors group"
            >
              <div className="p-1 bg-black text-white rounded-full group-hover:scale-110 transition-transform flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-dm-sans font-bold uppercase text-sm">ADD CHARGE</span>
            </button>
          </>
        )}
      </main>

      {/* Fixed bottom nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex flex-col bg-white border-t-4 border-black pb-[env(safe-area-inset-bottom)]">

        {/* Participant chips row — items + discounts views only */}
        {(currentView === 'items' || currentView === 'discounts') && (
          <div className="flex items-center gap-4 overflow-x-auto px-4 py-3 border-b-4 border-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {participants.length === 0 ? (
              <span className="font-dm-mono text-xs text-[#7e7576]">No participants yet.</span>
            ) : participants.map((participant, i) => {
              const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];
              const isActive = activeParticipantId === participant.id;
              const isAlreadyAssigned = activeLineId && assignments[activeLineId]?.[participant.id];
              const assignCount = getParticipantAssignmentCount(participant.id);
              const participantTotal = getParticipantTotal(participant.id);

              return (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => handleParticipantSelection(participant.id)}
                  className={`flex flex-col items-center gap-0.5 min-w-[44px] flex-shrink-0 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-55 hover:opacity-80'
                  } ${isAlreadyAssigned ? '!opacity-100' : ''}`}
                >
                  <div
                    className={`relative w-9 h-9 rounded-full border-2 border-black flex items-center justify-center font-dm-sans text-xs font-bold shadow-[2px_2px_0px_0px_#000] transition-all ${
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
                  <span className="font-dm-mono text-[10px] uppercase font-bold text-[#1b1b1b]">
                    {participant.displayName.split(' ')[0]}
                  </span>
                  {participantTotal > 0 && (
                    <span className="font-dm-mono text-[9px] font-bold text-[#4c4546]">
                      {formatCurrency(participantTotal)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Action row: subtotal + continue */}
        <div className="flex items-stretch h-12">
          {/* Subtotal */}
          <div className="flex flex-col items-center justify-center w-1/3 border-r-4 border-black px-3 gap-0">
            <span className="font-dm-mono text-[7px] uppercase font-bold text-[#7e7576] tracking-wider">Subtotal</span>
            <span className="font-dm-sans font-bold text-xs leading-tight">
              {formatCurrency(getPurchaseSubtotal())}
            </span>
          </div>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            disabled={saving}
            className="flex-1 bg-[#FFD700] text-black border-l-0 flex items-center justify-center gap-2 font-dm-sans font-bold uppercase text-xs tracking-wide shadow-none hover:bg-[#FFE44D] active:bg-[#e6c200] transition-colors disabled:opacity-50"
          >
            {continueLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Participant Assignment Modal (item-first flow) */}
      <ParticipantAssignModal
        isOpen={assignModalLine !== null}
        line={assignModalLine}
        participants={participants}
        lineAssignments={assignModalLine ? (assignments[assignModalLine.id] || {}) : {}}
        onToggle={(participantId) => { if (assignModalLine) { toggleAssignment(assignModalLine.id, participantId); } }}
        onSetShares={(participantId, shares) => { if (assignModalLine) { handleSetShares(assignModalLine.id, participantId, shares); } }}
        equalSplitOnly={assignModalLine?.receiptLineType === 'DSCT'}
        onAssignAll={() => {
          if (!assignModalLine) return;
          setAssignments(prev => ({
            ...prev,
            [assignModalLine.id]: Object.fromEntries(participants.map(p => [p.id, 1])),
          }));
          setUnassignedLineIds(prev => { const next = new Set(prev); next.delete(assignModalLine.id); return next; });
          setError(null);
        }}
        onClear={() => {
          if (!assignModalLine) return;
          setAssignments(prev => ({ ...prev, [assignModalLine.id]: {} }));
        }}
        onClose={() => setAssignModalLine(null)}
        onEdit={() => {
          const line = assignModalLine;
          setAssignModalLine(null);
          if (line) handleOpenEditModal(line);
        }}
        onDelete={() => {
          const line = assignModalLine;
          setAssignModalLine(null);
          if (line) handleDeleteLineItem(line);
        }}
        participantColors={PARTICIPANT_COLORS}
        getInitials={getInitials}
      />

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
        showLineTypeSelector={currentView === 'misc-charges'}
        lineType={currentView === 'discounts' ? 'DSCT' : undefined}
        onSave={handleSaveLineItem}
        onCancel={handleCancelLineItemModal}
      />

      {/* Clear Assignments Confirmation Modal */}
      {pendingLineEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setPendingLineEdit(null)}
        >
          <div
            className="bg-white border-[4px] border-black shadow-[6px_6px_0px_0px_#000] rounded-lg p-4 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-dm-sans font-bold text-xl uppercase text-center border-b-2 border-black pb-2">
                Clear Assignments?
              </h2>
              <div className="text-center py-2">
                <p className="font-dm-sans text-base text-[#4d4732]">"{pendingLineEdit.line.itemName}"</p>
                <p className="font-dm-mono text-[10px] uppercase tracking-wide text-[#7e7576] mt-1">
                  Changing the price or quantity will remove everyone assigned to this item.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingLineEdit(null)}
                className="flex-1 py-2 px-3 bg-white border-2 border-black font-dm-mono font-bold text-sm uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmLineEdit}
                className="flex-1 py-2 px-3 bg-black text-white border-2 border-black font-dm-mono font-bold text-sm uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Update Item
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p className="font-dm-sans text-base text-[#4d4732]">"{deleteConfirmLine.itemName}"</p>
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

      {/* Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={dismissHelpModal}
        >
          <div className="w-full max-w-sm flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* White card */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] overflow-hidden">
              {/* Modal header */}
              <div className="bg-[#FFD700] border-b-4 border-black px-4 py-2 flex justify-between items-center">
                <h2 className="font-dm-sans font-black text-xl uppercase tracking-tight">How to use</h2>
                <button
                  onClick={dismissHelpModal}
                  className="p-1 border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-4 flex flex-col gap-4">

                {/* Method 1: Item → People */}
                <div className="border-2 border-black p-4 bg-stone-50 flex flex-col items-center gap-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="bg-yellow-50 border-4 border-[#FFD700] shadow-[4px_4px_0px_0px_#000] p-3 w-40 -rotate-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-dm-mono text-[10px] font-bold uppercase">Halo-halo</span>
                          <span className="font-dm-mono text-[10px]">PHP 200</span>
                        </div>
                        <div className="h-1.5 w-full bg-stone-200" />
                      </div>
                      <span className="absolute -bottom-3 -right-2 z-20 w-6 h-6 bg-black text-white flex items-center justify-center font-dm-sans font-black text-xs">1</span>
                    </div>
                    <span className="font-dm-mono text-xs">↓</span>
                    <div className="relative flex gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#cee7f0] border-2 border-black flex items-center justify-center font-dm-sans text-[10px] font-bold">JD</div>
                      <div className="w-9 h-9 rounded-full bg-[#FFD700] border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center font-dm-sans text-[10px] font-bold">MK</div>
                      <div className="w-9 h-9 rounded-full bg-[#ffd9de] border-2 border-black flex items-center justify-center font-dm-sans text-[10px] font-bold">AL</div>
                      <span className="absolute -bottom-3 right-0 z-20 w-6 h-6 bg-black text-white flex items-center justify-center font-dm-sans font-black text-xs">2</span>
                    </div>
                  </div>
                  <p className="font-dm-sans font-bold text-sm text-center">
                    Tap an <span className="bg-[#FFD700] px-1">item</span> — a picker opens so you choose which friends shared it.
                  </p>
                </div>

                {/* OR divider — no box, just spacing */}
                <div className="relative flex items-center justify-center py-1">
                  <div className="w-full border-t-2 border-black" />
                  <span className="absolute bg-white px-3 font-dm-sans font-black text-sm uppercase">OR</span>
                </div>

                {/* Method 2: Person → Items */}
                <div className="border-2 border-black p-4 bg-stone-50 flex flex-col items-center gap-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-[#FFD700] border-4 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center font-dm-sans font-black text-base rotate-3">MK</div>
                      <span className="absolute -bottom-2 -right-3 z-20 w-6 h-6 bg-black text-white flex items-center justify-center font-dm-sans font-black text-xs">1</span>
                    </div>
                    <span className="font-dm-mono text-xs">↓</span>
                    <div className="relative flex flex-col items-center gap-2">
                      <div className="bg-yellow-50 border-2 border-[#FFD700] p-2 w-32"><div className="h-1.5 w-full bg-stone-200" /></div>
                      <div className="bg-white border-2 border-black p-2 w-32"><div className="h-1.5 w-full bg-stone-200" /></div>
                      <span className="absolute -bottom-4 -right-4 z-20 w-6 h-6 bg-black text-white flex items-center justify-center font-dm-sans font-black text-xs">2</span>
                    </div>
                  </div>
                  <p className="font-dm-sans font-bold text-sm text-center">
                    Select a <span className="bg-[#FFD700] px-1">friend</span> then tap the <span className="underline">items</span> they had.
                  </p>
                </div>
              </div>
            </div>

            {/* Dismiss — outside the white box */}
            <button
              onClick={dismissHelpModal}
              className="mt-3 w-full bg-[#FFD700] border-4 border-black shadow-[4px_4px_0px_0px_#000] font-dm-sans font-black text-lg uppercase tracking-widest py-2.5 hover:bg-[#FFE44D] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
            >
              GOT IT!
            </button>
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
