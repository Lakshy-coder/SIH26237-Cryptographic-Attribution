# SIH26237 — Cryptographic Attribution & Immutable Decryption Provenance

> **SIH 2026 | Blockchain & Cybersecurity**
>
> A fully local provenance system for attributing leaked copies of multi-recipient encrypted documents using **forensic watermarking + post-quantum signatures + a permissioned quorum-protected ledger**.

---

## The Problem

When one confidential document is encrypted and distributed to multiple authorized recipients, each recipient may receive the same plaintext. If one copy leaks, the leaked file itself can be indistinguishable from the copies held by the other recipients.

Traditional server logs can also be insufficient as forensic evidence when a privileged administrator can edit or delete them. A static watermark does not solve the problem because every recipient receives the same marker.

### The missing capability

> **A leaked document needs a unique forensic identity that can be cryptographically tied to the exact recipient and decryption session, with independently verifiable provenance.**

---

## Our Solution

SIH26237 adds a provenance layer to the decryption path:

```text
Encrypted Document
        │
        ▼
Recipient Local Decryption Agent
        │
        ├── ML-KEM-1024 decapsulation
        ├── AES-256-GCM decryption
        ├── Session/recipient-specific watermark reference
        ├── Invisible transform-domain watermark
        ├── Artifact hash
        └── ML-DSA-65 signed decryption event
                         │
                         ▼
               Permissioned Ledger
                 3 Validators
                    2-of-3
                         │
                         ▼
                Final provenance record
                         │
                         ▼
                 Released PDF copy
                         │
                       LEAK
                         │
                         ▼
                 Investigator Service
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       Extract watermark      Verify provenance
              │                     │
              └──────────┬──────────┘
                         ▼
                 Recipient attribution
```

---

## Core Idea

Recipients should be able to hold **visually identical documents** while the system creates **forensically distinct digital copies**.

The watermark is created **at the moment of decryption**, not at upload time.

The event that generated that copy is then signed by the recipient's private post-quantum signing key and recorded in a permissioned ledger.

This separates two jobs:

- **Watermark = evidence embedded in the leaked artifact**
- **Signature + ledger = verifiable provenance for that evidence**

---

# Technical Architecture

```text
                         AIR-GAPPED / OFFLINE NETWORK
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Sender UI              Backend / FastAPI                Investigator UI │
│     │                         │                                │         │
│     └───────────────► Document + Identity Services ◄──────────┘         │
│                               │                                         │
│                        PostgreSQL / Blob                               │
│                               │                                         │
│               ┌───────────────┴───────────────┐                         │
│               │                               │                         │
│        Recipient A Agent               Recipient B Agent                │
│        private keys local               private keys local               │
│               │                               │                         │
│               └───────────────┬───────────────┘                         │
│                               ▼                                         │
│                     Signed provenance event                            │
│                               │                                         │
│                         ┌─────┴─────┐                                   │
│                         ▼           ▼                                   │
│                      Validator 1  Validator 2      Validator 3          │
│                         └─────┬─────┴───────────────┬───────┘            │
│                               ▼                     │                    │
│                         2-of-3 Quorum              │                    │
│                               ▼                     │                    │
│                       Final ledger block ◄──────────┘                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Trust boundaries

**Server zone:** stores encrypted payloads and coordinates requests.

**Recipient zone:** owns and uses recipient private keys.

**Ledger zone:** independently endorses provenance state.

**Investigator zone:** validates a leaked artifact against cryptographic records.

---

# Cryptography

## Post-Quantum Cryptography

The MVP uses actual liboqs/liboqs-python operations:

- **ML-KEM-1024** for post-quantum key encapsulation.
- **ML-DSA-65** for post-quantum signatures.

Implemented in:

```text
crypto/kem.py
crypto/signatures.py
```

## Symmetric Encryption

Document payload encryption uses:

- AES-256-GCM
- randomized nonce
- HKDF-SHA256 for key derivation/wrapping

Implemented in:

```text
crypto/symmetric.py
```

## Canonical Events

Before signing, the decryption event is converted to deterministic canonical JSON so that the signer and verifier operate on the exact same byte representation.

Implemented in:

```text
crypto/canonical.py
```

---

# Recipient Decryption Agent

The central security boundary is the local Recipient Agent.

```text
Recipient
   │
   ▼
