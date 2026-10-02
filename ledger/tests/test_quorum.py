import importlib.util
import os
import sys
import json
import base64
from fastapi.testclient import TestClient
from ledger.block import Block

# Helper to load a fresh copy of ledger.node with NODE_ID set
def load_node_module(node_id, module_name):
    env = os.environ.copy()
    env['NODE_ID'] = node_id
    # Load module from file with a unique name
    spec = importlib.util.spec_from_file_location(module_name, os.path.join(os.path.dirname(__file__), '..', 'node.py'))
    mod = importlib.util.module_from_spec(spec)
    # Inject env for module
    old_env = os.environ.copy()
    os.environ['NODE_ID'] = node_id
    try:
        spec.loader.exec_module(mod)
    finally:
        os.environ.clear()
        os.environ.update(old_env)
    return mod


def test_duplicate_validator_endorsements_do_not_satisfy_quorum():
    node1 = load_node_module('node_1', 'ledger_node1')
    node2 = load_node_module('node_2', 'ledger_node2')

    client1 = TestClient(node1.app)
    client2 = TestClient(node2.app)

    storage = node1.storage
    events = [{"tx_id": "tx1", "event": {"watermark_ref": "wm1"}}]
    block = Block(1, storage.get_latest_block().hash, events)
    block_dict = block.to_dict()

    # Get endorsement from node1
    r1 = client1.post('/endorse', json={"block_dict": block_dict})
    assert r1.status_code == 200
    endorsement = r1.json()

    # Build endorsements list with the same node twice
    endorsements = [endorsement, endorsement]
    block_dict['validator_signatures'] = endorsements

    # Populate trusted validators for node1 to include node_1 only
    node1.TRUSTED_VALIDATORS = {endorsement['node_id']: endorsement['public_key']}

    r = client1.post('/commit', json={"block_dict": block_dict})
    assert r.status_code == 400
    assert 'Insufficient distinct validator' in r.text


def test_two_distinct_validators_satisfy_quorum():
    node1 = load_node_module('node_1', 'ledger_node1')
    node2 = load_node_module('node_2', 'ledger_node2')
    node3 = load_node_module('node_3', 'ledger_node3')

    c1 = TestClient(node1.app)
    c2 = TestClient(node2.app)
    c3 = TestClient(node3.app)

    storage = node1.storage
    events = [{"tx_id": "tx2", "event": {"watermark_ref": "wm2"}}]
    block = Block(1, storage.get_latest_block().hash, events)
    block_dict = block.to_dict()

    e1 = c1.post('/endorse', json={"block_dict": block_dict}).json()
    e2 = c2.post('/endorse', json={"block_dict": block_dict}).json()

    block_dict['validator_signatures'] = [e1, e2]

    # Populate trusted validators with node1 and node2
    node1.TRUSTED_VALIDATORS = {e1['node_id']: e1['public_key'], e2['node_id']: e2['public_key']}

    r = c1.post('/commit', json={"block_dict": block_dict})
    assert r.status_code == 200
    assert r.json().get('status') == 'committed'


def test_invalid_validator_signature_is_rejected():
    node1 = load_node_module('node_1', 'ledger_node1')
    node2 = load_node_module('node_2', 'ledger_node2')

    c1 = TestClient(node1.app)
    c2 = TestClient(node2.app)

    storage = node1.storage
    events = [{"tx_id": "tx3", "event": {"watermark_ref": "wm3"}}]
    block = Block(1, storage.get_latest_block().hash, events)
    block_dict = block.to_dict()

    e1 = c1.post('/endorse', json={"block_dict": block_dict}).json()
    e2 = c2.post('/endorse', json={"block_dict": block_dict}).json()

    # Tamper e2 signature
    e2_tampered = dict(e2)
    e2_tampered['signature'] = e2_tampered['signature'][:-2] + 'AA'

    block_dict['validator_signatures'] = [e1, e2_tampered]

    node1.TRUSTED_VALIDATORS = {e1['node_id']: e1['public_key'], e2['node_id']: e2['public_key']}

    r = c1.post('/commit', json={"block_dict": block_dict})
    assert r.status_code == 400
    assert 'Invalid endorsement signature' in r.text


def test_unknown_validator_is_rejected():
    node1 = load_node_module('node_1', 'ledger_node1')
    c1 = TestClient(node1.app)

    storage = node1.storage
    events = [{"tx_id": "tx4", "event": {"watermark_ref": "wm4"}}]
    block = Block(1, storage.get_latest_block().hash, events)
    block_dict = block.to_dict()

    e1 = c1.post('/endorse', json={"block_dict": block_dict}).json()

    # Create fake endorsement with unknown node_id
    fake = {"node_id": "evil", "public_key": e1['public_key'], "signature": e1['signature']}
    block_dict['validator_signatures'] = [e1, fake]

    # Only trust e1.node_id
    node1.TRUSTED_VALIDATORS = {e1['node_id']: e1['public_key']}

    r = c1.post('/commit', json={"block_dict": block_dict})
    assert r.status_code == 400
    assert 'Unknown validator' in r.text


def test_same_validator_counted_once_only():
    node1 = load_node_module('node_1', 'ledger_node1')
    node2 = load_node_module('node_2', 'ledger_node2')

    c1 = TestClient(node1.app)
    c2 = TestClient(node2.app)

    storage = node1.storage
    events = [{"tx_id": "tx5", "event": {"watermark_ref": "wm5"}}]
    block = Block(1, storage.get_latest_block().hash, events)
    block_dict = block.to_dict()

    e1 = c1.post('/endorse', json={"block_dict": block_dict}).json()
    e1_dup = dict(e1)

    # Use e1 twice and e2 not provided
    block_dict['validator_signatures'] = [e1, e1_dup]
    node1.TRUSTED_VALIDATORS = {e1['node_id']: e1['public_key']}

    r = c1.post('/commit', json={"block_dict": block_dict})
    assert r.status_code == 400
    assert 'Insufficient distinct validator' in r.text


def test_missing_validator_does_not_count():
    node1 = load_node_module('node_1', 'ledger_node1')
    node2 = load_node_module('node_2', 'ledger_node2')

    c1 = TestClient(node1.app)

    storage = node1.storage
    events = [{"tx_id": "tx6", "event": {"watermark_ref": "wm6"}}]
    block = Block(1, storage.get_latest_block().hash, events)
    block_dict = block.to_dict()

    # Only get endorsement from node1
    e1 = c1.post('/endorse', json={"block_dict": block_dict}).json()
    block_dict['validator_signatures'] = [e1]

    node1.TRUSTED_VALIDATORS = {e1['node_id']: e1['public_key']}

    r = c1.post('/commit', json={"block_dict": block_dict})
    assert r.status_code == 400
    assert 'Insufficient' in r.text
