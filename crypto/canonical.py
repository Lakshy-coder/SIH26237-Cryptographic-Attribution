import json

def canonical_encode(event_dict: dict) -> bytes:
    """Encode dictionary to canonical JSON bytes."""
    return json.dumps(event_dict, separators=(',', ':'), sort_keys=True).encode('utf-8')
