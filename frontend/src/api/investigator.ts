import { apiFetch, LEDGER_URLS } from './client';

export interface InvestigationResult {
  status: 'VERIFIED' | 'INCONCLUSIVE';
  recipient_id?: string;
  session_id?: string;
  timestamp?: number;
  event_id?: string;
  reason?: string;
  watermark_ref?: string;
  merkle_valid?: boolean;
  hash_link_valid?: boolean;
  quorum?: number;
}

// NOTE: The browser cannot run Python watermark extraction.
// This endpoint proxies investigation through the backend.
// A /api/investigate endpoint must exist (or we call the investigator service indirectly).
// For the MVP demo the backend exposes /api/investigate which wraps the Python investigator.
export async function investigateArtifact(file: File): Promise<InvestigationResult> {
  const form = new FormData();
  form.append('file', file, file.name || 'artifact.pdf');

  // apiFetch wraps fetch and will forward headers; when sending FormData do not set content-type.
  return apiFetch<InvestigationResult>('/api/investigate', {
    method: 'POST',
    body: form as unknown as BodyInit,
  });
}

export async function getValidatorHealth(): Promise<{ node: string; alive: boolean }[]> {
  const results = await Promise.allSettled(
    LEDGER_URLS.map(async (url: string, i: number) => {
      try {
        const res = await fetch(`${url.trim()}/verify_chain`, { signal: AbortSignal.timeout(2000) });
        return { node: `Validator ${i + 1}`, alive: res.ok };
      } catch {
        return { node: `Validator ${i + 1}`, alive: false };
      }
    })
  );
  return results.map(r => (r.status === 'fulfilled' ? r.value : { node: 'Unknown', alive: false }));
}
