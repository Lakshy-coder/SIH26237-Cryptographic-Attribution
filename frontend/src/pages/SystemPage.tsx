import React, { useEffect, useState } from 'react';
import { Card, SectionHeader } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { getSystemStatus, type SystemStatus } from '../api/system';
import { getChain, verifyChain, type LedgerBlock } from '../api/ledger';

interface TechSpec {
  category: string;
  items: { label: string; sublabel: string; status?: 'live' | 'verified' | 'deferred' }[];
}

const TECH_SPECS: TechSpec[] = [
  {
    category: 'Post-Quantum Cryptography',
    items: [
      { label: 'ML-KEM-1024', sublabel: 'NIST FIPS 203 — Key Encapsulation', status: 'live' },
      { label: 'ML-DSA-65',   sublabel: 'NIST FIPS 204 — Digital Signatures', status: 'live' },
    ],
  },
  {
    category: 'Document Security',
    items: [
      { label: 'AES-256-GCM',  sublabel: 'Symmetric encryption with authentication', status: 'live' },
      { label: 'HKDF-SHA256',  sublabel: 'Key derivation for KEK and DEK', status: 'live' },
      { label: 'SHAKE256',     sublabel: 'Watermark reference derivation', status: 'live' },
    ],
  },
  {
    category: 'Forensic Watermarking',
    items: [
      { label: 'DWT/QIM',     sublabel: 'Transform-domain raster embedding', status: 'live' },
      { label: 'PyMuPDF',     sublabel: 'PDF page rasterization', status: 'live' },
      { label: 'NumPy + PyWavelets', sublabel: 'Signal processing & DWT', status: 'live' },
    ],
  },
  {
    category: 'Permissioned Ledger',
    items: [
      { label: '3 Validators',      sublabel: 'Independent endorsement nodes', status: 'live' },
      { label: '2-of-3 Quorum',     sublabel: 'M-of-N finality requirement', status: 'live' },
      { label: 'Merkle Root',       sublabel: 'Event set integrity', status: 'live' },
      { label: 'Hash-Linked Chain', sublabel: 'Append-only tamper evidence', status: 'live' },
    ],
  },
  {
    category: 'Deployment',
    items: [
      { label: 'Docker Compose',  sublabel: 'Reproducible multi-service topology', status: 'live' },
      { label: 'PostgreSQL',      sublabel: 'Document + identity storage', status: 'live' },
      { label: 'Air-Gapped',      sublabel: 'No public internet required at runtime', status: 'verified' },
      { label: 'HSM / PKCS#11',   sublabel: 'Hardware key storage (future)', status: 'deferred' },
    ],
  },
];

const statusLabel: Record<string, { variant: 'verified' | 'pending' | 'neutral'; text: string }> = {
  live:     { variant: 'verified', text: 'Live' },
  verified: { variant: 'verified', text: 'Verified' },
  deferred: { variant: 'neutral',  text: 'Future' },
};

