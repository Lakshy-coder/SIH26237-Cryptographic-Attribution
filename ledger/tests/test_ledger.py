import pytest
from ledger.block import Block
from ledger.storage import LedgerStorage

def test_ledger_storage():
    storage = LedgerStorage()
    assert len(storage.chain) == 1
    assert storage.chain[0].height == 0
    
    events = [{"tx_id": "1", "data": "test"}]
    b = Block(1, storage.chain[0].hash, events)
    storage.add_block(b)
    
    assert len(storage.chain) == 2
    assert storage.get_latest_block().height == 1
    
    assert b.events_root != storage.chain[0].events_root
    
def test_merkle_root():
    events = [{"id": 1}, {"id": 2}, {"id": 3}]
    b = Block(1, "0000", events)
    
    # modify event should change root
    events2 = [{"id": 1}, {"id": 2}, {"id": 4}]
    b2 = Block(1, "0000", events2)
    
    assert b.events_root != b2.events_root
