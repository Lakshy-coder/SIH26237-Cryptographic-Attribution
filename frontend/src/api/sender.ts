import { apiFetch } from './client';

export interface RegisterRequest {
  recipient_id: string;
  ml_kem_public_key: string;
  ml_dsa_public_key: string;
}

export interface DocumentUploadRequest {
  recipient_ids: string[];
  plaintext_pdf_b64: string;
}

export interface DocumentUploadResponse {
  status: string;
  document_id: string;
}

export interface SessionResponse {
  session_id: string;
  server_nonce: string;
  document_hash: string;
  encrypted_payload_b64: string;
  envelope_b64: string;
}

export async function registerRecipient(req: RegisterRequest) {
  return apiFetch<{ status: string }>('/api/register', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getPublicKeys(recipientId: string) {
  return apiFetch<{ ml_kem_public_key: string; ml_dsa_public_key: string }>(
    `/api/public_keys/${recipientId}`
  );
}

export async function uploadDocument(req: DocumentUploadRequest): Promise<DocumentUploadResponse> {
  return apiFetch<DocumentUploadResponse>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function createSession(documentId: string, recipientId: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ document_id: documentId, recipient_id: recipientId }),
  });
}
