# SIH26237 — Product Requirements Document (PRD)

## 1. Product Overview

**Product:** Cryptographic Attribution and Immutable Decryption Provenance for Multi-Recipient Encrypted Document Distribution

**Problem Statement ID:** SIH26237

**Theme:** Blockchain & Cybersecurity

**Context:** Secure distribution of sensitive documents to multiple recipients where every recipient receives the same plaintext, but the organization must still be able to establish cryptographically verifiable provenance if a copy is leaked.

### Core proposition

The system creates a **recipient/session-specific invisible forensic watermark at decryption time**, binds the decryption event to a **recipient-held post-quantum signing key**, and records the signed provenance in an **offline permissioned quorum-protected ledger**. A leaked document can then be investigated by extracting the watermark, locating the corresponding ledger event, and verifying the cryptographic evidence.

---

## 2. Objectives

1. Preserve the efficiency of one encrypted document distribution while producing recipient-specific forensic copies.
2. Keep recipient private keys inside a local Recipient Decryption Agent rather than on the central backend.
3. Use NIST-standardized post-quantum cryptography for recipient key encapsulation and signatures.
4. Prevent a single privileged administrator from silently rewriting decryption provenance.
5. Support fully local, air-gapped deployment with no cloud KMS and no public blockchain dependency.
6. Provide an investigator workflow that returns a cryptographically supported attribution result or an explicit **INCONCLUSIVE** result when evidence validation fails.

---

## 3. Users / Actors

### Sender
Uploads the source document, initiates encrypted distribution, and selects authorized recipients.

### Recipient
Uses the local Recipient Decryption Agent to decapsulate, decrypt, watermark, sign, and release a recipient-specific copy.

### Investigator
Submits a leaked document and validates watermark, ledger provenance, signatures, and chain integrity.

### Validators
Three permissioned validator services participate in event/block endorsement. MVP finality uses a **2-of-3 quorum**.

### System Administrator
Maintains infrastructure and identities but is not trusted as the sole authority for provenance history.

---

## 4. Functional Requirements

### FR-01 — Document Encryption
The system shall encrypt the document payload with **AES-256-GCM** using a fresh nonce and shall support **HKDF-SHA256** for key derivation/wrapping.

### FR-02 — Recipient Key Encapsulation
The system shall support **ML-KEM-1024** for recipient-specific key encapsulation and decapsulation through liboqs/liboqs-python.

### FR-03 — Local Decryption Boundary
The recipient's private KEM/signing keys shall be used by the local Recipient Decryption Agent. The central backend shall coordinate distribution but shall not perform recipient-private-key operations on the recipient's behalf.

### FR-04 — Unique Watermark Generation
At decryption time, the agent shall derive a deterministic but recipient/session-specific watermark reference using document/session/key/nonce context and SHAKE256.

### FR-05 — Watermark Payload
The MVP watermark payload shall contain:

```text
[ 96-bit watermark_ref ][ 16-bit document tag ][ 16-bit CRC16 ]
```

for a total of 128 bits.

### FR-06 — Transform-Domain Embedding
The PDF watermark pipeline shall rasterize pages and embed watermark bits in the visual transform domain using DWT/QIM-style processing with redundancy across blocks/pages.

### FR-07 — Cryptographic Decryption Event
The agent shall build a canonical decryption event containing enough metadata to bind the event to the document, session, recipient, artifact, watermark, and algorithm version.

### FR-08 — Recipient Signature
The canonical event shall be signed using **ML-DSA-65** with the recipient's private signing key.

### FR-09 — Permissioned Ledger
The system shall maintain an offline permissioned provenance ledger with:

- three validator services in the MVP,
- Merkle-rooted event data,
- previous-block hash linkage,
- validator endorsements,
- 2-of-3 quorum finality.

### FR-10 — Release Gate
A watermarked recipient artifact shall not be released/saved when the required ledger finality/quorum response is not obtained.

### FR-11 — Leak Investigation
The investigator shall:

1. extract watermark data from the leaked PDF,
2. validate payload integrity using CRC,
3. find the corresponding provenance record,
4. verify the recipient ML-DSA-65 signature,
5. verify ledger Merkle/hash-link integrity,
6. return attribution evidence.

### FR-12 — Tamper Handling
When ledger provenance validation fails, the system shall prefer **INCONCLUSIVE** over an unverified attribution.

### FR-13 — Offline Operation
The runtime shall not require public blockchain infrastructure, cloud KMS, or external runtime APIs.

---

## 5. Non-Functional Requirements

### Security
- Recipient private keys isolated to the recipient agent.
- Post-quantum KEM and signature primitives are real liboqs operations in the MVP.
- Authenticated document encryption uses AES-256-GCM.
- Provenance evidence is cryptographically signed and hash-linked.
- Ledger uses quorum-based endorsement instead of a single trusted writer.

### Integrity
- Canonical event encoding must be deterministic.
- Merkle roots must be reproducible from stored event payloads.
- Previous-block links must detect chain modification.

### Availability
- MVP runs as a local Docker Compose deployment.
- A single failed validator should not necessarily prevent a 2-of-3 commit when quorum remains available.

### Auditability
- All attribution decisions must be explainable through watermark reference, signed event, signature verification status, and ledger integrity status.

### Deployment
- Target network: isolated/air-gapped environment.
- Runtime packaging: Docker Compose in the MVP.

---

## 6. End-to-End Workflow

