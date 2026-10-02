import React, { useRef, useState } from 'react';
import { Card, SectionHeader, MetaRow } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { uploadDocument } from '../api/sender';

const DEMO_RECIPIENTS = [
  { id: 'agent_A', label: 'Recipient A', role: 'Authorized agent', icon: 'A' },
  { id: 'agent_B', label: 'Recipient B', role: 'Authorized agent', icon: 'B' },
  { id: 'agent_C', label: 'Recipient C', role: 'Authorized agent', icon: 'C' },
];

type StepState = 'idle' | 'encrypting' | 'distributing' | 'enveloping' | 'done' | 'error';

const PROGRESS_STEPS = [
  { key: 'encrypting', label: 'Encrypting document' },
  { key: 'distributing', label: 'Distributing to recipients' },
  { key: 'enveloping', label: 'Creating recipient envelopes' },
  { key: 'done', label: 'Distribution complete' },
];

export const SenderPage: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customRecipient, setCustomRecipient] = useState('');
  const [stepState, setStepState] = useState<StepState>('idle');
  const [docId, setDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const allRecipients = [
    ...selectedRecipients,
    ...(customRecipient.trim() ? [customRecipient.trim()] : []),
  ];

  const handleFile = (f: File) => {
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleDistribute = async () => {
    if (!file) { setError('Please select a PDF document.'); return; }
    if (allRecipients.length === 0) { setError('Select at least one recipient.'); return; }
    setError(null);

    try {
      setStepState('encrypting');
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const b64 = btoa(String.fromCharCode(...bytes));

      await new Promise(r => setTimeout(r, 600));
      setStepState('distributing');
      await new Promise(r => setTimeout(r, 400));
      setStepState('enveloping');

      const result = await uploadDocument({
        recipient_ids: allRecipients,
        plaintext_pdf_b64: b64,
      });

      await new Promise(r => setTimeout(r, 300));
      setDocId(result.document_id);
      setStepState('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Distribution failed.');
      setStepState('error');
    }
  };

  const handleReset = () => {
    setFile(null);
    setDocId(null);
    setStepState('idle');
    setError(null);
    setSelectedRecipients([]);
  };

  const currentStepIdx = PROGRESS_STEPS.findIndex(s => s.key === stepState);
  const isRunning = stepState !== 'idle' && stepState !== 'done' && stepState !== 'error';

  return (
    <div className="bg-canvas min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="Secure Distribution"
          title="Distribute Encrypted Documents"
          subtitle="Encrypt once. Distribute with recipient-specific watermarks and provenance."
        />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left — Upload (spans 2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Drop zone */}
            <Card className="p-0 overflow-hidden">
              <div
                id="sender-dropzone"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-card p-12 text-center cursor-pointer transition-smooth',
                  file
                    ? 'border-verified bg-verified-light'
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
                    <div className="w-12 h-12 rounded-card bg-verified/20 flex items-center justify-center text-verified">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-ink">{file.name}</p>
                      <p className="text-sm text-ink-3 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-ink-3">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-ink">Drop a PDF here</p>
                      <p className="text-xs text-ink-4 mt-1">or click to browse</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Document details */}
            {file && stepState !== 'done' && (
              <Card>
                <h3 className="text-sm font-semibold text-ink mb-4">Document Details</h3>
                <div className="space-y-3">
                  <MetaRow label="Filename" value={file.name} />
                  <MetaRow label="Size" value={`${(file.size / 1024).toFixed(1)} KB`} />
                  <MetaRow label="Type" value="application/pdf" />
                  <MetaRow label="Encryption" value={<StatusBadge variant="pending" label="Ready to encrypt" />} />
                </div>
              </Card>
            )}

            {/* Result */}
            {docId && stepState === 'done' && (
              <Card className="bg-verified-light border-verified">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-verified/20 flex items-center justify-center text-verified">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-verified">Distribution Complete</h3>
                    <p className="text-sm text-verified/75 mt-1">Documents encrypted and enveloped for {allRecipients.length} recipient{allRecipients.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <MetaRow label="Document ID" value={docId} mono />
                  <MetaRow label="Recipients" value={allRecipients.join(', ')} />
                  <MetaRow label="Encryption" value="AES-256-GCM" />
                  <MetaRow label="Status" value={<StatusBadge variant="verified" label="Distributed" />} />
                </div>
              </Card>
            )}
          </div>

          {/* Right — Recipients & Action */}
          <div className="flex flex-col gap-6">
            {/* Recipients selection */}
            <Card>
              <h3 className="text-sm font-semibold text-ink mb-4">Select Recipients</h3>
              <div className="flex flex-col gap-2 mb-5">
                {DEMO_RECIPIENTS.map(r => (
                  <label
                    key={r.id}
                    id={`recipient-card-${r.id}`}
                    className={[
                      'flex items-center gap-3 p-3 rounded-card border cursor-pointer transition-smooth',
                      selectedRecipients.includes(r.id)
                        ? 'border-ink bg-canvas'
                        : 'border-border hover:border-ink-3',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(r.id)}
                      onChange={() => toggleRecipient(r.id)}
                      className="accent-ink w-4 h-4 cursor-pointer"
                    />
                    <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-sm font-bold">
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{r.label}</p>
                      <p className="text-xs text-ink-4 mt-0.5">{r.id}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Custom recipient */}
              <div>
                <label htmlFor="custom-recipient-input" className="text-meta block mb-2">Custom Recipient ID</label>
                <input
                  id="custom-recipient-input"
                  type="text"
                  value={customRecipient}
                  onChange={e => setCustomRecipient(e.target.value)}
                  placeholder="agent_D"
                  disabled={isRunning}
                  className="w-full border border-border rounded-card px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-ink transition-smooth disabled:opacity-50"
                />
              </div>
            </Card>

            {/* Progress */}
            {stepState !== 'idle' && (
              <Card>
                <h3 className="text-meta mb-4">Distribution Progress</h3>
                <div className="flex flex-col gap-3">
                  {PROGRESS_STEPS.map((step, i) => {
                    const isDone = stepState === 'done' || currentStepIdx > i;
                    const isCurrent = step.key === stepState;
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div className={[
                          'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-smooth shrink-0',
                          isDone ? 'bg-verified text-white' : isCurrent ? 'bg-ink text-white' : 'bg-border text-ink-4',
                        ].join(' ')}>
                          {isDone ? '✓' : i + 1}
                        </div>
                        <span className={`text-sm transition-smooth ${isCurrent ? 'text-ink font-medium' : isDone ? 'text-verified' : 'text-ink-4'}`}>
                          {step.label}
                          {isCurrent && <span className="ml-2 animate-pulse">…</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Error */}
            {error && (
              <div className="px-4 py-3 bg-danger-light border border-danger rounded-card text-sm text-danger">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              {stepState === 'done' ? (
                <>
                  <Button id="sender-reset" variant="secondary" size="lg" onClick={handleReset}>
                    New Distribution
                  </Button>
                  <Button id="sender-goto-investigator" variant="ghost" size="sm" onClick={() => window.location.href = '?page=investigator'}>
                    Test Investigation
                  </Button>
                </>
              ) : (
                <Button
                  id="sender-distribute"
                  size="lg"
                  loading={isRunning}
                  disabled={!file || allRecipients.length === 0 || isRunning}
                  onClick={handleDistribute}
                >
                  Encrypt &amp; Distribute
                </Button>
              )}
            </div>

            {/* Helper text */}
            <p className="text-xs text-ink-4 leading-relaxed">
              Selected {allRecipients.length} recipient{allRecipients.length !== 1 ? 's' : ''}. Each will receive a uniquely watermarked and enveloped copy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
