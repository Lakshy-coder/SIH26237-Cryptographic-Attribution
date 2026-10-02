import pytest
import fitz
from watermark.codec import encode_payload, decode_payload, bytes_to_bits, bits_to_bytes
from watermark.pdf_pipeline import embed_watermark_pdf, extract_watermark_pdf

def test_codec():
    wm_ref = b"123456789012"
    payload = encode_payload(wm_ref, 42)
    assert len(payload) == 16
    
    bits = bytes_to_bits(payload)
    assert len(bits) == 128
    
    payload_out = bits_to_bytes(bits)
    assert payload_out == payload
    
    wm_ref_out, doc_tag, is_valid = decode_payload(payload_out)
    assert is_valid
    assert wm_ref_out == wm_ref
    assert doc_tag == 42

def test_pdf_pipeline():
    # generate a dummy pdf
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 50), "Hello World Secret Document", fontsize=24)
    pdf_bytes = doc.write()
    
    wm_ref = b"123456789012"
    
    # embed
    wm_pdf = embed_watermark_pdf(pdf_bytes, wm_ref)
    
    # extract
    ext_wm, is_valid = extract_watermark_pdf(wm_pdf)
    assert is_valid
    assert ext_wm == wm_ref
