import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
  ...props
}: ButtonProps) {
  const baseStyles = 'border-4 border-black font-bold uppercase tracking-wider transition-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:enabled:shadow-none';

  const variantStyles = {
    primary: 'bg-blue-300 text-black hover:enabled:bg-blue-400 active:enabled:translate-x-1 active:enabled:translate-y-1',
    secondary: 'bg-white text-black hover:enabled:bg-gray-100 active:enabled:translate-x-1 active:enabled:translate-y-1',
    danger: 'bg-red-300 text-black hover:enabled:bg-red-400 active:enabled:translate-x-1 active:enabled:translate-y-1',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const disabledStyles = 'opacity-50 cursor-not-allowed';

  return (
    <button
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? disabledStyles : ''}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
