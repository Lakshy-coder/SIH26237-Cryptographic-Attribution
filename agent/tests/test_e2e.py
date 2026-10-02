import os
import time
import base64
import pytest
import httpx
import fitz
from agent.recipient_agent import RecipientAgent
from investigator.attribution import Investigator

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
LEDGER_URLS = os.getenv("LEDGER_URLS", "http://validator1:8001").split(",")

@pytest.mark.skipif(not os.getenv("BACKEND_URL"), reason="Requires running backend")
def test_full_golden_flow():
    # 1. Create agent A and B
    agent_a = RecipientAgent("agent_A", BACKEND_URL, LEDGER_URLS)
    agent_b = RecipientAgent("agent_B", BACKEND_URL, LEDGER_URLS)
    
    agent_a.register()
    agent_b.register()
    
    # 2. Upload Document
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 50), "TOP SECRET", fontsize=30)
    pdf_bytes = doc.write()
    
    upload_resp = httpx.post(f"{BACKEND_URL}/api/documents", json={
        "recipient_ids": ["agent_A", "agent_B"],
        "plaintext_pdf_b64": base64.b64encode(pdf_bytes).decode()
    })
    assert upload_resp.status_code == 200
    doc_id = upload_resp.json()["document_id"]
    
    # 3. Agent A decrypts
    out_a = "artifact_a.pdf"
    path_a, event_a = agent_a.perform_decryption_flow(doc_id, out_a)
    
    # 4. Agent B decrypts
    out_b = "artifact_b.pdf"
    path_b, event_b = agent_b.perform_decryption_flow(doc_id, out_b)
    
    # 5. Assert watermarks differ
    assert event_a["watermark_ref"] != event_b["watermark_ref"]
    
    # 6. Investigate leaked file (Agent A's file)
    inv = Investigator(BACKEND_URL, LEDGER_URLS)
    report_a = inv.investigate(out_a)
    print("REPORT_A:", report_a)
    assert report_a["status"] == "VERIFIED"
    assert report_a["recipient_id"] == "agent_A"
    assert report_a["session_id"] == event_a["session_id"]
    
    # 7. Investigate leaked file (Agent B's file)
    report_b = inv.investigate(out_b)
    assert report_b["status"] == "VERIFIED"
    assert report_b["recipient_id"] == "agent_B"
    assert report_b["session_id"] == event_b["session_id"]
    
    # 8. Tamper Simulation
    # Get the ledger chain directly
    chain_resp = httpx.get(f"{LEDGER_URLS[0]}/chain")
    chain = chain_resp.json()
    
    # Call the tamper endpoint to simulate an admin maliciously modifying the DB
    tamper_resp = httpx.post(f"{LEDGER_URLS[0]}/tamper")
    assert tamper_resp.status_code == 200
    
    # Verify the chain is now invalid
    verify_resp = httpx.get(f"{LEDGER_URLS[0]}/verify_chain")
    assert verify_resp.json()["valid"] == False

    # 9. Verify invalid/tampered provenance cannot be accepted as valid evidence
    report_tampered = inv.investigate(out_a)
    assert report_tampered["status"] == "INCONCLUSIVE"
