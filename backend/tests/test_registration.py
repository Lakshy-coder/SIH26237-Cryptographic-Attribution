from fastapi.testclient import TestClient
from backend.app.main import app
import base64

client = TestClient(app)

def test_duplicate_recipient_registration():
    recipient_id = 'alice'
    pk = base64.b64encode(b'pk_bytes').decode()
    dsa = base64.b64encode(b'dsa_bytes').decode()

    resp = client.post('/api/register', json={
        'recipient_id': recipient_id,
        'ml_kem_public_key': pk,
        'ml_dsa_public_key': dsa
    })
    assert resp.status_code == 200
    assert resp.json().get('status') == 'ok'

    # Second registration should be rejected with 409
    resp2 = client.post('/api/register', json={
        'recipient_id': recipient_id,
        'ml_kem_public_key': pk,
        'ml_dsa_public_key': dsa
    })
    assert resp2.status_code == 409

    # Ensure original public key remains unchanged
    resp3 = client.get(f'/api/public_keys/{recipient_id}')
    assert resp3.status_code == 200
    data = resp3.json()
    assert data['ml_kem_public_key'] == pk
    assert data['ml_dsa_public_key'] == dsa
