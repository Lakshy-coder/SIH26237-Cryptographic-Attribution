from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Request
from pydantic import BaseModel
from typing import List, Dict, Any
from sqlalchemy.orm import Session
import uuid
import base64

from backend.app.db import get_db, Recipient, Document, Envelope
import os
import tempfile
import hashlib
from investigator.attribution import Investigator
from crypto.kem import KEM_ALG
from crypto.signatures import SIG_ALG
from crypto.symmetric import generate_dek, encrypt_document, hash_sha256

router = APIRouter()

class RegisterRequest(BaseModel):
    recipient_id: str
    ml_kem_public_key: str
    ml_dsa_public_key: str

@router.post("/register")
def register_recipient(req: RegisterRequest, db: Session = Depends(get_db)):
    rec = db.query(Recipient).filter(Recipient.id == req.recipient_id).first()
    if rec:
        # Prevent silent overwrite of an existing recipient's cryptographic identity.
        raise HTTPException(status_code=409, detail="Recipient already registered")

    rec = Recipient(id=req.recipient_id)
    rec.ml_kem_public_key = base64.b64decode(req.ml_kem_public_key)
    rec.ml_dsa_public_key = base64.b64decode(req.ml_dsa_public_key)
    db.add(rec)
    db.commit()
    return {"status": "ok"}

@router.get("/public_keys/{recipient_id}")
def get_public_keys(recipient_id: str, db: Session = Depends(get_db)):
    rec = db.query(Recipient).filter(Recipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(404, "Not found")
    return {
        "ml_kem_public_key": base64.b64encode(rec.ml_kem_public_key).decode('utf-8'),
        "ml_dsa_public_key": base64.b64encode(rec.ml_dsa_public_key).decode('utf-8')
    }

class DocumentUploadRequest(BaseModel):
    recipient_ids: List[str]
    plaintext_pdf_b64: str

@router.post("/documents")
def upload_document(req: DocumentUploadRequest, db: Session = Depends(get_db)):
    # Encrypt document
    dek = generate_dek()
    doc_bytes = base64.b64decode(req.plaintext_pdf_b64)
    enc_payload = encrypt_document(doc_bytes, dek)
    doc_hash = hash_sha256(doc_bytes)
    doc_id = f"doc_{uuid.uuid4().hex}"
    
    doc = Document(id=doc_id, encrypted_payload=enc_payload, doc_hash=doc_hash.hex())
    db.add(doc)
    
    # Envelopes
    from crypto.kem import encapsulate
    from crypto.symmetric import derive_kek, wrap_key
    
    for rid in req.recipient_ids:
        rec = db.query(Recipient).filter(Recipient.id == rid).first()
        if rec:
            pk = rec.ml_kem_public_key
            ct, ss = encapsulate(pk)
            kek = derive_kek(ss)
            wrapped_dek = wrap_key(dek, kek)
            
            # Pack ct + wrapped_dek
            envelope_data = ct + wrapped_dek
            env = Envelope(document_id=doc_id, recipient_id=rid, wrapped_dek=envelope_data)
            db.add(env)
            
    db.commit()
    return {"status": "ok", "document_id": doc_id}

class SessionRequest(BaseModel):
    document_id: str
    recipient_id: str

@router.post("/sessions")
def create_session(req: SessionRequest, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == req.document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
        
    env = db.query(Envelope).filter(Envelope.document_id == req.document_id, Envelope.recipient_id == req.recipient_id).first()
    if not env:
        raise HTTPException(403, "Not authorized")
        
    session_id = f"sess_{uuid.uuid4().hex}"
    import os
    server_nonce = base64.b64encode(os.urandom(16)).decode('utf-8')
    
    return {
        "session_id": session_id,
        "server_nonce": server_nonce,
        "document_hash": doc.doc_hash,
        "encrypted_payload_b64": base64.b64encode(doc.encrypted_payload).decode('utf-8'),
        "envelope_b64": base64.b64encode(env.wrapped_dek).decode('utf-8')
    }


@router.post("/investigate")
async def investigate_artifact(request: Request, file: UploadFile = File(...)):
    """Accept an uploaded leaked PDF via multipart/form-data and proxy to the Investigator.

    Returns a structured JSON result from the Investigator implementation.
    """
    contents = await file.read()

    # Build investigator using environment-configured ledger URLs (docker-compose sets LEDGER_URLS)
    ledger_urls = os.getenv("LEDGER_URLS", "http://validator1:8001,http://validator2:8002,http://validator3:8003").split(",")

    # Derive backend_url from the incoming request's base URL so Investigator can call identity registry.
    base = str(request.base_url).rstrip('/')

    inv = Investigator(backend_url=base, ledger_urls=[u.strip() for u in ledger_urls if u.strip()])

    try:
        result = inv.investigate(contents)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Ensure response is JSON serializable
    return result
