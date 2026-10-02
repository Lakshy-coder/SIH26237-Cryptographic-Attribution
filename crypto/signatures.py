import oqs

SIG_ALG = "ML-DSA-65"

def generate_sig_keypair():
    with oqs.Signature(SIG_ALG) as signer:
        public_key = signer.generate_keypair()
        private_key = signer.export_secret_key()
        return public_key, private_key

def sign_message(message: bytes, private_key: bytes) -> bytes:
    with oqs.Signature(SIG_ALG, secret_key=private_key) as signer:
        signature = signer.sign(message)
        return signature

def verify_signature(message: bytes, signature: bytes, public_key: bytes) -> bool:
    with oqs.Signature(SIG_ALG) as verifier:
        return verifier.verify(message, signature, public_key)