Local Agent
   │
   ├── Load recipient private key
   ├── ML-KEM-1024 decapsulation
   ├── Unwrap/decrypt content key
   ├── AES-256-GCM document decryption
   ├── Generate watermark reference
   ├── Embed watermark
   ├── Hash final artifact
   ├── Build canonical DecryptionEvent
   ├── ML-DSA-65 sign event
   └── Wait for ledger finality
            │
            ▼
      Save/release artifact
```

Implemented in:

```text
agent/recipient_agent.py
```

A release is blocked when the required provenance commit is not accepted.

---

# Forensic Watermarking

## 128-bit Payload

```text
┌──────────────────────┬────────────────┬──────────────┐
│ 96-bit watermark_ref │ 16-bit doc_tag │ 16-bit CRC16 │
└──────────────────────┴────────────────┴──────────────┘
```

## Watermark Reference

The reference is derived from session/document/recipient context using SHAKE256.

Conceptually:

```text
wm_ref = SHAKE256(
    session_id ||
    document_sha256 ||
    recipient_key_hash ||
    client_nonce ||
    server_nonce ||
    watermark_algorithm_version
)
```

The result is compact and suitable for embedding while the signed ledger event stores the complete provenance context.

## Embedding Pipeline

```text
PDF
 │
 ▼
PyMuPDF rasterization
 │
 ▼
NumPy image matrix
 │
 ▼
2D Haar DWT
 │
 ▼
QIM-style embedding + redundancy
 │
 ▼
Inverse DWT / image reconstruction
 │
 ▼
Watermarked PDF
```

Implemented in:

```text
watermark/codec.py
watermark/dwt_watermark.py
watermark/pdf_pipeline.py
```

### Forensic investigation

```text
Leaked PDF
    │
    ▼
Rasterize page(s)
    │
    ▼
Read repeated watermark blocks
    │
    ▼
Statistical majority voting
    │
    ▼
CRC validation
    │
    ▼
Recover watermark_ref
```

The watermark is designed to be forensically useful, not mathematically guaranteed to survive every possible transformation or removal technique.

---

# Signed Decryption Provenance

A conceptual event looks like:

```json
{
  "event_id": "...",
  "document_id": "...",
  "recipient_id": "...",
  "session_id": "...",
  "watermark_ref": "...",
  "artifact_hash": "...",
  "algorithm_version": "...",
  "timestamp": "..."
}
```

The canonical event is signed using ML-DSA-65.

```text
Canonical Event
      │
      ▼
ML-DSA-65 Signature
      │
      ▼
Signed Provenance Event
```

Implemented in:

```text
agent/recipient_agent.py
crypto/signatures.py
```

---

# Permissioned Provenance Ledger

The MVP deliberately avoids a public blockchain.

Instead it uses a local, permissioned validator topology with hash-linked blocks and Merkle roots.

```text
                    Signed Event
                         │
                         ▼
                    Propose Block
                   /      |      \
                  ▼       ▼       ▼
           Validator1 Validator2 Validator3
                  \       |       /
                   \      |      /
                    └─ 2 of 3 ─┘
                         │
                         ▼
                   Final Commit
```

### Integrity model

```text
Events
  ↓
Merkle Root
  ↓
Block Hash
  ↓
Previous Block Hash
  ↓
Validator Endorsements
  ↓
Final Block
```

Implemented in:

```text
ledger/block.py
ledger/storage.py
ledger/node.py
```

### Tamper handling

If a ledger event or block integrity check fails, the investigator does not silently treat the record as trusted evidence. The current MVP returns **INCONCLUSIVE** when provenance verification cannot be established.

---

# Leak Attribution Flow

```text
                 LEAKED PDF
                     │
                     ▼
             Watermark Extraction
                     │
                     ▼
                 CRC Check
                     │
                     ▼
             watermark_ref lookup
                     │
                     ▼
            Provenance Event Found
                     │
              ┌──────┴───────┐
              ▼              ▼
        ML-DSA Verify    Ledger Verify
              │              │
              └──────┬───────┘
                     ▼
              Attribution Report
