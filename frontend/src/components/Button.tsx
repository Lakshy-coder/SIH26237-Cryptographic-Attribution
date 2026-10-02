import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary:   'bg-ink text-white hover:bg-ink-2 active:bg-ink-2 disabled:bg-ink-4',
  secondary: 'bg-surface text-ink border border-border hover:border-ink-3 hover:bg-canvas active:bg-border disabled:opacity-50',
  ghost:     'bg-transparent text-ink-2 hover:bg-canvas active:bg-border disabled:opacity-40',
  danger:    'bg-danger text-white hover:bg-opacity-90 active:bg-opacity-95 disabled:bg-danger/50',
};

const sizeStyles = {
  sm: 'text-sm px-3.5 py-1.5 rounded-lg',
  md: 'text-base px-5 py-2.5 rounded-card',
  lg: 'text-base px-7 py-3.5 rounded-card',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => (
  <button
    disabled={disabled || loading}
    className={[
      'inline-flex items-center justify-center gap-2 font-semibold transition-smooth cursor-pointer',
      variantStyles[variant],
      sizeStyles[size],
      'disabled:cursor-not-allowed',
      className,
    ].join(' ')}
    {...props}
  >
    {loading && (
      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    )}
    {children}
  </button>
);
