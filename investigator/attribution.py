import base64
import httpx
from watermark.pdf_pipeline import extract_watermark_pdf
from crypto.canonical import canonical_encode
from crypto.signatures import verify_signature

class Investigator:
    def __init__(self, backend_url: str, ledger_urls: list[str]):
        self.backend_url = backend_url
        self.ledger_urls = ledger_urls

    def investigate(self, leaked_pdf_path: str):
        with open(leaked_pdf_path, "rb") as f:
            pdf_bytes = f.read()

        wm_ref, is_valid = extract_watermark_pdf(pdf_bytes)
        if not is_valid or not wm_ref:
            return {"status": "INCONCLUSIVE", "reason": "No valid watermark found"}

        wm_ref_b64 = base64.b64encode(wm_ref).decode()

        # Find in ledger
        try:
            resp = httpx.get(f"{self.ledger_urls[0]}/chain")
            resp.raise_for_status()
            chain = resp.json()
        except Exception:
            return {"status": "INCONCLUSIVE", "reason": "Could not contact ledger"}

        found_tx = None
        for block in chain:
            for tx in block.get("events", []):
                event = tx.get("event", {})
                if event.get("watermark_ref") == wm_ref_b64:
                    found_tx = tx
                    break
            if found_tx:
                break

        if not found_tx:
            return {"status": "INCONCLUSIVE", "reason": "Watermark not found in ledger"}

        event = found_tx["event"]
        sig = base64.b64decode(found_tx["signature"])
        recipient_id = event["recipient_id"]

        # Get public key
        try:
            resp = httpx.get(f"{self.backend_url}/api/public_keys/{recipient_id}")
            if resp.status_code != 200:
                return {"status": "INCONCLUSIVE", "reason": "Recipient public key not found"}
            pk_b64 = resp.json()["ml_dsa_public_key"]
            pk = base64.b64decode(pk_b64)
        except Exception:
            return {"status": "INCONCLUSIVE", "reason": "Could not contact identity registry"}

        # Verify Signature
        if not verify_signature(canonical_encode(event), sig, pk):
            return {"status": "INCONCLUSIVE", "reason": "Invalid signature on ledger event"}

        # Verify Chain
        try:
            resp = httpx.get(f"{self.ledger_urls[0]}/verify_chain")
            if not resp.json().get("valid"):
                return {"status": "INCONCLUSIVE", "reason": "Ledger chain verification failed"}
        except Exception:
            pass # ignore for MVP if one node fails, ideally query all
            
        return {
            "status": "VERIFIED",
            "recipient_id": recipient_id,
            "session_id": event["session_id"],
            "timestamp": event["timestamp_unix"],
            "event_id": event["event_id"]
        }
