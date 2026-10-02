import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  as: Tag = 'div',
  onClick,
  hoverable = false,
}) => (
  <Tag
    onClick={onClick}
    className={[
      'bg-surface rounded-card border border-border p-6 transition-smooth',
      hoverable && 'cursor-pointer hover:border-ink-3 hover:shadow-md',
      className,
    ].filter(Boolean).join(' ')}
  >
    {children}
  </Tag>
);

interface MetaRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

export const MetaRow: React.FC<MetaRowProps> = ({ label, value, mono = false }) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-border-subtle last:border-0">
    <span className="text-meta whitespace-nowrap">{label}</span>
    <span className={`text-sm text-ink-2 text-right ${mono ? 'font-mono break-all' : ''}`}>{value}</span>
  </div>
);

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ eyebrow, title, subtitle, className = '' }) => (
  <div className={`mb-12 ${className}`}>
    {eyebrow && (
      <p className="text-eyebrow mb-3">{eyebrow}</p>
    )}
    <h2 className="text-4xl font-semibold text-ink leading-tight tracking-tight mb-3">{title}</h2>
    {subtitle && <p className="text-subtitle">{subtitle}</p>}
  </div>
);
