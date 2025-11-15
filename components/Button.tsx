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
  const baseStyles = 'border-4 border-black font-bold uppercase tracking-wider transition-none';

  const variantStyles = {
    primary: 'bg-black text-white hover:enabled:bg-white hover:enabled:text-black active:enabled:translate-x-1 active:enabled:translate-y-1',
    secondary: 'bg-white text-black hover:enabled:bg-black hover:enabled:text-white active:enabled:translate-x-1 active:enabled:translate-y-1',
    danger: 'bg-white text-black border-black hover:enabled:bg-black hover:enabled:text-white active:enabled:translate-x-1 active:enabled:translate-y-1',
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
