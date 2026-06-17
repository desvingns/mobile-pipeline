---
name: telegram-delivery
description: "/mp --deliver — self-deliver a build to Telegram via an MTProto user session (Telethon); ships through the common-scripts loop, 2 GB cap, not the bot API."
metadata:
  node_type: memory
  type: project
---

`/{{PREFIX}} --deliver` sends a built artifact to your own Telegram (default `me` = Saved Messages)
over an **MTProto user session** (Telethon), so the file cap is **2 GB**, not the bot API's 50 MB —
and there is no bot and no local Bot API server. Canonical script:
`templates/common/scripts/{{PREFIX}}-deliver-telegram.sh`. Doc: `docs/TELEGRAM-DELIVERY.md`.

**Why a user session, not a bot:** the bot API caps cloud uploads at 50 MB; lifting that needs a
self-hosted `telegram-bot-api` server. An MTProto user login hits the 2 GB cap immediately with
zero infra — the simplest path for "send <100 MB builds to myself".

**How it fits the framework:**
- It is a **common (platform-neutral) script**, so it ships ONLY through
  `lib/build-marketplace.sh`'s common-scripts loop (`build_mp_dev`, kind `neutral`) →
  `claude-plugins/mp-dev/scripts/mp-deliver-telegram.sh`. Like `{{PREFIX}}-record-run.sh` /
  `-retro.sh`, **`bootstrap.sh` does not copy common scripts** — the plugin is the delivery vehicle,
  and the orchestrator resolves it as `${CLAUDE_PLUGIN_ROOT}/scripts/...`. See [[change-log-discipline]].
- Golden-rule note: "cross-platform bash only" holds for the wrapper; the MTProto call is delegated
  to `python3` + `telethon`, an external dependency in the same class as adb/gradle/ImageMagick.
- Secrets (`TG_API_ID`/`TG_API_HASH`/`TG_SESSION`/`TG_TARGET`) come from env or a gitignored
  repo-root `.env` (TG_* keys are parsed, never executed). `TG_SESSION` (a Telethon StringSession,
  minted once via `--login`) is login-equivalent — never commit it.
- Emits exactly one JSON line and mirrors `ok` → exit code (per the structured-payload rule).

Added in v1.9.0 (`2026-06-17T12:00-telegram-build-delivery`).
