import React from 'react';

type StatusVariant = 'verified' | 'inconclusive' | 'pending' | 'warn' | 'neutral';

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  dot?: boolean;
}

const variantStyles: Record<StatusVariant, string> = {
  verified:    'bg-green-50 text-green-700 border border-green-200',
  inconclusive:'bg-amber-50 text-amber-700 border border-amber-200',
  pending:     'bg-blue-50 text-blue-700 border border-blue-200',
  warn:        'bg-orange-50 text-orange-700 border border-orange-200',
  neutral:     'bg-stone-100 text-stone-600 border border-stone-200',
};

const dotStyles: Record<StatusVariant, string> = {
  verified:    'bg-green-500',
  inconclusive:'bg-amber-500',
  pending:     'bg-blue-500',
  warn:        'bg-orange-500',
  neutral:     'bg-stone-400',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, label, dot = true }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-wide ${variantStyles[variant]}`}
  >
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
    {label}
  </span>
);