```

### Example Golden Flow

```text
artifact_a.pdf  →  watermark_ref_A  →  agent_A  →  VALID
artifact_b.pdf  →  watermark_ref_B  →  agent_B  →  VALID
```

### Tampered evidence

```text
Ledger tampered
      ↓
Merkle/hash-link verification fails
      ↓
INCONCLUSIVE
```

This prevents a manipulated provenance record from being presented as verified attribution.

---

# Repository Structure

```text
.
├── agent/
│   ├── recipient_agent.py
│   └── tests/
│       └── test_e2e.py
│
├── backend/
│   └── app/
│       ├── main.py
│       ├── db.py
│       └── api/
│           └── endpoints.py
│
├── crypto/
│   ├── canonical.py
│   ├── kem.py
│   ├── signatures.py
│   ├── symmetric.py
│   └── tests/
│       └── test_crypto.py
│
├── investigator/
│   └── attribution.py
│
├── ledger/
│   ├── block.py
│   ├── storage.py
│   ├── node.py
│   └── tests/
│       └── test_ledger.py
│
├── watermark/
│   ├── codec.py
│   ├── dwt_watermark.py
│   ├── pdf_pipeline.py
│   └── tests/
│       └── test_watermark.py
│
├── frontend/
│   └── (static placeholder in current MVP)
│
├── docker/
│   ├── Dockerfile.python
│   └── requirements.txt
│
├── docker-compose.yml
├── requirements.txt
├── PRD.md
├── LICENSE
└── README.md
```

---

# Run the MVP

## Prerequisites

- Docker Desktop / Docker Engine with Compose
- CPU/RAM sufficient to build the Python + PQC image
- No cloud account is required for runtime execution

## Start services

```bash
docker compose up -d db backend validator1 validator2 validator3
```

Expected topology:

```text
db
backend
validator1
validator2
validator3
```

## Run complete test suite

```bash
docker compose run --rm tests
```

### Verified audit result

```text
1 failed, 8 passed in 17.07s
```

The verified run covered:

- KEM
- signatures
- symmetric encryption
- canonical encoding
- watermark codec
- PDF watermark pipeline
- ledger storage
- Merkle root generation
- end-to-end Golden Flow
- tamper detection through the Golden Flow

---

# Demo Script

For a short technical demonstration:

### 1. Start infrastructure

```bash
docker compose up -d db backend validator1 validator2 validator3
```

### 2. Run tests

```bash
docker compose run --rm tests
```

### 3. Explain the visible outcome

```text
Recipient A decrypts
        ↓
A-specific watermark
        ↓
A signs provenance
        ↓
2-of-3 ledger quorum
        ↓
A's PDF released

Recipient B decrypts
        ↓
B-specific watermark
        ↓
B signs provenance
        ↓
2-of-3 ledger quorum
        ↓
B's PDF released

Leak A
  ↓
watermark extraction
  ↓
ledger + signature verification
  ↓
A attributed
```

### 4. Tamper demonstration

Modify a validator's stored event using the existing MVP tamper route, then run investigation/verification again.

Expected security behavior:

```text
Integrity failure
      ↓
INCONCLUSIVE
```

---

# Validation Status

| Capability | Status |
|---|---|
| ML-KEM-1024 | ✅ Verified |
| ML-DSA-65 recipient signatures | ✅ Verified |
| AES-256-GCM | ✅ Verified |
| HKDF-SHA256 | ✅ Verified |
| PDF watermarking | ✅ Verified |
| Watermark extraction | ✅ Verified in Golden Flow |
| Recipient-specific attribution | ✅ Verified |
| 3-node permissioned ledger | ✅ Verified |
| 2-of-3 quorum | ✅ Verified |
| Merkle/hash-link validation | ✅ Verified |
| Tamper detection | ✅ Verified |
| Offline/local runtime | ✅ Verified |
| React frontend integration | ⚠️ Not integrated in current MVP |

---

# Security Design Notes

## What this system establishes

The MVP is designed to establish a chain of evidence connecting:

```text
Leaked Artifact
   ↓
Embedded Watermark
   ↓
Provenance Event
   ↓
Recipient Public Key
   ↓
Valid ML-DSA Signature
   ↓
