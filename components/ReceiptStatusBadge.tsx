function statusClass(status: string): string {
  if (status === 'STLD') {
    return 'bg-[oklch(87%_0.14_148)] border-black text-black';
  }
  if (status === 'FLZD') {
    return 'bg-[oklch(84%_0.10_270)] border-black text-black';
  }
  if (status === 'DRFT') {
    return 'bg-[oklch(88%_0.15_82)] border-black text-black';
  }
  return 'bg-[oklch(91%_0.02_80)] border-black text-[oklch(55%_0.04_80)]';
}

function statusLabel(status: string): string {
  if (status === 'STLD') return 'Settled';
  if (status === 'FLZD') return 'Finalized';
  if (status === 'DRFT') return 'Draft';
  return 'Processing';
}

interface Props {
  status: string;
}

export default function ReceiptStatusBadge({ status }: Props) {
  return (
    <span
      className={`font-dm-mono text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 ${statusClass(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}
