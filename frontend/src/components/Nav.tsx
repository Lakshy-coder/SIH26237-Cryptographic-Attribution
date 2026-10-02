import React from 'react';

type Page = 'overview' | 'sender' | 'recipient' | 'investigator' | 'system';

interface NavProps {
  current: Page;
  onNavigate: (p: Page) => void;
  systemAlive?: boolean;
}

const navLinks: { id: Page; label: string }[] = [
  { id: 'overview',     label: 'Overview' },
  { id: 'sender',       label: 'Sender' },
  { id: 'recipient',    label: 'Recipient' },
  { id: 'investigator', label: 'Investigator' },
  { id: 'system',       label: 'System' },
];

export const Nav: React.FC<NavProps> = ({ current, onNavigate, systemAlive }) => (
  <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border">
    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
      {/* Brand */}
      <button
        id="nav-brand"
        onClick={() => onNavigate('overview')}
        className="flex flex-col leading-none text-left hover:opacity-75 transition-smooth shrink-0"
      >
        <span className="text-sm font-semibold text-ink tracking-tight">SIH26237</span>
        <span className="text-xs text-ink-4 tracking-wide uppercase mt-0.5">Cryptographic Attribution</span>
      </button>

      {/* Nav links */}
      <nav className="hidden md:flex items-center gap-1 flex-1 justify-center" aria-label="Main navigation">
        {navLinks.map(({ id, label }) => (
          <button
            key={id}
            id={`nav-${id}`}
            onClick={() => onNavigate(id)}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-smooth',
              current === id
                ? 'bg-ink text-white'
                : 'text-ink-3 hover:text-ink hover:bg-canvas',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Right status */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-4">
          <span
            className={`w-2 h-2 rounded-full transition-smooth ${systemAlive ? 'bg-verified' : 'bg-border'}`}
          />
          <span>{systemAlive ? 'System Online' : 'System Offline'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas rounded-pill text-xs text-ink-4 font-medium border border-border">
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 7H7V3h2v4zm0 4H7v-2h2v2z"/>
          </svg>
          Air-Gapped
        </div>
      </div>
    </div>

    {/* Mobile nav */}
    <div className="md:hidden flex gap-1 px-6 pb-3 overflow-x-auto">
      {navLinks.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className={[
            'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth',
            current === id
              ? 'bg-ink text-white'
              : 'text-ink-3 bg-canvas',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  </header>
);

export type { Page };
