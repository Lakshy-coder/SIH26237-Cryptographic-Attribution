import oqs

KEM_ALG = "ML-KEM-1024"

def generate_kem_keypair():
    with oqs.KeyEncapsulation(KEM_ALG) as client:
        public_key = client.generate_keypair()
        private_key = client.export_secret_key()
        return public_key, private_key

def encapsulate(public_key: bytes):
    with oqs.KeyEncapsulation(KEM_ALG) as client:
        ciphertext, shared_secret = client.encap_secret(public_key)
        return ciphertext, shared_secret

def decapsulate(ciphertext: bytes, private_key: bytes):
    with oqs.KeyEncapsulation(KEM_ALG, secret_key=private_key) as client:
        shared_secret = client.decap_secret(ciphertext)
        return shared_secret