export const SystemPage: React.FC = () => {
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [chain, setChain] = useState<LedgerBlock[] | null>(null);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, c, v] = await Promise.allSettled([getSystemStatus(), getChain(), verifyChain()]);
        if (!alive) return;
        if (s.status === 'fulfilled') setSysStatus(s.value);
        if (c.status === 'fulfilled') setChain(c.value);
        if (v.status === 'fulfilled') setChainValid(v.value.valid);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const totalEvents = chain?.reduce((a, b) => a + (b.events?.length ?? 0), 0) ?? 0;
  const aliveValidators = sysStatus?.validators.filter(v => v.alive).length ?? 0;

  return (
    <div className="bg-canvas min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="System Architecture"
          title="Platform Status &amp; Specs"
          subtitle="Live view of cryptographic components, ledger state, and validator nodes."
        />

        {/* Live metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {[
            {
              label: 'Backend',
              value: loading ? '…' : sysStatus?.backend ? 'Online' : 'Offline',
              sub: 'FastAPI Server',
              ok: sysStatus?.backend,
            },
            {
              label: 'Validators',
              value: loading ? '…' : `${aliveValidators} / 3`,
              sub: 'Active Nodes',
              ok: aliveValidators >= 2,
            },
            {
              label: 'Chain Height',
              value: loading ? '…' : String(chain?.length ?? 0),
              sub: 'Committed Blocks',
              ok: null,
            },
            {
              label: 'Events Recorded',
              value: loading ? '…' : String(totalEvents),
              sub: 'Provenance Records',
              ok: null,
            },
          ].map(m => (
            <Card key={m.label} className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-4xl font-semibold text-ink mb-2">{m.value}</p>
              <p className="text-sm text-ink-3 font-medium mb-1">{m.label}</p>
              <p className="text-xs text-ink-4">{m.sub}</p>
              {m.ok !== null && (
                <div className="mt-3">
                  <StatusBadge variant={m.ok ? 'verified' : 'warn'} label={m.ok ? 'OK' : 'Alert'} />
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Validator nodes status */}
        {sysStatus && (
          <div className="mb-16">
            <p className="text-eyebrow mb-6">Validator Node Status</p>
            <div className="flex flex-wrap gap-3">
              {sysStatus.validators.map((v, i) => (
                <div
                  key={v.node}
                  id={`validator-card-${i + 1}`}
                  className={[
                    'flex items-center gap-2.5 px-4 py-2.5 rounded-pill text-sm font-medium border transition-smooth',
                    v.alive
                      ? 'bg-verified-light border-verified text-verified'
                      : 'bg-border text-ink-4 border-border',
                  ].join(' ')}
                >
                  <span className={`w-2 h-2 rounded-full ${v.alive ? 'bg-verified' : 'bg-ink-4'}`} />
                  {v.node}
                  <span className="text-xs font-normal opacity-60">{v.alive ? 'Endorsing' : 'Unreachable'}</span>
                </div>
              ))}
              {chainValid !== null && (
                <div className={[
                  'flex items-center gap-2.5 px-4 py-2.5 rounded-pill text-sm font-medium border',
                  chainValid
                    ? 'bg-verified-light border-verified text-verified'
                    : 'bg-danger-light border-danger text-danger',
                ].join(' ')}>
                  <span className={`w-2 h-2 rounded-full ${chainValid ? 'bg-verified' : 'bg-danger'}`} />
                  Chain: {chainValid ? 'Verified' : 'TAMPERED'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tech specs grid */}
        <div className="mb-16">
          <p className="text-eyebrow mb-8">Technical Specifications</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
            {TECH_SPECS.map(section => (
              <Card key={section.category}>
                <h3 className="text-sm font-semibold text-ink mb-6">{section.category}</h3>
                <div className="space-y-4">
                  {section.items.map(item => (
                    <div key={item.label} className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{item.label}</p>
                        <p className="text-xs text-ink-4 leading-relaxed mt-1">{item.sublabel}</p>
                      </div>
                      {item.status && (
                        <div className="shrink-0">
                          <StatusBadge variant={statusLabel[item.status].variant} label={statusLabel[item.status].text} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* MVP Limitations */}
        <div>
          <p className="text-eyebrow mb-6">MVP Scope & Limitations</p>
          <Card className="bg-warn-light border-warn">
            <ul className="text-sm text-warn space-y-3 list-disc list-inside leading-relaxed">
              <li>React frontend integrates with backend for Sender/Recipient/Investigator flows; session creation verified.</li>
              <li>Recipient agent uses fixed finality waits, not event-driven subscriptions (future: WebSocket/SSE).</li>
              <li>Watermark robustness designed for digital PDF forensics. Print-scan and camera captures require additional work.</li>
              <li>MVP ledger uses custom quorum/Merkle implementation. Production should migrate to mature BFT system.</li>
              <li>Private key cryptographic operations remain server-side. Browser never receives plaintext or secrets.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};
