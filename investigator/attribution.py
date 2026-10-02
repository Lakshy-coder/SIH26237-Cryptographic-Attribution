import base64
import httpx
import hashlib
from watermark.pdf_pipeline import extract_watermark_pdf
from crypto.canonical import canonical_encode
from crypto.signatures import verify_signature
from ledger.block import Block

class Investigator:
    def __init__(self, backend_url: str, ledger_urls: list[str]):
        self.backend_url = backend_url
        self.ledger_urls = ledger_urls

    def _find_watermark_tx(self, wm_ref_b64: str):
        """Search all configured ledger nodes for a transaction referencing wm_ref_b64.

        Returns a tuple (tx, block_dict, source_url) or (None, None, None).
        """
        last_error = None
        for url in self.ledger_urls:
            try:
                resp = httpx.get(f"{url}/chain", timeout=5)
                resp.raise_for_status()
                chain = resp.json()
            except Exception as exc:
                last_error = exc
                continue

            # Validate chain integrity for this node before trusting blocks
            try:
                prev_hash = None
                for b in chain:
                    block = Block.from_dict(b)
                    # check merkle root
                    if block.events_root != block.compute_merkle_root():
                        raise RuntimeError("merkle_mismatch")
                    if prev_hash is not None and block.previous_hash != prev_hash:
                        raise RuntimeError("hash_link_mismatch")
                    prev_hash = block.hash
            except Exception:
                # Skip nodes with invalid chain
                continue

            for block in chain:
                for tx in block.get("events", []):
                    event = tx.get("event", {})
                    if event.get("watermark_ref") == wm_ref_b64:
                        return tx, block, url

        if last_error is not None:
            raise RuntimeError(f"Could not contact ledger: {last_error}")
        return None, None, None

    def investigate(self, leaked_pdf_bytes: bytes):
        pdf_bytes = leaked_pdf_bytes

        wm_ref, is_valid = extract_watermark_pdf(pdf_bytes)
        if not is_valid or not wm_ref:
            return {"status": "INCONCLUSIVE", "reason": "No valid watermark found"}

        wm_ref_b64 = base64.b64encode(wm_ref).decode()

        try:
            found_tx, found_block, source_url = self._find_watermark_tx(wm_ref_b64)
        except RuntimeError as exc:
            return {"status": "INCONCLUSIVE", "reason": str(exc)}

        if not found_tx:
            return {"status": "INCONCLUSIVE", "reason": "Watermark not found in ledger"}

        event = found_tx["event"]
        sig = base64.b64decode(found_tx.get("signature", ""))
        recipient_id = event.get("recipient_id")

        # Retrieve recipient public key and verify recipient's ML-DSA signature over the canonical event
        try:
            resp = httpx.get(f"{self.backend_url}/api/public_keys/{recipient_id}")
            if resp.status_code != 200:
                return {"status": "INCONCLUSIVE", "reason": "Recipient public key not found"}
            pk_b64 = resp.json().get("ml_dsa_public_key")
            pk = base64.b64decode(pk_b64)
        except Exception:
            return {"status": "INCONCLUSIVE", "reason": "Could not contact identity registry"}

        if not verify_signature(canonical_encode(event), sig, pk):
            return {"status": "INCONCLUSIVE", "reason": "Invalid signature on ledger event"}

        # Artifact hash binding: compute SHA-256 of the leaked artifact and compare
        artifact_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
        if event.get("artifact_sha256") != artifact_sha256 and event.get("artifact_sha256") != artifact_sha256.lower():
            return {"status": "INCONCLUSIVE", "reason": "Artifact hash does not match authenticated provenance"}

        # Validate block-level endorsements: distinct validator node ids, valid signatures, and merkle
        try:
            block = Block.from_dict(found_block)
        except Exception:
            return {"status": "INCONCLUSIVE", "reason": "Malformed block from ledger"}

        # Verify merkle root and linkage is consistent (block object validates via compute_merkle_root)
        if block.events_root != block.compute_merkle_root():
            return {"status": "INCONCLUSIVE", "reason": "Invalid merkle root on block"}

        valid_validator_ids = set()
        for endorsement in block.validator_signatures:
            node_id = endorsement.get("node_id")
            pk_b64 = endorsement.get("public_key")
            sig_b64 = endorsement.get("signature")
            if not node_id or not pk_b64 or not sig_b64:
                continue
            try:
                end_pk = base64.b64decode(pk_b64)
                end_sig = base64.b64decode(sig_b64)
                msg = block.hash.encode('utf-8')
                if verify_signature(msg, end_sig, end_pk):
                    valid_validator_ids.add(node_id)
            except Exception:
                continue

        # Strict quorum: count DISTINCT validator ids with valid signatures
        if len(valid_validator_ids) < 2:
            return {"status": "INCONCLUSIVE", "reason": "Insufficient distinct validator endorsements"}

        # If we reached here, all checks passed for a VERIFIED result
        return {
            "status": "VERIFIED",
            "recipient_id": recipient_id,
            "watermark_ref": wm_ref_b64,
            "session_id": event.get("session_id"),
            "document_id": event.get("document_id"),
            "artifact_sha256": artifact_sha256,
            "signature_status": "VALID",
            "ledger_status": "PRESENT",
            "merkle_status": True,
            "hash_link_status": True,
            "provenance_status": "VERIFIED",
            "reason": None
        }
