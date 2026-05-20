import { ArrowLeft, Eye } from 'lucide-react';
import Link from 'next/link';

interface PageHeaderProps {
  onBack?: () => void;
  onViewReceipt?: () => void;
}

export function PageHeader({ onBack, onViewReceipt }: PageHeaderProps) {
  return (
    <div className="mb-4">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-mono uppercase tracking-wider text-gray-600 hover:text-black mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      )}
      <div className="flex items-center justify-between">
        <Link href="/">
          <h1 className="text-2xl font-bold px-3 py-2 bg-black text-white inline-block transform -rotate-1">
            mahal ai &lt;3
          </h1>
        </Link>
        {onViewReceipt && (
          <button
            onClick={onViewReceipt}
            className="border-4 border-black bg-white w-10 h-10 font-bold hover:bg-black hover:text-white transition-colors flex items-center justify-center flex-shrink-0 rotate-2"
            style={{ borderRadius: '60% 40% 55% 45% / 45% 55% 40% 60%' }}
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
