import time
import json
import hashlib
from typing import List, Dict, Any

class Block:
    def __init__(self, height: int, previous_hash: str, events: List[Dict[str, Any]]):
        self.height = height
        self.previous_hash = previous_hash
        self.events = events
        self.timestamp_unix = int(time.time())
        self.events_root = self.compute_merkle_root()
        self.proposer_node_id = ""
        self.proposer_signature = ""
        self.validator_signatures = []

    def compute_merkle_root(self):
        if not self.events:
            return hashlib.sha256(b"").hexdigest()
        
        hashes = [hashlib.sha256(json.dumps(e, sort_keys=True).encode()).hexdigest() for e in self.events]
        
        while len(hashes) > 1:
            if len(hashes) % 2 != 0:
                hashes.append(hashes[-1])
            new_hashes = []
            for i in range(0, len(hashes), 2):
                new_hashes.append(hashlib.sha256((hashes[i] + hashes[i+1]).encode()).hexdigest())
            hashes = new_hashes
        return hashes[0]

    def to_dict(self):
        return {
            "height": self.height,
            "previous_hash": self.previous_hash,
            "events_root": self.events_root,
            "timestamp_unix": self.timestamp_unix,
            "proposer_node_id": self.proposer_node_id,
            "proposer_signature": self.proposer_signature,
            "validator_signatures": self.validator_signatures,
            "events": self.events
        }

    @property
    def hash(self):
        d = self.to_dict()
        # Exclude signatures for block hash calculation
        d.pop("proposer_signature", None)
        d.pop("validator_signatures", None)
        return hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()

    @classmethod
    def from_dict(cls, data: dict):
        b = cls(data["height"], data["previous_hash"], data["events"])
        b.timestamp_unix = data["timestamp_unix"]
        b.events_root = data["events_root"]
        b.proposer_node_id = data["proposer_node_id"]
        b.proposer_signature = data.get("proposer_signature", "")
        b.validator_signatures = data.get("validator_signatures", [])
        return b
