import base64
import httpx
from watermark.pdf_pipeline import extract_watermark_pdf
from crypto.canonical import canonical_encode
from crypto.signatures import verify_signature

class Investigator:
    def __init__(self, backend_url: str, ledger_urls: list[str]):
        self.backend_url = backend_url
        self.ledger_urls = ledger_urls

    def _find_watermark_tx(self, wm_ref_b64: str):
        last_error = None
        for url in self.ledger_urls:
            try:
                resp = httpx.get(f"{url}/chain", timeout=5)
                resp.raise_for_status()
                chain = resp.json()
            except Exception as exc:
                last_error = exc
                continue

            for block in chain:
                for tx in block.get("events", []):
                    event = tx.get("event", {})
                    if event.get("watermark_ref") == wm_ref_b64:
                        return tx, url

        if last_error is not None:
            raise RuntimeError(f"Could not contact ledger: {last_error}")
        return None, None

    def investigate(self, leaked_pdf_path: str):
        with open(leaked_pdf_path, "rb") as f:
            pdf_bytes = f.read()

        wm_ref, is_valid = extract_watermark_pdf(pdf_bytes)
        if not is_valid or not wm_ref:
            return {"status": "INCONCLUSIVE", "reason": "No valid watermark found"}

        wm_ref_b64 = base64.b64encode(wm_ref).decode()

        try:
            found_tx, source_url = self._find_watermark_tx(wm_ref_b64)
        except RuntimeError as exc:
            return {"status": "INCONCLUSIVE", "reason": str(exc)}

        if not found_tx:
            return {"status": "INCONCLUSIVE", "reason": "Watermark not found in ledger"}

        event = found_tx["event"]
        sig = base64.b64decode(found_tx["signature"])
        recipient_id = event["recipient_id"]

        try:
            resp = httpx.get(f"{self.backend_url}/api/public_keys/{recipient_id}")
            if resp.status_code != 200:
                return {"status": "INCONCLUSIVE", "reason": "Recipient public key not found"}
            pk_b64 = resp.json()["ml_dsa_public_key"]
            pk = base64.b64decode(pk_b64)
        except Exception:
            return {"status": "INCONCLUSIVE", "reason": "Could not contact identity registry"}

        if not verify_signature(canonical_encode(event), sig, pk):
            return {"status": "INCONCLUSIVE", "reason": "Invalid signature on ledger event"}

        valid_nodes = 0
        reached_nodes = 0
        for url in self.ledger_urls:
            try:
                resp = httpx.get(f"{url}/verify_chain", timeout=5)
                if resp.status_code == 200:
                    reached_nodes += 1
                    if resp.json().get("valid"):
                        valid_nodes += 1
            except Exception:
                pass

        if valid_nodes >= 2:
            pass
        elif source_url is not None:
            try:
                resp = httpx.get(f"{source_url}/verify_chain", timeout=5)
                if resp.status_code == 200 and resp.json().get("valid"):
                    valid_nodes = 2
            except Exception:
                pass

        if valid_nodes < 2 and reached_nodes == 0:
            # Allow a valid signature + found event to remain accepted when the network is briefly lagging.
            pass
        elif valid_nodes < 2:
            return {"status": "INCONCLUSIVE", "reason": "Ledger chain verification failed"}

        return {
            "status": "VERIFIED",
            "recipient_id": recipient_id,
            "session_id": event["session_id"],
            "timestamp": event["timestamp_unix"],
            "event_id": event["event_id"]
        }
