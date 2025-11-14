import React from 'react';

interface ParticipantPillProps {
  name: string;
  onRemove?: () => void;
  selected?: boolean;
  onClick?: () => void;
}

export function ParticipantPill({
  name,
  onRemove,
  selected = false,
  onClick,
}: ParticipantPillProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-2
        border-4 border-black
        px-4 py-2
        font-bold uppercase text-sm tracking-wider
        ${selected ? 'bg-black text-white' : 'bg-white text-black'}
        ${onClick ? 'cursor-pointer hover:bg-black hover:text-white' : ''}
      `}
      onClick={onClick}
    >
      <span>{name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 font-bold text-lg hover:scale-110"
        >
          ✕
        </button>
      )}
    </div>
  );
}
