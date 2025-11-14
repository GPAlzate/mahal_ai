import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  fullWidth = false,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="block font-bold uppercase text-sm mb-2 tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`
          border-4 border-black
          px-4 py-3
          font-mono
          text-base
          focus:outline-none
          focus:ring-0
          focus:border-black
          bg-white
          ${fullWidth ? 'w-full' : ''}
          ${error ? 'border-red-600' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-2 text-sm font-bold text-red-600 uppercase tracking-wider">
          {error}
        </p>
      )}
    </div>
  );
}
