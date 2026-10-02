import { apiFetch, ledgerFetch } from './client';
import type { LedgerBlock } from './ledger';

export interface SystemStatus {
  backend: boolean;
  validators: { node: string; alive: boolean }[];
  chainHeight: number;
  totalEvents: number;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const { LEDGER_URLS } = await import('./client');

  // Check backend
  let backend = false;
  try {
    await apiFetch('/');
    backend = true;
  } catch { /* offline */ }

  // Check each validator
  const validators = await Promise.all(
    LEDGER_URLS.map(async (url: string, i: number) => {
      try {
        const res = await fetch(`${url.trim()}/verify_chain`, { signal: AbortSignal.timeout(2000) });
        return { node: `Validator ${i + 1}`, alive: res.ok };
      } catch {
        return { node: `Validator ${i + 1}`, alive: false };
      }
    })
  );

  // Chain stats
  let chainHeight = 0;
  let totalEvents = 0;
  try {
    const chain = await ledgerFetch<LedgerBlock[]>('/chain');
    chainHeight = chain.length;
    totalEvents = chain.reduce((acc, b) => acc + (b.events?.length ?? 0), 0);
  } catch { /* ledger offline */ }

  return { backend, validators, chainHeight, totalEvents };
}
