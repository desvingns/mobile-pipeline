---
id: rubrics/security-privacy-checklist
version: 1.0.0
inputs: [feature_inventory, posture_answers, apk_permissions]
outputs: [security-privacy.md]
model: sonnet
owner_agent: security-privacy-reviewer
tags: [security, privacy, gdpr, permissions, neutral, spec-layer]
platform: neutral
---

# Security & privacy checklist rubric

Write security and privacy requirements covering data classification, transport, storage, secret handling, permissions, consent, and retention.

## Data classification tiers

| Tier | Definition | Storage rule |
|---|---|---|
| Public | Non-personal, freely shareable | Any storage |
| Internal | App state, preferences | Encrypted storage preferred; no cloud without user consent |
| PII | Name, email, phone, location | Must be encrypted at rest; must not appear in logs |
| Sensitive | Financial, health, credentials, auth tokens | Encrypted at rest (strong cipher); never in plain shared preferences; TTL enforced |

## Mandatory check areas

### At rest
- Sensitive and PII data encrypted at rest (specify cipher family — e.g. AES-256 — without naming a library).
- Auth tokens/secrets never stored in plaintext shared preferences or world-readable files.
- Local database containing PII protected by at-rest encryption where OS supports it.

### In transit
- All network calls use TLS 1.2 or higher; no plain HTTP for any app-owned endpoint.
- Certificate pinning required for endpoints that transmit Sensitive-tier data (`SEC` item, justified or waived with rationale).

### Secret handling
- API keys and secrets not embedded in client binary in plaintext.
- Build-time injection preferred; note `SEC-NNN` if a secret is required at runtime.

### Permissions
- Each declared permission must be tied to ≥1 named feature (`Fxx` or screen `Sxx`).
- Permissions requested at first use, not at install, unless technically unavoidable.
- Permissions not justified by a feature are **disallowed**.

<!-- platform:android -->
Permission names (e.g. `android.permission.CAMERA`) go in fenced `<!-- platform:android -->` blocks only.
Use `FLAG_SECURE` on screens displaying Sensitive-tier data.
Scoped storage rules apply for media access on API 29+.
<!-- end platform:android -->

### Consent (GDPR / 152-ФЗ)
- `consent_required: true` if app processes PII of EU or Russian-resident users.
- Consent must be explicit (opt-in), granular, and revocable.
- Data processing purpose stated at collection point.
- Privacy policy URL required in store listing and in-app settings.

### Data deletion / retention
- User account deletion must remove all PII within N days (default: 30 days; adjust per posture).
- Locally cached PII purged on logout.
- Retention schedule defined per entity tier.

## Rules

- **SEC-NNN** for security items; **PRIV-NNN** for privacy / consent items (zero-padded, stable).
- Every permission in `apk_permissions` or `integrations[]` must have a corresponding `SEC-NNN` justification.
- Source tags: `[src: posture]`, `[src: apk]`, `[src: inventory]`, `[src: derived]`.

## Output skeleton (`security-privacy.md`)

```markdown
# Security & Privacy Requirements

## Data classification
| Entity | Tier | Rationale |
|--------|------|-----------|
| UserCredential | Sensitive | Auth token; financial risk if leaked |
| UserProfile | PII | Contains name and email |

## Security requirements
- **SEC-001** — THE SYSTEM SHALL transmit all data to app-owned endpoints over TLS 1.2+. [src: derived]
- **SEC-002** — THE SYSTEM SHALL store auth tokens using OS-level encrypted storage. [src: posture]
...

## Permission justification
- **SEC-010** — <permission> — required by <Fxx / Sxx>. [src: apk]
<!-- platform:android -->
`android.permission.CAMERA` — required by F03 (photo attachment on transaction entry screen S04).
<!-- end platform:android -->

## Privacy requirements
- **PRIV-001** — THE SYSTEM SHALL obtain explicit opt-in consent before collecting PII. [src: posture]
- **PRIV-002** — THE SYSTEM SHALL delete all user PII within 30 days of account deletion request. [src: derived]
...
```

Return JSON: `{sec:[], priv:[], permissions_to_justify:[], consent_required:bool, fetch_error}`.
