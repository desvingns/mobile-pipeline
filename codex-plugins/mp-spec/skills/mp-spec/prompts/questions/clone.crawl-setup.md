---
id: questions/clone.crawl-setup
version: 1.1.0
inputs: [user_message, preflight_result]
outputs: [adb_path, device_serial, crawl_consent, test_credentials]
model: n/a
owner_agent: orchestrator
tags: [questions, clone, crawl, device, auth]
platform: android
---

<!-- Used by SKILL.md Step 2 → A.0-crawl when device-preflight.sh returns ok:false, or to confirm
     consent before the first autonomous crawl. Android-only (adb). -->

## Device connection (when `device-preflight.sh` returns `ok:false`)

The crawler needs ONE booted Android device/emulator reachable over `adb`. Ask:

```
Нужно подключённое Android-устройство/эмулятор для динамического обхода референса.
`adb devices` сейчас не видит готового устройства. Подскажи:
  a) Эмулятор запущен в Android Studio — серийник? (например emulator-5554)
  b) Физическое устройство по USB (включи USB-debugging) — модель?
  c) Сетевой adb — host:port для `adb connect`?
  d) Путь к adb, если он не в PATH (например %LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe)
  e) Пропустить обход — продолжить статически (только мои скриншоты)
```

- Set `ADB=<path>` (option d) and/or `ANDROID_SERIAL=<serial>` (a/b), or `adb connect <host:port>` (c),
  then re-run `device-preflight.sh`.
- On **e** (or if no device after one retry and `--graph` was not explicit): skip A.0, record
  `crawl.skipped:"no device"` in `00_meta.yaml`, fall through to the static A-clone.
- On success, record `crawl.device{serial,w,h,android}` in `pipeline/00_meta.yaml` so `--resume` and
  future runs never re-ask while the connection keeps working.

## Crawl consent (first autonomous run)

Before the first crawl on a given app, confirm briefly:

```
Сейчас APK будет установлен на устройство, сброшен в первозапуск (pm clear) и автоматически обойдён
для сбора экранов и состояний. Краулер может ЗАРЕГИСТРИРОВАТЬ синтетический аккаунт и СОЗДАВАТЬ
тестовые записи (синтетические данные), чтобы увидеть наполненные экраны. Запрещено: покупки за
реальные деньги, отправка сообщений реальным контактам, выход из аккаунта, необратимые/деструктивные
действия. Стены с SMS/email-кодом или captcha краулер пройти не может — пометит needs_human и обойдёт
ветку. Продолжить?
  a) Да, обойти и наполнять синтетикой
  b) Только осмотр (read-only), без регистрации и создания записей
  c) Нет, продолжить статически (мои скриншоты)
```

On **b** → run explore-only (no auth/seed goals). On **c** → skip A.0 (`crawl.skipped:"user declined"`),
static A-clone. Use a real test device/emulator you own — never someone else's account or a production device.

## Test credentials (optional — recommended for apps behind a verification wall)

If the app requires sign-in and self-registration would hit an SMS/email/captcha wall, ask:

```
Если у приложения есть вход и регистрация упрётся в SMS/email-код — дай ТЕСТОВЫЙ аккаунт (не личный),
и краулер залогинится им вместо саморегистрации:
  a) Вот тестовые логин+пароль (введу следующим сообщением)
  b) Нет — пусть краулер сам пробует зарегистрироваться (упрётся в верификацию → needs_human)
```

**Security:** treat any provided credentials as **runtime-only** — pass them to the `crawl-executor`
in its goal call and **never write them to `00_meta.yaml`, `trace.jsonl`, `session.md`, the spec
bundle, or any committed file.** Only a test/throwaway account, never a personal or production login.
