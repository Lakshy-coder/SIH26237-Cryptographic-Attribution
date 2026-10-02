import os
import base64
import time
import httpx
from crypto.kem import generate_kem_keypair, decapsulate
from crypto.signatures import generate_sig_keypair, sign_message
from crypto.symmetric import unwrap_key, decrypt_document, derive_kek, hash_sha256, hash_shake256
from crypto.canonical import canonical_encode
from watermark.pdf_pipeline import embed_watermark_pdf
import uuid

class RecipientAgent:
    def __init__(self, agent_id: str, backend_url: str, ledger_urls: list[str]):
        self.agent_id = agent_id
        self.backend_url = backend_url
        self.ledger_urls = ledger_urls
        self.kem_pk, self.kem_sk = generate_kem_keypair()
        self.sig_pk, self.sig_sk = generate_sig_keypair()

    def register(self):
        resp = httpx.post(f"{self.backend_url}/api/register", json={
            "recipient_id": self.agent_id,
            "ml_kem_public_key": base64.b64encode(self.kem_pk).decode(),
            "ml_dsa_public_key": base64.b64encode(self.sig_pk).decode()
        })
        resp.raise_for_status()

    def perform_decryption_flow(self, document_id: str, out_path: str):
        # 1. Start session
        resp = httpx.post(f"{self.backend_url}/api/sessions", json={
            "document_id": document_id,
            "recipient_id": self.agent_id
        })
        resp.raise_for_status()
        data = resp.json()
        
        # 2. Extract payload
        enc_payload = base64.b64decode(data["encrypted_payload_b64"])
        envelope = base64.b64decode(data["envelope_b64"])
        
        # 3. Decrypt
        # The ct size for ML-KEM-1024 is 1568
        CT_SIZE = 1568
        ct = envelope[:CT_SIZE]
        wrapped_dek = envelope[CT_SIZE:]
        
        ss = decapsulate(ct, self.kem_sk)
        kek = derive_kek(ss)
        dek = unwrap_key(wrapped_dek, kek)
        
        plaintext_pdf = decrypt_document(enc_payload, dek)
        
        # 4. Watermark Ref Derivation
        client_nonce = base64.b64encode(os.urandom(16)).decode()
        server_nonce = data["server_nonce"]
        sig_pk_hash = hash_sha256(self.sig_pk).hex()
        
        # wm_ref = SHAKE256(session_id || document_sha256 || recipient_signing_key_hash || client_nonce || server_nonce || watermark_algorithm_version)
        wm_input = (data["session_id"] + data["document_hash"] + sig_pk_hash + client_nonce + server_nonce + "dwt-dct-qim-v1").encode()
        wm_ref = hash_shake256(wm_input, 12)
        
        # 5. Embed Watermark
        wm_pdf = embed_watermark_pdf(plaintext_pdf, wm_ref)
        artifact_sha256 = hash_sha256(wm_pdf).hex()
        
        # 6. Construct Event
        event = {
            "event_version": 1,
            "event_id": f"evt_{uuid.uuid4().hex}",
            "session_id": data["session_id"],
            "document_id": document_id,
            "document_sha256": data["document_hash"],
            "recipient_id": self.agent_id,
            "recipient_signing_key_hash": sig_pk_hash,
            "watermark_ref": base64.b64encode(wm_ref).decode(),
            "watermark_algorithm": "dwt-dct-qim-v1",
            "client_nonce": client_nonce,
            "server_nonce": server_nonce,
            "artifact_sha256": artifact_sha256,
            "timestamp_unix": int(time.time()),
            "key_epoch": 1
        }
        
        # 7. Sign Event
        sig = sign_message(canonical_encode(event), self.sig_sk)
        
        # 8. Submit to Ledger
        tx = {
            "tx_id": hash_sha256(canonical_encode(event)).hex(),
            "event": event,
            "signature": base64.b64encode(sig).decode(),
            "public_key_reference": sig_pk_hash
        }
        
        success = False
        for url in self.ledger_urls:
            try:
                resp = httpx.post(f"{url}/submit_event", json=tx)
                if resp.status_code == 200:
                    success = True
                    break
            except Exception:
                pass
                
        if not success:
            raise Exception("Failed to submit event to ledger")
            
        # Optional: trigger block proposal on ledger
        try:
            httpx.post(f"{self.ledger_urls[0]}/propose_block")
        except:
            pass
            
        # 9. Wait for Finality
        time.sleep(1) # simulate polling
        
        # 10. Save file
        with open(out_path, "wb") as f:
            f.write(wm_pdf)
        
        return out_path, event
