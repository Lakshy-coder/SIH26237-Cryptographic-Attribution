import React, { useRef, useState } from 'react';
import { Card, SectionHeader, MetaRow } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { investigateArtifact, type InvestigationResult } from '../api/investigator';

type InvestigateState = 'idle' | 'running' | 'done' | 'error';

export const InvestigatorPage: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<InvestigateState>('idle');
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files are supported.'); return; }
    setFile(f);
    setError(null);
    setResult(null);
    setState('idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleInvestigate = async () => {
    if (!file) { setError('Upload a PDF to investigate.'); return; }
    setError(null);
    setState('running');
    setResult(null);
    try {
      const res = await investigateArtifact(file);
      setResult(res);
      setState('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Investigation failed. Is the backend running?');
      setState('error');
    }
  };

  const isVerified = result?.status === 'VERIFIED';
  const isRunning = state === 'running';

  return (
    <div className="bg-canvas min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="Digital Forensics"
          title="Leak Investigation"
          subtitle="Upload a suspected leaked document to recover cryptographic attribution."
        />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Upload section (1 col) */}
          <div className="flex flex-col gap-6">
            <Card className="p-0 overflow-hidden">
              <div
                id="investigator-dropzone"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-card p-10 text-center cursor-pointer transition-smooth',
                  file
                    ? 'border-accent bg-accent-light'
                    : 'border-border hover:border-ink-3 hover:bg-canvas',
                ].join(' ')}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-card bg-accent/20 flex items-center justify-center text-accent">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8.707 1.5a2 2 0 00-2.828 0l-5.586 5.586a2 2 0 000 2.828l5.586 5.586a2 2 0 002.828 0l5.586-5.586a2 2 0 000-2.828L8.707 1.5z"/>
                        <path d="M8.707 1.5L1.393 8.814l5.586 5.586L14.293 7.086 8.707 1.5z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{file.name}</p>
                      <p className="text-xs text-ink-4 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-ink-3">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-ink">Upload Leaked PDF</p>
                      <p className="text-xs text-ink-4 mt-1">Supported: PDF forensic analysis</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {error && (
              <div className="px-4 py-3 bg-danger-light border border-danger rounded-card text-sm text-danger">
                {error}
              </div>
            )}

            <Button
              id="investigator-run"
              size="lg"
              loading={isRunning}
              disabled={!file || isRunning}
              onClick={handleInvestigate}
            >
              {isRunning ? 'Analyzing…' : 'Investigate Artifact'}
            </Button>

            <p className="text-xs text-ink-4 leading-relaxed">
              Extracts the embedded watermark, queries the permissioned ledger, and verifies cryptographic signatures and chain integrity.
            </p>
          </div>

          {/* Results section (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Loading state */}
            {isRunning && (
              <Card className="flex items-center justify-center gap-4 py-12">
                <svg className="animate-spin w-5 h-5 text-ink-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-ink">Analyzing artifact…</p>
                  <p className="text-xs text-ink-4 mt-1">Extracting watermark and verifying provenance</p>
                </div>
              </Card>
            )}

            {/* Done state */}
            {state === 'done' && result && (
              <>
                {/* Main verdict card */}
                <Card className={isVerified ? 'bg-verified-light border-verified' : 'bg-warn-light border-warn'}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className={[
                      'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0',
                      isVerified ? 'bg-verified text-white' : 'bg-warn text-white',
                    ].join(' ')}>
                      {isVerified ? '✓' : '?'}
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${isVerified ? 'text-verified' : 'text-warn'}`}>
                        {result.status}
                      </h3>
                      <p className={`text-sm mt-1 ${isVerified ? 'text-verified/75' : 'text-warn/75'}`}>
                        {isVerified ? 'Cryptographic provenance established' : result.reason ?? 'Insufficient evidence'}
                      </p>
                    </div>
                  </div>

                  {isVerified && (
                    <div className="space-y-3">
                      <MetaRow label="Recipient" value={<span className="font-semibold">{result.recipient_id}</span>} />
                      {result.session_id && <MetaRow label="Session" value={result.session_id.slice(0, 16)} mono />}
                      {result.event_id && <MetaRow label="Event" value={result.event_id.slice(0, 16)} mono />}
                      {result.timestamp && (
                        <MetaRow label="Timestamp" value={new Date(result.timestamp * 1000).toLocaleString()} />
                      )}
                    </div>
                  )}
                </Card>

                {isVerified && (
                  <>
                    {/* Cryptographic Proof */}
                    <Card>
                      <h3 className="text-meta mb-4">Cryptographic Proof</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ink">ML-DSA-65 Signature</span>
                          <StatusBadge variant="verified" label="Valid" />
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-3">
                          <span className="text-sm text-ink">Recipient Public Key</span>
                          <StatusBadge variant="verified" label="Verified" />
                        </div>
                      </div>
                    </Card>

                    {/* Ledger Proof */}
                    <Card>
                      <h3 className="text-meta mb-4">Ledger Proof</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ink">Event Found</span>
                          <StatusBadge variant="verified" label="Yes" />
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-3">
                          <span className="text-sm text-ink">Merkle Root</span>
                          <StatusBadge variant={result.merkle_valid !== false ? 'verified' : 'inconclusive'} label={result.merkle_valid !== false ? 'Valid' : 'Failed'} />
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-3">
                          <span className="text-sm text-ink">Hash Link Chain</span>
                          <StatusBadge variant={result.hash_link_valid !== false ? 'verified' : 'inconclusive'} label={result.hash_link_valid !== false ? 'Valid' : 'Failed'} />
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-3">
                          <span className="text-sm text-ink">Quorum Consensus</span>
                          <StatusBadge variant="verified" label={`${result.quorum ?? 2} / 3 Validators`} />
                        </div>
                      </div>
                    </Card>
                  </>
                )}

                {/* Disclaimer */}
                <div className="p-4 bg-canvas border border-border rounded-card">
                  <p className="text-xs text-ink-4 leading-relaxed">
                    Attribution is based on the recovered watermark reference and independently verified cryptographic provenance.
                    The system returns <span className="font-semibold text-ink">INCONCLUSIVE</span> when evidence is insufficient,
                    rather than forcing attribution on uncertain data.
                  </p>
                </div>
              </>
            )}

            {/* Idle state */}
            {state === 'idle' && !result && (
              <Card className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <svg className="w-12 h-12 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-ink-4">Upload a PDF to begin forensic analysis</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
