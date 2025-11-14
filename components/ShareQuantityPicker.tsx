'use client';

import React from 'react';

interface ShareQuantityPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function ShareQuantityPicker({
  value,
  onChange,
  min = 0,
  max = 99,
}: ShareQuantityPickerProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div className="inline-flex items-center border-4 border-black bg-white">
      <button
        onClick={handleDecrement}
        disabled={value <= min}
        className="px-4 py-2 font-bold text-xl hover:bg-black hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-r-4 border-black"
      >
        −
      </button>
      <span className="px-6 py-2 font-mono font-bold text-lg min-w-[3rem] text-center">
        {value}
      </span>
      <button
        onClick={handleIncrement}
        disabled={value >= max}
        className="px-4 py-2 font-bold text-xl hover:bg-black hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border-l-4 border-black"
      >
        +
      </button>
    </div>
  );
}