Ledger Integrity Proof
```

A valid signature demonstrates possession/use of the associated private signing key at the time of signing; it should not be interpreted as proof of the physical identity of a human operator beyond the identity/key-management assumptions of the deployment.

## What this system does not guarantee

- A watermark cannot be guaranteed to survive every screenshot, photograph, crop, heavy recompression, or deliberate removal technique.
- Endpoint compromise can undermine evidence collection or private-key protection.
- Private-key compromise undermines recipient attribution assumptions.
- A ledger protects against the threat model it is designed for; total collusion of all trusted validator custodians is outside the simple 2-of-3 MVP threat model.

For insufficient evidence, the investigator should return **INCONCLUSIVE**, not force attribution.

---

# Air-Gapped / Offline Deployment

The MVP is designed to run inside an isolated environment:

```text
NO PUBLIC BLOCKCHAIN
NO CLOUD KMS
NO EXTERNAL RUNTIME API
NO REQUIRED INTERNET CONNECTION
```

The container topology is local and the cryptographic primitives are executed inside the deployed environment.

For hardened deployment, container images and all dependency artifacts should be imported through an approved offline software supply-chain process rather than downloaded on the secure network.

---

# Current MVP Limitations

### Frontend

The React frontend is currently a static/unintegrated placeholder. The working MVP is exercised through backend APIs and automated E2E tests.

### Ledger finality notification

The recipient agent currently uses a short fixed wait for finality instead of event-driven WebSocket/SSE subscription.

### Production ledger

The MVP uses a simplified custom permissioned quorum/Merkle ledger. Production deployment should use a mature, independently reviewed distributed-ledger/consensus implementation as appropriate for the target threat model.

### Watermark robustness

The current implementation is intended for digital PDF forensic use. Print-scan, camera capture, and deliberate removal resilience require additional engineering and evaluation.

---

# Roadmap

## Phase 1 — MVP

- [x] PQC
- [x] local recipient agent
- [x] AES-GCM encryption
- [x] forensic watermarking
- [x] signed provenance
- [x] quorum ledger
- [x] leak attribution
- [x] tamper detection

## Phase 2 — Operational Hardening

- [ ] Connect React UI to FastAPI
- [ ] Replace fixed finality wait with event-driven status
- [ ] Add stronger identity/RBAC workflows
- [ ] Expand API validation and audit logging
- [ ] Add negative/adversarial test matrix

## Phase 3 — Production Evolution

- [ ] HSM / TPM / PKCS#11 integration
- [ ] Mature permissioned BFT DLT
- [ ] Enterprise PKI integration
- [ ] High availability and secure isolated cluster
- [ ] Print/camera robust watermarking
- [ ] Independent security assessment

---

# Why This Approach Is Different

### Conventional distribution

```text
Encrypt once
    ↓
Recipients get same plaintext
    ↓
Leak
    ↓
Guess from logs
```

### SIH26237

```text
Encrypt once
    ↓
Recipient-specific decryption provenance
    ↓
Unique invisible forensic watermark
    ↓
Recipient ML-DSA signature
    ↓
2-of-3 permissioned ledger finality
    ↓
Leak
    ↓
Watermark + cryptographic proof
    ↓
Evidence-based attribution / INCONCLUSIVE
```

---

# Contribution & Use Policy

This repository is distributed under a **custom proprietary, all-rights-reserved license**. The project source code is **not open-source software** and may not be reused, copied, modified, redistributed, sublicensed, sold, or incorporated into another project without prior written permission, except where a third-party dependency is governed by its own license.

See [`LICENSE`](./LICENSE).

---

# Third-Party Components

This repository depends on external libraries such as liboqs/liboqs-python, PyMuPDF, PyWavelets, NumPy, OpenCV, FastAPI, PostgreSQL clients, React, Vite and other packages.

Those dependencies remain subject to their respective upstream licenses. This repository's proprietary license applies to the project's original source code and project-owned assets to the extent permitted by law.

---

# Citation / Project Identity

**Project:** SIH26237 — Cryptographic Attribution and Immutable Decryption Provenance for Multi-Recipient Encrypted Document Distribution

**Organization / Team:** CODER_CUTIES

**Platform:** Smart India Hackathon 2026

**Primary repository owner:** Lakshy Rana

---

# License

Copyright © 2026 Lakshy Rana / CODER_CUTIES. All rights reserved.

See the full proprietary license text in [`LICENSE`](./LICENSE).
