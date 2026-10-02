import pytest
from crypto.kem import generate_kem_keypair, encapsulate, decapsulate
from crypto.signatures import generate_sig_keypair, sign_message, verify_signature
from crypto.symmetric import generate_dek, derive_kek, wrap_key, unwrap_key, encrypt_document, decrypt_document
from crypto.canonical import canonical_encode

def test_kem():
    pk, sk = generate_kem_keypair()
    ct, ss1 = encapsulate(pk)
    ss2 = decapsulate(ct, sk)
    assert ss1 == ss2

def test_signatures():
    pk, sk = generate_sig_keypair()
    msg = b"hello world"
    sig = sign_message(msg, sk)
    assert verify_signature(msg, sig, pk)
    assert not verify_signature(b"wrong", sig, pk)

def test_symmetric():
    dek = generate_dek()
    ss = b"shared_secret_bytes_123456789012"
    kek = derive_kek(ss)
    wrapped = wrap_key(dek, kek)
    unwrapped = unwrap_key(wrapped, kek)
    assert dek == unwrapped

    doc = b"secret pdf content"
    enc = encrypt_document(doc, dek)
    dec = decrypt_document(enc, dek)
    assert doc == dec

def test_canonical():
    d1 = {"b": 2, "a": 1}
    d2 = {"a": 1, "b": 2}
    assert canonical_encode(d1) == canonical_encode(d2)
    assert canonical_encode(d1) == b'{"a":1,"b":2}'
