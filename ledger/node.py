import os
import json
import asyncio
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from ledger.storage import LedgerStorage
from ledger.block import Block
from crypto.signatures import verify_signature, generate_sig_keypair, sign_message
import base64

app = FastAPI(title=f"Ledger Node {os.getenv('NODE_ID', 'node')}")
storage = LedgerStorage()
pending_events = []
proposal_lock = asyncio.Lock()

# Generate validator keypair
VALIDATOR_PK, VALIDATOR_SK = generate_sig_keypair()
VALIDATOR_PK_B64 = base64.b64encode(VALIDATOR_PK).decode('utf-8')

# Trusted validators mapping: node_id -> public_key_b64
# For MVP this can be populated at startup or modified in tests.
TRUSTED_VALIDATORS: dict = {}

LEDGER_URLS = os.getenv("LEDGER_URLS", "").split(",")

class DecryptionEventTx(BaseModel):
    tx_id: str
    event: Dict[str, Any]
    signature: str
    public_key_reference: str

class BlockProposal(BaseModel):
    block_dict: Dict[str, Any]

@app.post("/submit_event")
async def submit_event(tx: DecryptionEventTx):
    tx_id = tx.tx_id
    if any(existing.get("tx_id") == tx_id for existing in pending_events):
        return {"status": "accepted", "duplicate": True}
    pending_events.append(tx.model_dump())
    return {"status": "accepted"}

@app.post("/endorse")
async def endorse(proposal: BlockProposal):
    block = Block.from_dict(proposal.block_dict)
    latest = storage.get_latest_block()
    
    if block.height != latest.height + 1:
        raise HTTPException(status_code=400, detail="Invalid height")
    if block.previous_hash != latest.hash:
        raise HTTPException(status_code=400, detail="Invalid previous hash")
        
    # Verify merkle root
    if block.events_root != block.compute_merkle_root():
        raise HTTPException(status_code=400, detail="Invalid merkle root")
        
    # Real ML-DSA-65 signature over block hash
    message = block.hash.encode('utf-8')
    sig = sign_message(message, VALIDATOR_SK)
    endorsement_sig = base64.b64encode(sig).decode('utf-8')
    
    return {
        "node_id": os.getenv('NODE_ID'), 
        "public_key": VALIDATOR_PK_B64,
        "signature": endorsement_sig,
        "algorithm": "ML-DSA-65"
    }

@app.post("/commit")
async def commit(proposal: BlockProposal):
    block = Block.from_dict(proposal.block_dict)
    if block.height == storage.get_latest_block().height + 1:
        # We should verify the signatures in the block
        if len(block.validator_signatures) < 2:
            raise HTTPException(status_code=400, detail="Insufficient endorsements")

        # Enforce distinct validator identities: duplicate node_id endorsements do not increase quorum
        node_ids = [end.get("node_id") for end in block.validator_signatures]
        distinct_node_ids = set(node_ids)
        if len(distinct_node_ids) < 2:
            raise HTTPException(status_code=400, detail="Insufficient distinct validator endorsements")

        # Verify each endorsement signature cryptographically and against trusted registry
        for end in block.validator_signatures:
            node_id = end.get("node_id")
            pk_b64 = end.get("public_key")
            sig_b64 = end.get("signature")

            # Ensure we have a trusted public key for this node
            trusted_pk = TRUSTED_VALIDATORS.get(node_id)
            if trusted_pk is None:
                raise HTTPException(status_code=400, detail=f"Unknown validator: {node_id}")
            if trusted_pk != pk_b64:
                raise HTTPException(status_code=400, detail=f"Validator public key mismatch for {node_id}")

            try:
                pk = base64.b64decode(pk_b64)
                sig = base64.b64decode(sig_b64)
                msg = block.hash.encode('utf-8')
                if not verify_signature(msg, sig, pk):
                    raise HTTPException(status_code=400, detail="Invalid endorsement signature")
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid endorsement signature")
                
        storage.add_block(block)
        pending_events[:] = [
            e for e in pending_events
            if e.get("tx_id") not in {tx.get("tx_id") for tx in block.events}
        ]
        return {"status": "committed"}
    return {"status": "ignored"}

@app.post("/propose_block")
async def propose_block():
    async with proposal_lock:
        if not pending_events:
            return {"status": "no_events"}

        node_id = os.getenv("NODE_ID", "node_1")
        if node_id != "node_1":
            return {"status": "ignored", "reason": "not_leader"}

        latest = storage.get_latest_block()
        block = Block(
            height=latest.height + 1,
            previous_hash=latest.hash,
            events=pending_events.copy()
        )
        block.proposer_node_id = node_id

        # Collect endorsements
        block_dict = block.to_dict()
        endorsements = []

        async with httpx.AsyncClient() as client:
            for url in LEDGER_URLS:
                if url:
                    try:
                        resp = await client.post(f"{url}/endorse", json={"block_dict": block_dict})
                        if resp.status_code == 200:
                            endorsements.append(resp.json())
                    except Exception:
                        pass

        # M-of-N (2 of 3)
        if len(endorsements) >= 2:
            block.validator_signatures = endorsements
            block_dict = block.to_dict()

            # Commit to all
            async with httpx.AsyncClient() as client:
                for url in LEDGER_URLS:
                    if url:
                        try:
                            await client.post(f"{url}/commit", json={"block_dict": block_dict})
                        except Exception:
                            pass
            pending_events.clear()
            return {"status": "committed", "block_hash": block.hash, "height": block.height}
        else:
            raise HTTPException(status_code=500, detail="Failed to reach quorum")

@app.get("/chain")
def get_chain():
    return [b.to_dict() for b in storage.chain]

@app.get("/verify_chain")
def verify_chain():
    for i in range(1, len(storage.chain)):
        prev = storage.chain[i-1]
        curr = storage.chain[i]
        
        # Reconstruct block to check merkle
        if curr.events_root != curr.compute_merkle_root():
            return {"valid": False, "error_at_height": curr.height, "reason": "merkle"}
            
        if curr.previous_hash != prev.hash:
            return {"valid": False, "error_at_height": curr.height, "reason": "hash_link"}
    return {"valid": True}

@app.post("/tamper")
def tamper_block():
    if len(storage.chain) > 1:
        # modify an event in the latest block to change merkle root
        if storage.chain[-1].events:
            storage.chain[-1].events[0]["watermark_ref"] = "TAMPERED"
            return {"status": "tampered"}
    return {"status": "not_tampered"}
