# Telegram build delivery (`/{{PREFIX}} --deliver`)

Send a freshly built artifact to **yourself** over Telegram, without the bot API's 50 MB cap.

## Why MTProto (a user session), not a bot

| Path | File cap | Setup |
|---|---|---|
| Bot API (cloud `api.telegram.org`) | **50 MB** | token from @BotFather |
| Bot API (self-hosted server) | 2 GB | token + run `telegram-bot-api` |
| **MTProto user session (this tool)** | **2 GB** (4 GB Premium) | `api_id`/`api_hash` + one-time login |

`--deliver` logs in as **you** (not a bot) via [Telethon](https://docs.telethon.dev) over MTProto,
so the cap is 2 GB straight away. The default target is `me` — your **Saved Messages** — i.e. you
send the build to your own account. No bot, no local Bot API server.

## Prerequisites

- `python3` and the `telethon` package: `python3 -m pip install telethon`
- A Telegram `api_id` + `api_hash` (free): https://my.telegram.org → **API development tools**

## One-time setup

1. Mint a session string (interactive — asks for your phone, the login code Telegram sends, and
   your 2FA password if set):
   ```bash
   bash .claude/scripts/{{PREFIX}}-deliver-telegram.sh --login
   ```
   It prints a **StringSession** to stderr.
2. Put the secrets in a **gitignored** `.env` at the repo root (or in CI secrets / the environment):
   ```dotenv
   TG_API_ID=1234567
   TG_API_HASH=0123456789abcdef0123456789abcdef
   TG_SESSION=1ApW... (the string from --login)
   TG_TARGET=me          # optional: me (default) | @username | numeric peer id
   ```
   > The `StringSession` is equivalent to a full login to your account. **Keep it secret, never
   > commit it.** Add `.env` to `.gitignore`.

## Sending a build

```bash
# explicit artifact
bash .claude/scripts/{{PREFIX}}-deliver-telegram.sh app/build/outputs/apk/release/app-release.apk

# or let it pick the newest *.apk under any */build/outputs/*
bash .claude/scripts/{{PREFIX}}-deliver-telegram.sh

# override caption / target ad hoc
bash .claude/scripts/{{PREFIX}}-deliver-telegram.sh app-debug.apk --caption "nightly" --target @my_other_account
```

The script emits exactly one JSON line and mirrors `ok` → exit code (0 success, 1 failure):

```json
{"ok":true,"target":"me","file":"app-release.apk","bytes":12345678,"mb":"11.8"}
{"ok":false,"error":"TG_SESSION not set — run with --login first"}
```

Default caption is the filename plus the short commit (`app-release.apk @ a1b2c3d`) when run inside a
git repo.

## Via the orchestrator

`/{{PREFIX}} --deliver [<artifact-path>]` runs the script and reports the result. After a
`--feature`/`--phase` build that produced an installable artifact, the orchestrator may also offer
once — "Send the build to your Telegram now? (y/N)" — and only sends on an explicit `y`.

## Notes & limits

- **2 GB** per file on a user session (4 GB with Telegram Premium). The script refuses anything
  larger. For builds <100 MB this is never a concern.
- Secrets are read from the environment first, then from `.env` (TG_* keys only — the file is parsed
  for those keys, never executed as a shell script).
- The MTProto call is the only non-bash dependency (`python3` + `telethon`), treated like adb/gradle.
- This is your personal account: avoid high-frequency automated sends from many IPs to stay clear of
  flood limits. "One build to yourself per run" is well within normal use.
