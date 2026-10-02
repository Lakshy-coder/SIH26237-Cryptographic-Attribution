import numpy as np
import pywt
import cv2

ALPHA = 10.0 # Embedding strength

def embed_image(image: np.ndarray, bits: list[int]) -> np.ndarray:
    """
    Embed a bit array into a single grayscale or colored image using DWT.
    """
    if len(image.shape) == 3:
        # colored image, embed in Y channel of YCrCb
        ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
        ycrcb[:,:,0] = embed_channel_blind(ycrcb[:,:,0], bits)
        return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
    else:
        return embed_channel_blind(image, bits)

def embed_channel(channel: np.ndarray, bits: list[int]) -> np.ndarray:
    coeffs = pywt.dwt2(channel, 'haar')
    LL, (HL, LH, HH) = coeffs
    
    # We will embed into HL band by modifying coefficients
    # This is a very basic spread spectrum / additive embedding
    np.random.seed(42) # Fixed seed for pseudo-random sequence
    h, w = HL.shape
    capacity = h * w
    
    # sequence to embed
    # repeat bits to fill capacity
    seq = []
    bit_len = len(bits)
    if bit_len == 0:
        return channel
        
    for i in range(capacity):
        seq.append(1 if bits[i % bit_len] == 1 else -1)
        
    seq = np.array(seq).reshape(h, w)
    
    # Modify HL
    HL = HL + ALPHA * seq
    
    # Inverse DWT
    coeffs = LL, (HL, LH, HH)
    channel_wm = pywt.idwt2(coeffs, 'haar')
    # Crop to original shape if needed
    h_orig, w_orig = channel.shape
    channel_wm = channel_wm[:h_orig, :w_orig]
    return np.clip(channel_wm, 0, 255).astype(np.uint8)

def extract_image(image: np.ndarray, orig_image: np.ndarray, bit_len: int) -> list[int]:
    """
    Extract bits from the watermarked image using the original image (non-blind).
    Wait, the spec says "extract token from leaked PDF". Typically, blind extraction is preferred.
    Let's implement a blind extraction using QIM or a known statistical property.
    If we use a fixed pseudorandom carrier, we can correlate.
    """
    if len(image.shape) == 3:
        ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
        return extract_channel(ycrcb[:,:,0], bit_len)
    else:
        return extract_channel(image, bit_len)

def embed_channel_blind(channel: np.ndarray, bits: list[int]) -> np.ndarray:
    # QIM (Quantization Index Modulation) for blind extraction
    coeffs = pywt.dwt2(channel, 'haar')
    LL, (HL, LH, HH) = coeffs
    
    DELTA = 30.0 # Quantization step
    
    h, w = HL.shape
    capacity = h * w
    bit_len = len(bits)
    if bit_len == 0: return channel
    
    idx = 0
    for i in range(h):
        for j in range(w):
            bit = bits[idx % bit_len]
            # Quantize
            val = HL[i, j]
            # If bit == 0, quantize to even multiple of DELTA
            # If bit == 1, quantize to odd multiple of DELTA
            if bit == 0:
                HL[i, j] = np.round(val / (2 * DELTA)) * 2 * DELTA
            else:
                HL[i, j] = np.round((val - DELTA) / (2 * DELTA)) * 2 * DELTA + DELTA
            idx += 1
            
    coeffs = LL, (HL, LH, HH)
    channel_wm = pywt.idwt2(coeffs, 'haar')
    h_orig, w_orig = channel.shape
    channel_wm = channel_wm[:h_orig, :w_orig]
    return np.clip(channel_wm, 0, 255).astype(np.uint8)

def extract_channel(channel: np.ndarray, bit_len: int) -> list[int]:
    # Extract using QIM
    coeffs = pywt.dwt2(channel, 'haar')
    LL, (HL, LH, HH) = coeffs
    
    DELTA = 30.0
    h, w = HL.shape
    
    # We collect votes for each bit
    votes = [0] * bit_len
    counts = [0] * bit_len
    
    idx = 0
    for i in range(h):
        for j in range(w):
            val = HL[i, j]
            # distance to even multiple
            dist0 = abs(val - np.round(val / (2 * DELTA)) * 2 * DELTA)
            # distance to odd multiple
            dist1 = abs(val - (np.round((val - DELTA) / (2 * DELTA)) * 2 * DELTA + DELTA))
            
            bit_idx = idx % bit_len
            if dist1 < dist0:
                votes[bit_idx] += 1
            else:
                votes[bit_idx] -= 1
            counts[bit_idx] += 1
            idx += 1
            
    # Majority vote
    extracted_bits = []
    for v in votes:
        if v > 0:
            extracted_bits.append(1)
        else:
            extracted_bits.append(0)
    return extracted_bits
