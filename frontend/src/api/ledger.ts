import { ledgerFetch } from './client';

export interface LedgerBlock {
  height: number;
  previous_hash: string;
  events_root: string;
  hash: string;
  timestamp_unix: number;
  events: LedgerTx[];
  validator_signatures: ValidatorSig[];
}

export interface LedgerTx {
  tx_id: string;
  event: DecryptionEvent;
  signature: string;
  public_key_reference: string;
}

export interface DecryptionEvent {
  event_id: string;
  event_version: number;
  session_id: string;
  document_id: string;
  document_sha256: string;
  recipient_id: string;
  recipient_signing_key_hash: string;
  watermark_ref: string;
  watermark_algorithm: string;
  artifact_sha256: string;
  timestamp_unix: number;
}

export interface ValidatorSig {
  node_id: string;
  signature: string;
  public_key: string;
}

export async function getChain(): Promise<LedgerBlock[]> {
  return ledgerFetch<LedgerBlock[]>('/chain');
}

export async function verifyChain(): Promise<{ valid: boolean; error_at_height?: number; reason?: string }> {
  return ledgerFetch('/verify_chain');
}

export async function proposeBlock(): Promise<unknown> {
  // This triggers the leader to propose
  const res = await fetch(`${(await import('./client')).LEDGER_URLS[0]}/propose_block`, { method: 'POST' });
  return res.json();
}
