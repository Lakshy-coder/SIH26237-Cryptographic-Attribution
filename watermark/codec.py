import struct
import binascii

def encode_payload(watermark_ref: bytes, doc_tag: int = 0) -> bytes:
    """
    watermark_ref: 12 bytes (96 bits)
    doc_tag: 2 bytes (16 bits)
    Returns: 16 bytes (128 bits) with CRC16 appended.
    """
    assert len(watermark_ref) == 12
    payload = watermark_ref + struct.pack(">H", doc_tag)
    # calculate CRC16
    crc = binascii.crc_hqx(payload, 0)
    return payload + struct.pack(">H", crc)

def decode_payload(payload_with_crc: bytes):
    """
    Returns (watermark_ref, doc_tag, is_valid)
    """
    if len(payload_with_crc) != 16:
        return None, None, False
    payload = payload_with_crc[:14]
    extracted_crc = struct.unpack(">H", payload_with_crc[14:16])[0]
    expected_crc = binascii.crc_hqx(payload, 0)
    
    watermark_ref = payload[:12]
    doc_tag = struct.unpack(">H", payload[12:14])[0]
    return watermark_ref, doc_tag, (extracted_crc == expected_crc)

def bytes_to_bits(data: bytes) -> list[int]:
    bits = []
    for byte in data:
        for i in range(8):
            bits.append((byte >> (7 - i)) & 1)
    return bits

def bits_to_bytes(bits: list[int]) -> bytes:
    b = bytearray()
    for i in range(0, len(bits), 8):
        byte = 0
        for j in range(8):
            if i + j < len(bits):
                byte = (byte << 1) | bits[i + j]
        b.append(byte)
    return bytes(b)
