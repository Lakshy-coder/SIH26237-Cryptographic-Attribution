import fitz  # PyMuPDF
import cv2
import numpy as np
from watermark.dwt_watermark import embed_image, extract_image
from watermark.codec import encode_payload, decode_payload, bytes_to_bits, bits_to_bytes

def embed_watermark_pdf(pdf_bytes: bytes, watermark_ref: bytes) -> bytes:
    # 1. create payload
    payload = encode_payload(watermark_ref)
    bits = bytes_to_bits(payload)
    
    # 2. open PDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    out_pdf = fitz.open()
    
    # 3. rasterize and embed
    for i in range(len(doc)):
        page = doc[i]
        pix = page.get_pixmap(dpi=150)
        img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        
        # Convert to BGR for cv2
        if pix.n == 4:
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        elif pix.n == 1:
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
        else:
            img_bgr = img_np
            
        wm_img = embed_image(img_bgr, bits)
        
        # Convert back to RGB
        wm_rgb = cv2.cvtColor(wm_img, cv2.COLOR_BGR2RGB)
        
        # Add to output PDF
        out_page = out_pdf.new_page(width=page.rect.width, height=page.rect.height)
        img_rect = fitz.Rect(0, 0, page.rect.width, page.rect.height)
        out_page.insert_image(img_rect, stream=cv2.imencode('.png', wm_rgb)[1].tobytes())
        
    return out_pdf.write()

def extract_watermark_pdf(pdf_bytes: bytes) -> tuple[bytes, bool]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    # Try extracting from first page
    if len(doc) == 0:
        return b"", False
        
    page = doc[0]
    # Extract images from page
    # Since we reconstructed it using insert_image, we should just rasterize the page itself or extract the image.
    # Rasterizing the page is robust.
    pix = page.get_pixmap(dpi=150)
    img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    
    if pix.n == 4:
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
    elif pix.n == 3:
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    elif pix.n == 1:
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
    else:
        img_bgr = img_np
        
    extracted_bits = extract_image(img_bgr, None, 128)
    extracted_bytes = bits_to_bytes(extracted_bits)
    
    wm_ref, doc_tag, is_valid = decode_payload(extracted_bytes)
    if is_valid:
        return wm_ref, True
        
    # majority vote across pages could be added here
    return (wm_ref if wm_ref else b""), False
