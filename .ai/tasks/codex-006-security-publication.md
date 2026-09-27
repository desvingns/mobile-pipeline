# Security publication hardening

STATUS: COMPLETE
OWNER: Codex
DATE: 2026-09-27

Scope: explicit proposal staging, template-only patch boundaries, GitHub credential host binding,
canonical/generated adapter parity, regression tests. Preserve pre-existing user changes.

Validation: canonical, installed, Claude and Codex proposal security tests PASS; proposal lifecycle,
bootstrap, GitHub push contract and graph tests PASS; focused ShellCheck warning gate PASS;
generated ShellCheck error gate PASS; both generated proposal adapters equal canonical sources.
Release 1.18.1. Existing user edits in AGENTS/README/ARCHITECTURE/showcase remain untouched.