```text
Sender
  │
  ▼
Upload Document
  │
  ▼
AES-256-GCM Encryption
  │
  ▼
Recipient-Specific ML-KEM-1024 Envelope
  │
  ├──────────────► Recipient A Agent
  │                    │
  │                    ├─ ML-KEM Decapsulation
  │                    ├─ AES-GCM Decryption
  │                    ├─ Generate A-specific WM reference
  │                    ├─ Embed forensic watermark
  │                    ├─ Hash watermarked artifact
  │                    ├─ Build canonical event
  │                    ├─ ML-DSA-65 signature
  │                    └─ Submit provenance event
  │
  └──────────────► Recipient B Agent
                       │
                       ├─ same plaintext
                       ├─ different WM reference
                       └─ different signed event

                         ▼
                 3 Validator Ledger Nodes
                         ▼
                    2-of-3 Quorum
                         ▼
                    Final Provenance
                         ▼
                    Release Artifact

LEAK
  │
  ▼
Investigator
  │
  ├─ Rasterize PDF
  ├─ Extract watermark
  ├─ CRC validation
  ├─ Ledger lookup
  ├─ ML-DSA-65 verification
  └─ Merkle/hash-chain verification
             │
             ├── VERIFIED → recipient/session evidence
             └── INCONCLUSIVE → evidence integrity insufficient
```

---

## 7. Technical Architecture

### Application layer

- **Backend:** Python 3.12 + FastAPI
- **Database:** PostgreSQL
- **Identity/RBAC:** local identity records and authenticated sessions
- **Document service:** encrypted blob storage and recipient envelopes
- **Investigation service:** provenance lookup and verification

### Recipient zone

- Local Python Recipient Decryption Agent
- Recipient ML-KEM-1024 private key
- Recipient ML-DSA-65 private key
- Local cryptographic operations
- PDF watermark generation

### Ledger zone

- Collector/proposer
- Validator 1
- Validator 2
- Validator 3
- Merkle-rooted event records
- Hash-linked blocks
- 2-of-3 endorsement finality

### Watermark stack

- NumPy
- PyWavelets
- OpenCV
- PyMuPDF

---

## 8. Data Model — Conceptual

### Document

```text
Document
├── document_id
├── encrypted_blob
├── document_sha256
├── created_at
└── distribution metadata
```

### Recipient Identity

```text
Recipient
├── recipient_id
├── display_name
├── ML-KEM-1024 public key
├── ML-DSA-65 public key
└── status
```

### Decryption Event

```text
DecryptionEvent
├── event_id
├── document_id
├── recipient_id
├── session_id
├── watermark_ref
├── artifact_hash
├── algorithm_version
├── timestamp / nonce context
└── recipient_signature
```

### Ledger Block

```text
Block
├── height
├── previous_hash
├── events_root (Merkle)
├── block metadata
└── validator endorsements
```

---

## 9. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Python 3.12 + FastAPI |
| PQC | liboqs / liboqs-python |
| KEM | ML-KEM-1024 |
| Signature | ML-DSA-65 |
| Symmetric crypto | AES-256-GCM |
| KDF | HKDF-SHA256 |
| Hashing | SHA-256 / SHAKE family |
| Watermark | NumPy + PyWavelets + OpenCV + PyMuPDF |
| Database | PostgreSQL |
| Ledger | Permissioned quorum + Merkle/hash-linked ledger |
| Runtime | Docker + Docker Compose |
| Testing | pytest + httpx |

---

## 10. MVP Acceptance Criteria

The MVP is accepted when all of the following are demonstrably true:

- [x] ML-KEM-1024 encapsulation/decapsulation executes through liboqs.
- [x] ML-DSA-65 recipient signatures execute through liboqs.
- [x] AES-256-GCM encrypt/decrypt executes through the cryptography library.
- [x] PDF watermark embed/extract pipeline passes automated tests.
- [x] Recipient A and Recipient B produce different forensic references for the same plaintext.
- [x] Recipient signatures are verified during provenance processing.
- [x] A 2-of-3 validator quorum can commit a provenance record.
- [x] Tamper detection causes provenance validation to fail safely.
- [x] End-to-end Golden Flow passes from clean state.
- [x] No cloud KMS/public blockchain/runtime internet dependency is required.

**Current automated validation:** 9/9 tests passed in the verified audit run.

---

## 11. Out of Scope / Deferred

- Full production-grade BFT blockchain consensus.
- HSM/TPM/PKCS#11 key storage.
- Enterprise identity/PKI integration.
- Browser-side private-key cryptography.
- High-fidelity print-scan / camera-capture robust watermarking.
- Advanced OCR or multimodal leak intelligence.
- Production HA orchestration beyond the MVP Docker deployment.

---

## 12. Known MVP Limitations

1. **Frontend integration:** React UI exists only as a static/unintegrated placeholder in the current MVP.
2. **Finality waiting:** Recipient agent currently uses a short hardcoded wait rather than event-driven WebSocket/SSE subscription.
3. **Ledger fault handling:** Investigator logic may ignore a failed validator in the MVP rather than implementing a full production consensus/fault model.
4. **Watermark limitations:** Digital watermarking is not a guarantee against every possible transformation, screenshot, photograph, crop, or deliberate removal attack. An evidence failure should produce an inconclusive result.

---

## 13. Production Evolution

- Hardware-backed private-key protection (HSM/TPM/PKCS#11).
- Mature permissioned BFT DLT implementation.
- Enterprise PKI and identity integration.
- Stronger print-scan and camera-resilient watermark research.
- Hardened isolated cluster and secure deployment lifecycle.
- Event-driven finality notifications.
- Expanded adversarial testing and independent security review.
