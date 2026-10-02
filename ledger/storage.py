from ledger.block import Block
from typing import List
import hashlib

class LedgerStorage:
    def __init__(self):
        self.chain: List[Block] = []
        # Genesis block
        genesis = Block(0, "0"*64, [])
        genesis.timestamp_unix = 0
        genesis.events_root = hashlib.sha256(b"").hexdigest()
        self.chain.append(genesis)
        
    def add_block(self, block: Block):
        self.chain.append(block)

    def get_latest_block(self) -> Block:
        return self.chain[-1]
        
    def get_block_by_height(self, height: int) -> Block:
        if height < len(self.chain):
            return self.chain[height]
        return None
