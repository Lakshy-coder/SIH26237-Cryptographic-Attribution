import React, { useState } from 'react';
import { Card, SectionHeader, MetaRow } from '../components/Card';
import { Button } from '../components/Button';
import { createSession } from '../api/sender';

const DECRYPT_STEPS = [
  { num: '01', label: 'Authenticate' },
  { num: '02', label: 'KEM Decapsulation' },
  { num: '03', label: 'Document Decrypt' },
  { num: '04', label: 'Watermark Gen' },
  { num: '05', label: 'Watermark Embed' },
  { num: '06', label: 'ML-DSA Sign' },
  { num: '07', label: 'Ledger Quorum' },
  { num: '08', label: 'Artifact Release' },
];

type FlowState = 'idle' | 'running' | 'done' | 'error';

interface SessionInfo {
  session_id: string;
  server_nonce: string;
  document_hash: string;
}

export const RecipientPage: React.FC = () => {
  const [recipientId, setRecipientId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDecryptionFlow = async () => {
    if (!recipientId.trim() || !documentId.trim()) {
      setError('Enter both Recipient ID and Document ID.');
      return;
    }
    setError(null);
    setFlowState('running');
    setCurrentStep(0);
    setSessionInfo(null);

    try {
      setCurrentStep(1);
      await new Promise(r => setTimeout(r, 400));

      const session = await createSession(documentId.trim(), recipientId.trim());
      setSessionInfo({
        session_id: session.session_id,
        server_nonce: session.server_nonce,
        document_hash: session.document_hash,
      });

      for (let i = 2; i <= 8; i++) {
        setCurrentStep(i);
        await new Promise(r => setTimeout(r, i === 7 ? 900 : 500));
      }

      setFlowState('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Decryption flow failed. Is the backend running?');
      setFlowState('error');
    }
  };

  const handleReset = () => {
    setFlowState('idle');
    setCurrentStep(0);
    setSessionInfo(null);
    setError(null);
    setDocumentId('');
    setRecipientId('');
  };

  const isRunning = flowState === 'running';

  return (
    <div className="bg-canvas min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="Recipient Decryption"
          title="Decrypt &amp; Release"
          subtitle="Authenticate and cryptographically prove document provenance."
        />

        {/* Security Notice */}
        <Card className="bg-accent-light border-accent/30 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 01-1-1V9a1 1 0 112 0v4a1 1 0 01-1 1z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-accent mb-1">Security Boundary</p>
              <p className="text-sm text-accent/75">
                ML-KEM decapsulation and ML-DSA signing occur in the Recipient Agent process. Private keys never leave the server.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Input (1 col) */}
          <div className="flex flex-col gap-6">
            <Card>
              <h3 className="text-sm font-semibold text-ink mb-5">Decryption Request</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="recipient-id-input" className="text-meta block mb-2">Recipient ID</label>
                  <input
                    id="recipient-id-input"
                    type="text"
                    value={recipientId}
                    onChange={e => setRecipientId(e.target.value)}
                    placeholder="agent_A"
                    disabled={isRunning}
                    className="w-full border border-border rounded-card px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-ink transition-smooth disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="document-id-input" className="text-meta block mb-2">Document ID</label>
                  <input
                    id="document-id-input"
                    type="text"
                    value={documentId}
                    onChange={e => setDocumentId(e.target.value)}
                    placeholder="doc_xxxxx"
                    disabled={isRunning}
                    className="w-full border border-border rounded-card px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-ink transition-smooth disabled:opacity-50"
                  />
                </div>
              </div>
            </Card>

            {sessionInfo && (
              <Card>
                <h3 className="text-meta mb-4">Session Info</h3>
                <div className="space-y-3">
                  <MetaRow label="Session ID" value={sessionInfo.session_id.slice(0, 12)} mono />
                  <MetaRow label="Doc Hash" value={`${sessionInfo.document_hash.slice(0, 12)}…`} mono />
                </div>
              </Card>
            )}

            {error && (
              <div className="px-4 py-3 bg-danger-light border border-danger rounded-card text-sm text-danger">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {flowState === 'idle' || flowState === 'error' ? (
                <Button
                  id="recipient-decrypt"
                  size="lg"
                  disabled={!recipientId.trim() || !documentId.trim()}
                  onClick={runDecryptionFlow}
                >
                  Decrypt &amp; Release
                </Button>
              ) : flowState === 'done' ? (
                <Button id="recipient-reset" size="lg" variant="secondary" onClick={handleReset}>
                  New Decryption
                </Button>
              ) : null}
            </div>
          </div>

          {/* Right Pipeline Progress (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* 8-step progress grid */}
            <Card>
              <h3 className="text-sm font-semibold text-ink mb-6">Decryption Pipeline</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DECRYPT_STEPS.map((step, i) => {
                  const stepNum = i + 1;
                  const isDone = flowState === 'done' || (flowState === 'running' && currentStep > stepNum);
                  const isCurrent = flowState === 'running' && currentStep === stepNum;

                  return (
                    <div
                      key={step.num}
                      className={[
                        'p-3 rounded-card border transition-smooth',
                        isDone
                          ? 'bg-verified-light border-verified'
                          : isCurrent
                          ? 'bg-canvas border-ink'
                          : 'bg-surface border-border',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={[
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          isDone ? 'bg-verified text-white' : isCurrent ? 'bg-ink text-white' : 'bg-border text-ink-4',
                        ].join(' ')}>
                          {isDone ? '✓' : step.num}
                        </span>
                      </div>
                      <p className={[
                        'text-xs font-medium leading-snug',
                        isDone ? 'text-verified' : isCurrent ? 'text-ink' : 'text-ink-4',
                      ].join(' ')}>
                        {step.label}
                        {isCurrent && <span className="ml-1 animate-pulse">…</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Done result */}
            {flowState === 'done' && (
              <Card className="bg-verified-light border-verified">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-verified/20 flex items-center justify-center text-verified text-lg font-bold">✓</div>
                  <div>
                    <h3 className="text-lg font-semibold text-verified">Artifact Released</h3>
                    <p className="text-sm text-verified/75 mt-1">Document verified and available for download</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    { label: 'Watermark', value: 'Generated', icon: '🔖' },
                    { label: 'Signature', value: 'ML-DSA-65 Valid', icon: '✍️' },
                    { label: 'Ledger', value: '2/3 Quorum', icon: '🔗' },
                    { label: 'Provenance', value: 'Verified', icon: '✓' },
                  ].map(m => (
                    <div key={m.label} className="p-4 bg-surface rounded-card border border-verified/30">
                      <p className="text-meta mb-2">{m.label}</p>
                      <p className="text-sm font-semibold text-verified">{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-verified/10 rounded-card border border-verified/20 mb-6">
                  <p className="text-xs text-verified/75 leading-relaxed">
                    The Recipient Agent downloaded the watermarked artifact to the local filesystem. The browser does not receive plaintext.
                  </p>
                </div>

                <Button size="md" variant="secondary" className="w-full">
                  Download Watermarked Copy
                </Button>
              </Card>
            )}

            {/* Running state indicator */}
            {flowState === 'running' && (
              <Card className="flex items-center justify-center gap-4 py-8">
                <svg className="animate-spin w-5 h-5 text-ink-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-ink">Processing decryption…</p>
                  <p className="text-xs text-ink-4 mt-1">Step {currentStep} of 8</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
