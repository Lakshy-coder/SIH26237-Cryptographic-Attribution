// API base URL — points to FastAPI backend
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
export const LEDGER_URLS = (import.meta.env.VITE_LEDGER_URLS ?? 'http://localhost:8001,http://localhost:8002,http://localhost:8003').split(',');

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function ledgerFetch<T>(path: string): Promise<T> {
  // Try each validator in order
  for (const base of LEDGER_URLS) {
    try {
      const res = await fetch(`${base.trim()}${path}`);
      if (res.ok) return res.json() as Promise<T>;
    } catch {
      // try next
    }
  }
  throw new Error(`All ledger nodes unreachable for ${path}`);
}
