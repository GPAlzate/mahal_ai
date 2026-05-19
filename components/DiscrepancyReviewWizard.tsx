'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { api } from '@/lib/client/api-client';
import { LineItemModal } from '@/components/LineItemModal';
import type { ReceiptLine } from '@/lib/schemas/receipt/public/ReceiptLine';
import { formatCurrency } from '@/lib/helpers/CurrencyHelper';

const LINE_TYPE_LABELS: Record<string, string> = {
  PRCH: 'Item',
  TAX: 'Tax',
  TIP: 'Tip',
  SRVC: 'Service',
  DSCT: 'Discount',
  DADJ: 'Adjustment',
};

interface DiscrepancyReviewWizardProps {
  isOpen: boolean;
  receiptId: number;
  imageURI: string;
  lines: ReceiptLine[];
  onClose: () => void;
  onDone: () => void;
}

export function DiscrepancyReviewWizard({
  isOpen,
  receiptId,
  imageURI,
  lines,
  onClose,
  onDone,
}: DiscrepancyReviewWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fixedIds, setFixedIds] = useState<Set<number>>(new Set());
  const [localLines, setLocalLines] = useState<ReceiptLine[]>(lines);
  const [editingLine, setEditingLine] = useState<ReceiptLine | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [done, setDone] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const imageZoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentIndex(0);
    setFixedIds(new Set());
    setLocalLines(lines);
    setEditingLine(null);
    setDone(false);
    setImageLoaded(false);
    loadedImgRef.current = null;
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load image for canvas thumbnail
  useEffect(() => {
    if (!isOpen || !imageURI) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImgRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => {
        loadedImgRef.current = fallback;
        setImageLoaded(true);
      };
      fallback.src = imageURI;
    };
    img.src = imageURI;
  }, [isOpen, imageURI]);

  // Draw thumbnail crop when step or image changes
  useEffect(() => {
    if (!imageLoaded || !loadedImgRef.current || !canvasRef.current || done) return;
    const line = localLines[currentIndex];
    const bbox = line?.lineSourceBbox;
    if (!bbox) return;

    const img = loadedImgRef.current;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const padX = bbox.w * 0.25;
    const padY = bbox.h * 0.5;

    const sx = Math.max(0, ((bbox.x - padX) / 100) * iw);
    const sy = Math.max(0, ((bbox.y - padY) / 100) * ih);
    const sw = Math.min(iw - sx, ((bbox.w + padX * 2) / 100) * iw);
    const sh = Math.min(ih - sy, ((bbox.h + padY * 2) / 100) * ih);

    const canvas = canvasRef.current;
    canvas.width = 72;
    canvas.height = 80;

    try {
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, sx, sy, sw, sh, 0, 0, 72, 80);
    } catch {
      // CORS-tainted canvas — thumbnail hidden gracefully
    }
  }, [currentIndex, imageLoaded, localLines, done]);

  // Scroll image zone to center on bbox when step changes
  useEffect(() => {
    if (!imageRef.current || !imageZoneRef.current || !imageLoaded || done) return;
    const line = localLines[currentIndex];
    const bbox = line?.lineSourceBbox;
    if (!bbox) return;

    const imgH = imageRef.current.offsetHeight;
    const zoneH = imageZoneRef.current.offsetHeight;
    const bboxCenterY = ((bbox.y + bbox.h / 2) / 100) * imgH;

    imageZoneRef.current.scrollTo({ top: Math.max(0, bboxCenterY - zoneH / 2), behavior: 'smooth' });
  }, [currentIndex, imageLoaded, done, localLines]);

  const goNext = useCallback(() => {
    if (currentIndex < localLines.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setDone(true);
    }
  }, [currentIndex, localLines.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  const dismissEditModal = useCallback(() => {
    setEditingLine(null);
    // iOS Safari scrolls the body when a keyboard opens, even inside fixed overlays.
    // After keyboard dismissal the body scroll offset stays, shifting all tap targets.
    setTimeout(() => window.scrollTo(0, 0), 150);
  }, []);

  const handleSaveEdit = useCallback(async (data: {
    itemName: string;
    quantity: number;
    unitPrice: number;
    receiptLineType?: string;
  }) => {
    if (!editingLine) return;
    await api.lines.update(receiptId, editingLine.id, data);
    setLocalLines(prev =>
      prev.map(l => {
        if (l.id !== editingLine.id) return l;
        return {
          ...l,
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          totalPrice: data.quantity * data.unitPrice,
          receiptLineType: (data.receiptLineType as ReceiptLine['receiptLineType']) ?? l.receiptLineType,
        };
      })
    );
    setFixedIds(prev => new Set([...prev, editingLine.id]));
    dismissEditModal();
    goNext();
  }, [editingLine, receiptId, goNext, dismissEditModal]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  if (!isOpen) return null;

  const currentLine = localLines[currentIndex];
  const bbox = currentLine?.lineSourceBbox;
  const fixedCount = fixedIds.size;

  if (done) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 px-6 bg-[#fff9ef]">
        <div className="w-20 h-20 bg-[#FFD700] border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
          <Check className="w-10 h-10 stroke-[3]" />
        </div>
        <div className="text-center">
          <h2 className="font-dm-sans font-black text-3xl uppercase tracking-tight">All Done!</h2>
          <p className="font-dm-mono text-sm text-[#4d4732] mt-2">
            Reviewed {localLines.length} item{localLines.length !== 1 ? 's' : ''}
            {fixedCount > 0 ? ` · Fixed ${fixedCount}` : ' · No changes made'}
          </p>
        </div>
        <button
          onClick={onDone}
          className="w-full max-w-xs h-14 border-4 border-black rounded-lg font-dm-mono font-bold text-base uppercase bg-[#FFD700] shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          Recalculate →
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex flex-col bg-[#1b1b1b]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <header className="h-14 flex-shrink-0 flex items-center gap-3 px-4 border-b-2 border-[#333]">
          <button
            onClick={onClose}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center border-2 border-[#555] rounded bg-[#2a2a2a] active:opacity-70 transition-all"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <div className="flex justify-between items-center">
              <span className="font-dm-mono text-[10px] uppercase tracking-widest text-[#888]">
                {currentIndex + 1} / {localLines.length}
              </span>
              {fixedCount > 0 && (
                <span className="font-dm-mono text-[10px] uppercase tracking-widest text-[#4ade80]">
                  {fixedCount} fixed
                </span>
              )}
            </div>
            <div className="h-1 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FFD700] transition-all duration-300 ease-out"
                style={{ width: `${((currentIndex + 1) / localLines.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="w-8 h-8 flex items-center justify-center border-2 border-[#555] rounded bg-[#2a2a2a] disabled:opacity-30 active:opacity-70 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={goNext}
              className="w-8 h-8 flex items-center justify-center border-2 border-[#555] rounded bg-[#2a2a2a] active:opacity-70 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </header>

        {/* Image Zone */}
        <div ref={imageZoneRef} className="flex-1 overflow-y-auto min-h-0">
          <div className="relative">
            <img
              ref={imageRef}
              src={imageURI}
              alt="Receipt"
              className="w-full h-auto block"
            />
            {bbox && (
              <>
                <div
                  className="absolute inset-x-0 top-0 bg-black/50 pointer-events-none"
                  style={{ height: `${bbox.y}%` }}
                />
                <div
                  className="absolute inset-x-0 bg-black/50 pointer-events-none"
                  style={{ top: `${bbox.y + bbox.h}%`, bottom: 0 }}
                />
                <div
                  className="absolute bg-black/50 pointer-events-none"
                  style={{ top: `${bbox.y}%`, height: `${bbox.h}%`, left: 0, width: `${bbox.x}%` }}
                />
                <div
                  className="absolute bg-black/50 pointer-events-none"
                  style={{ top: `${bbox.y}%`, height: `${bbox.h}%`, left: `${bbox.x + bbox.w}%`, right: 0 }}
                />
                <div
                  className="absolute border border-[#FFD700] pointer-events-none transition-all duration-300"
                  style={{ left: `${bbox.x}%`, top: `${bbox.y}%`, width: `${bbox.w}%`, height: `${bbox.h}%` }}
                />
              </>
            )}
          </div>
        </div>

        {/* Bottom Panel */}
        <div className="flex-shrink-0 bg-[#fff9ef] border-t-4 border-black">
          <div className="flex items-stretch gap-3 px-4 pt-4 pb-3">
            {bbox ? (
              <canvas
                ref={canvasRef}
                className="border-2 border-black flex-shrink-0"
                style={{ width: 72, height: 80 }}
              />
            ) : (
              <div
                className="border-2 border-[#d0c6ab] bg-[#f3f3f3] flex-shrink-0 flex items-center justify-center"
                style={{ width: 72, height: 80 }}
              >
                <span className="font-dm-mono text-[8px] uppercase text-[#7e7576] text-center px-1 leading-tight">
                  No source
                </span>
              </div>
            )}

            <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-dm-mono text-[9px] uppercase tracking-widest bg-black text-white px-1.5 py-0.5">
                  {LINE_TYPE_LABELS[currentLine.receiptLineType] ?? currentLine.receiptLineType}
                </span>
                {fixedIds.has(currentLine.id) && (
                  <span className="font-dm-mono text-[9px] uppercase tracking-widest bg-[#bbf7d0] border border-[#16a34a] text-[#15803d] px-1.5 py-0.5">
                    Fixed
                  </span>
                )}
              </div>
              <p className="font-dm-sans font-bold text-[15px] uppercase leading-tight truncate">
                {currentLine.itemName}
              </p>
              <p className="font-dm-mono text-xs text-[#4d4732]">
                {currentLine.quantity} × {formatCurrency(currentLine.unitPrice)}
                {' = '}
                <span className="font-bold text-[#1b1b1b]">{formatCurrency(currentLine.totalPrice)}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              onClick={goNext}
              className="flex-1 h-12 border-4 border-black rounded font-dm-mono font-bold text-sm uppercase bg-white shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              Looks Right
            </button>
            <button
              onClick={() => setEditingLine(currentLine)}
              className="flex-1 h-12 border-4 border-black rounded font-dm-mono font-bold text-sm uppercase bg-[#FFD700] shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              Fix This
            </button>
          </div>
        </div>
      </div>

      {editingLine && (
        <div className="fixed inset-0 z-[90]">
          <LineItemModal
            isOpen={true}
            mode="edit"
            initialData={{
              itemName: editingLine.itemName,
              quantity: editingLine.quantity,
              unitPrice: editingLine.unitPrice,
              receiptLineType: editingLine.receiptLineType,
            }}
            onSave={handleSaveEdit}
            onCancel={dismissEditModal}
            showLineTypeSelector={editingLine.receiptLineType !== 'PRCH'}
            hasAssignments={false}
          />
        </div>
      )}
    </>
  );
}
