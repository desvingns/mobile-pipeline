---
id: questions/clone.input
version: 1.0.0
inputs: [user_message]
outputs: [screenshots_dir, play_url, apk_path, app_short_name]
model: n/a
owner_agent: orchestrator
tags: [questions, clone, input]
platform: neutral
---

<!-- Source: monolith SKILL.md Step 0 — Parse input -->

## Input clarification prompts (Step 0)

### Screenshots directory

If `<screenshots_dir>` not provided — ask:

```
Укажи путь к папке со скриншотами приложения (PNG/JPG).
Пример: D:\screenshots\my_app
```

### Google Play URL

If `--play` not provided and `--skip-play` not set — ask:

```
Есть ли ссылка на Google Play?
  a) Да, вот ссылка (укажу следующим сообщением)
  b) Нет, пропустить Play-фазу (анализ только по скриншотам)
```

### APK file

If `--apk` not provided and `--skip-apk` not set — ask:

```
Есть ли APK файл приложения? (даст точную палитру, все строки, manifest, библиотеки —
значительно повышает точность TDD по сравнению с одними скриншотами)
  a) Да, вот путь (укажу следующим сообщением)
  b) Нет, продолжить без APK
  c) Хочу скачать — подскажи где взять (выведу подсказку и подожду путь)
```

If user picks `c` — print:

```
1) APKMirror (рекомендую): https://www.apkmirror.com/ — найди приложение, скачай свежий APK.
2) Установлен на телефоне? — `adb shell pm path <package>` + `adb pull <path>`.
3) Эмулятор Android Studio AVD → установи из Play → `adb pull` как выше.
После — введи путь к скачанному файлу.
```

Wait for user input. If `--apk` validated — proceed; if user types "пропустить" — continue without APK.

### APK validation (rejection hints)

If `--apk` is provided — verify the file exists and ends in `.apk`.

If extension is `.apks`, `.xapk`, or `.aab` — explain the difference and ask to provide a flat `.apk` (or extract base APK from the bundle). On invalid path — ask once to correct, then either continue without APK or abort per user.

AAB-specific hint:

```
Это AAB (Android App Bundle), а не APK. Из AAB можно извлечь base APK через bundletool:
  java -jar bundletool.jar build-apks --bundle=<file>.aab --output=app.apks
Потом распаковать .apks как zip — внутри будет base-master.apk.
  a) Сделаю это сейчас — подожди
  b) Продолжить без APK
  c) Отмена
```
