import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getSystemStatus, type SystemStatus } from '../api/system';
import { getChain } from '../api/ledger';

type Page = 'sender' | 'recipient' | 'investigator';

interface OverviewPageProps {
  onNavigate: (p: Page) => void;
}

const FLOW_STEPS = [
  { label: 'Encrypted Document' },
  { label: 'Multiple Recipients' },
  { label: 'Watermarked Copies' },
  { label: 'Signed Events' },
  { label: 'Quorum Ledger' },
  { label: 'Attribution' },
];

const SYSTEM_SPEC = [
  { value: 'ML-KEM-1024', label: 'Post-Quantum KEM' },
  { value: 'ML-DSA-65',   label: 'Digital Signatures' },
  { value: '2-of-3',      label: 'Ledger Quorum' },
  { value: 'AES-256-GCM', label: 'Document Encryption' },
];

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [chainHeight, setChainHeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, chain] = await Promise.allSettled([getSystemStatus(), getChain()]);
        if (!alive) return;
        if (s.status === 'fulfilled') setStatus(s.value);
        if (chain.status === 'fulfilled') setChainHeight(chain.value.length);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const aliveValidators = status?.validators.filter(v => v.alive).length ?? 0;

  return (
    <div className="bg-canvas min-h-screen">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-20">

        {/* Hero Section */}
        <div className="mb-24">
          <p className="text-eyebrow mb-4">SIH 2026 · Blockchain &amp; Cybersecurity</p>
          
          <h1 className="text-6xl md:text-7xl font-semibold text-ink leading-[1.1] tracking-tight mb-8">
            Make Every Decryption<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ink to-ink-3">Cryptographically Attributable.</span>
          </h1>

          <p className="text-subtitle max-w-2xl mb-10">
            A sovereign, offline provenance system that creates recipient-specific forensic watermarks,
            cryptographically signs decryption events, and preserves tamper-evident provenance on a
            permissioned ledger.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button id="cta-investigate" size="lg" onClick={() => onNavigate('investigator')}>
              Start Investigation
            </Button>
            <Button id="cta-distribute" size="lg" variant="secondary" onClick={() => onNavigate('sender')}>
              Distribute Secure Document
            </Button>
          </div>
        </div>

        {/* System Spec Metrics */}
        <div className="mb-24">
          <p className="text-eyebrow mb-8">System Specifications</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {SYSTEM_SPEC.map((m) => (
              <Card key={m.value} className="py-8 px-6 text-center">
                <p className="text-3xl md:text-4xl font-semibold text-ink tracking-tight">{m.value}</p>
                <p className="text-eyebrow mt-3">{m.label}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* System Status */}
        {!loading && status && (
          <div className="mb-24">
            <p className="text-eyebrow mb-6">Live System Status</p>
            <div className="flex flex-wrap gap-3 items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-medium border ${
                status.backend 
                  ? 'bg-verified-light border-verified text-verified' 
                  : 'bg-warn-light border-warn text-warn'
              }`}>
                <span className={`w-2 h-2 rounded-full ${status.backend ? 'bg-verified' : 'bg-warn'}`} />
                Backend {status.backend ? 'Online' : 'Offline'}
              </div>
              
              <div className={`flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-medium border ${
                aliveValidators >= 2 
                  ? 'bg-verified-light border-verified text-verified' 
                  : 'bg-warn-light border-warn text-warn'
              }`}>
                <span className={`w-2 h-2 rounded-full ${aliveValidators >= 2 ? 'bg-verified' : 'bg-warn'}`} />
                {aliveValidators}/3 Validators
              </div>

              {chainHeight !== null && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-medium border border-border bg-canvas text-ink-3">
                  Chain: {chainHeight} blocks
                </div>
              )}
            </div>
          </div>
        )}

        {/* Provenance Flow Visualization */}
        <div className="mb-24">
          <p className="text-eyebrow mb-10">End-to-End Provenance Flow</p>
          
          <div className="space-y-4">
            {/* Desktop view - horizontal */}
            <div className="hidden md:flex items-stretch gap-3">
              {FLOW_STEPS.map((step, idx) => (
                <React.Fragment key={step.label}>
                  <Card className="flex-1 flex flex-col items-center justify-center py-8 px-4">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-ink-3 mb-2">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <p className="text-sm font-medium text-ink leading-snug">{step.label}</p>
                    </div>
                  </Card>
                  
                  {idx < FLOW_STEPS.length - 1 && (
                    <div className="flex items-center justify-center w-8 shrink-0">
                      <svg className="w-4 h-4 text-ink-4" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8h12M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Mobile view - vertical */}
            <div className="md:hidden space-y-2">
              {FLOW_STEPS.map((step, idx) => (
                <React.Fragment key={step.label}>
                  <Card className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-semibold text-ink-3 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <p className="text-sm font-medium text-ink">{step.label}</p>
                    </div>
                  </Card>
                  {idx < FLOW_STEPS.length - 1 && (
                    <div className="flex justify-center py-1">
                      <svg className="w-4 h-4 text-ink-4" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v12M5 10l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Page Links */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              id: 'overview-sender-card',
              title: 'Sender',
              desc: 'Encrypt once. Distribute with recipient-specific watermarks.',
              cta: 'Open Sender',
              page: 'sender' as Page,
            },
            {
              id: 'overview-recipient-card',
              title: 'Recipient',
              desc: 'Decrypt locally. Prove provenance before release.',
              cta: 'Open Recipient',
              page: 'recipient' as Page,
            },
            {
              id: 'overview-investigator-card',
              title: 'Investigator',
              desc: 'Upload a leaked PDF. Recover cryptographic attribution.',
              cta: 'Open Investigator',
              page: 'investigator' as Page,
            },
          ].map((c) => (
            <Card key={c.id} className="flex flex-col justify-between gap-5 hover:border-ink-3 hover:shadow-md cursor-pointer transition-smooth" hoverable>
              <div>
                <h3 className="text-lg font-semibold text-ink mb-2">{c.title}</h3>
                <p className="text-sm text-ink-3 leading-relaxed">{c.desc}</p>
              </div>
              <Button id={c.id} variant="secondary" size="sm" onClick={() => onNavigate(c.page)}>
                {c.cta} →
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
