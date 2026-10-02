import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
import hashlib

def generate_dek() -> bytes:
    return os.urandom(32)

def derive_kek(shared_secret: bytes) -> bytes:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b'kem-kek-derivation'
    )
    return hkdf.derive(shared_secret)

def wrap_key(dek: bytes, kek: bytes) -> bytes:
    aesgcm = AESGCM(kek)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, dek, None)
    return nonce + ciphertext

def unwrap_key(wrapped_dek: bytes, kek: bytes) -> bytes:
    aesgcm = AESGCM(kek)
    nonce = wrapped_dek[:12]
    ciphertext = wrapped_dek[12:]
    return aesgcm.decrypt(nonce, ciphertext, None)

def encrypt_document(plaintext: bytes, dek: bytes) -> bytes:
    aesgcm = AESGCM(dek)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext

def decrypt_document(encrypted_doc: bytes, dek: bytes) -> bytes:
    aesgcm = AESGCM(dek)
    nonce = encrypted_doc[:12]
    ciphertext = encrypted_doc[12:]
    return aesgcm.decrypt(nonce, ciphertext, None)

def hash_sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()

def hash_shake256(data: bytes, length: int) -> bytes:
    return hashlib.shake_256(data).digest(length)
